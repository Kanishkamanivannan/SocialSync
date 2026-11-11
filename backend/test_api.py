"""
Comprehensive Automated Test Suite for SocialSync API
Tests authentication, authorization, CRUD, upload, analytics, accounts, campaigns, and scheduler.
"""

import sys
import os
import io
import time
from datetime import datetime, timedelta

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from database import get_db_connection

def run_tests():
    client = app.test_client()
    passed = 0
    failed = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} - {details}")
            failed += 1

    print("==================================================")
    print("      SOCIALSYNC FULL-STACK TEST RUNNER")
    print("==================================================")

    # 1. Health check
    print("\n--- 1. Health & Server Status ---")
    res = client.get('/api/health')
    assert_test("Health endpoint returns 200", res.status_code == 200)
    data = res.get_json()
    assert_test("Database is SQLite", data.get('database') == 'SQLite')
    assert_test("Scheduler is active", data.get('scheduler') == 'active')

    # 2. Authentication & Security
    print("\n--- 2. Authentication & Security ---")
    # Test invalid login
    res = client.post('/api/auth/login', json={'email': 'nonexistent@user.com', 'password': 'wrongpassword'})
    assert_test("Invalid login rejected with 401", res.status_code == 401)

    # Test valid login with demo user
    res = client.post('/api/auth/login', json={'email': 'alex@socialsync.io', 'password': 'password123'})
    assert_test("Valid login returns 200", res.status_code == 200)
    auth_data = res.get_json()
    assert_test("Login returns user data", auth_data.get('user', {}).get('email') == 'alex@socialsync.io')
    token = auth_data.get('token')
    assert_test("Token is signed and present", bool(token) and len(token) > 20)

    # Test authenticated /api/auth/me
    res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert_test("/api/auth/me returns current user", res.status_code == 200 and res.get_json().get('email') == 'alex@socialsync.io')

    # Test register new user
    new_email = f"test_{int(time.time())}@socialsync.io"
    res = client.post('/api/auth/register', json={
        'name': 'Test Creator',
        'email': new_email,
        'password': 'securepassword123'
    })
    assert_test("New user registration succeeds (201)", res.status_code == 201)
    new_user_data = res.get_json()
    new_token = new_user_data.get('token')
    assert_test("Registration returns valid token", bool(new_token))

    # Verify password is hashed in database
    conn = get_db_connection()
    user_row = conn.execute('SELECT password FROM users WHERE email = ?', (new_email,)).fetchone()
    conn.close()
    assert_test("Password is cryptographically hashed (scrypt)", user_row['password'].startswith(('scrypt:', 'pbkdf2:')))

    auth_hdr = {'Authorization': f'Bearer {token}'}
    new_auth_hdr = {'Authorization': f'Bearer {new_token}'}
    new_user_id = new_user_data.get('user', {}).get('id')

    # 3. Notification Settings
    print("\n--- 3. Notification Preferences ---")
    res = client.get('/api/settings/notifications', headers=auth_hdr)
    assert_test("Get notifications returns 200", res.status_code == 200)
    res = client.put('/api/settings/notifications', 
        headers=auth_hdr,
        json={'notify_publish': True, 'notify_engage': False, 'notify_email': True}
    )
    assert_test("Update notifications returns 200", res.status_code == 200)
    notif_data = res.get_json()
    assert_test("Notification preferences persisted", notif_data.get('notify_email') is True and notif_data.get('notify_engage') is False)

    # 4. Social Accounts & Sync
    print("\n--- 4. Social Accounts Integration ---")
    res = client.get('/api/accounts', headers=auth_hdr)
    assert_test("Get accounts returns 200", res.status_code == 200)
    accounts = res.get_json()
    assert_test("Contains 6 social platforms", len(accounts) >= 6)
    assert_test("Accounts include mode metadata", 'mode' in accounts[0] and accounts[0]['mode'] in ['live', 'sandbox'])

    # Toggle connection
    first_acc_id = accounts[0]['id']
    orig_connected = accounts[0]['connected']
    res = client.post(f'/api/accounts/{first_acc_id}/toggle', headers=auth_hdr)
    assert_test("Toggle account connection returns 200", res.status_code == 200)
    assert_test("Connection state toggled", res.get_json().get('connected') != orig_connected)
    # Restore connection
    client.post(f'/api/accounts/{first_acc_id}/toggle', headers=auth_hdr)

    # Sync all accounts
    res = client.post('/api/accounts/sync-all', headers=auth_hdr)
    assert_test("Sync all accounts returns 200", res.status_code == 200)
    assert_test("Sync returns updated accounts", res.get_json().get('success') is True)

    # 5. Campaigns CRUD
    print("\n--- 5. Campaigns Module ---")
    # Create campaign
    res = client.post('/api/campaigns', headers=auth_hdr, json={
        'title': 'Automated Test Campaign',
        'description': 'Integration testing campaign',
        'budget': '$2,500',
        'target_reach': 75000,
        'start_date': '2026-11-01',
        'end_date': '2026-12-01'
    })
    assert_test("Create campaign returns 201", res.status_code == 201)
    camp = res.get_json()
    camp_id = camp['id']

    # Update campaign
    res = client.put(f'/api/campaigns/{camp_id}', headers=auth_hdr, json={
        'title': 'Automated Test Campaign (Updated)',
        'budget': '$3,000'
    })
    assert_test("Update campaign returns 200", res.status_code == 200)
    assert_test("Campaign title updated", res.get_json().get('title') == 'Automated Test Campaign (Updated)')

    # 6. Posts CRUD & Scheduling
    print("\n--- 6. Posts & Scheduling Module ---")
    # Create draft
    res = client.post('/api/posts', headers=auth_hdr, json={
        'content': 'Test draft post for campaign',
        'platforms': ['Instagram', 'LinkedIn'],
        'status': 'draft',
        'campaign_id': camp_id
    })
    assert_test("Create draft post returns 201", res.status_code == 201)
    draft_post = res.get_json()
    draft_id = draft_post['id']

    # Create published post
    res = client.post('/api/posts', headers=auth_hdr, json={
        'content': 'Test published post with live reach',
        'platforms': ['Instagram', 'TikTok'],
        'status': 'published',
        'campaign_id': camp_id
    })
    assert_test("Create published post returns 201", res.status_code == 201)
    pub_post = res.get_json()
    pub_id = pub_post['id']
    assert_test("Published post received simulated reach", pub_post.get('reach', 0) > 0)

    # Verify campaign current_reach dynamically summed from linked posts
    res = client.get('/api/campaigns', headers=auth_hdr)
    all_camps = res.get_json()
    test_camp = next((c for c in all_camps if c['id'] == camp_id), None)
    assert_test("Campaign linked reach is dynamic", test_camp is not None and test_camp.get('current_reach', 0) > 0)

    # Update post
    res = client.put(f'/api/posts/{draft_id}', headers=auth_hdr, json={
        'content': 'Updated content for draft post',
        'status': 'scheduled',
        'scheduled_for': (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')
    })
    assert_test("Update post returns 200", res.status_code == 200)
    assert_test("Post status changed to scheduled", res.get_json().get('status') == 'scheduled')

    # Delete posts
    res = client.delete(f'/api/posts/{draft_id}', headers=auth_hdr)
    assert_test("Delete post returns 200", res.status_code == 200)
    client.delete(f'/api/posts/{pub_id}', headers=auth_hdr)

    # Delete campaign
    res = client.delete(f'/api/campaigns/{camp_id}', headers=auth_hdr)
    assert_test("Delete campaign returns 200", res.status_code == 200)

    # 7. File & Image Upload
    print("\n--- 7. Media Upload Module ---")
    created_uploads = []
    sample_png = io.BytesIO(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
    res = client.post('/api/upload', headers=auth_hdr, data={'file': (sample_png, 'sample.png')}, content_type='multipart/form-data')
    assert_test("File upload returns 201", res.status_code == 201)
    upload_data = res.get_json()
    assert_test("Upload returns public URL", bool(upload_data.get('url')) and 'uploads' in upload_data.get('url'))
    if upload_data.get('filename'):
        created_uploads.append(upload_data['filename'])

    # 8. Analytics & Time Filters
    print("\n--- 8. Analytics Module ---")
    for r in ['7d', '30d', '3m', '1y']:
        res = client.get(f'/api/analytics?range={r}', headers=auth_hdr)
        assert_test(f"Analytics range {r} returns 200", res.status_code == 200)
        anlt = res.get_json()
        assert_test(f"Analytics {r} returns valid history", len(anlt.get('history', [])) > 0)
        assert_test(f"Analytics {r} returns platform distribution", len(anlt.get('platforms', [])) >= 6)

    # 9. Global Search
    print("\n--- 9. Global Search Module ---")
    res = client.get('/api/search?q=SocialSync', headers=auth_hdr)
    assert_test("Global search returns 200", res.status_code == 200)
    search_data = res.get_json()
    assert_test("Search returns structured categories", 'posts' in search_data and 'accounts' in search_data and 'campaigns' in search_data)

    # 10. Official API Setup, AES-256-GCM Token Storage & Strict Live/Sandbox Separation
    print("\n--- 10. Official OAuth Config, AES-256-GCM Crypto & Live/Sandbox Isolation ---")
    from token_crypto import encrypt_token, decrypt_token, redact_secrets
    from social_integrations import social_manager, _validate_safe_remote_url
    sample_secret_token = "EAAGm0PX4ZCpsBA_test_oauth_token_123456"
    aad_a = b"socialsync:oauth:1:facebook"
    aad_b = b"socialsync:oauth:2:facebook"
    ciphertext = encrypt_token(sample_secret_token, aad=aad_a)
    assert_test(
        "Token encryption uses AES-256-GCM v2 envelope",
        isinstance(ciphertext, str) and ciphertext.startswith("enc:v2:aes256gcm:") and sample_secret_token not in ciphertext,
    )
    assert_test("Token decryption restores exact secret with matching AAD", decrypt_token(ciphertext, aad=aad_a) == sample_secret_token)

    tampered = ciphertext[:-4] + ("AAAA" if ciphertext[-4:] != "AAAA" else "BBBB")
    tamper_rejected = False
    try:
        decrypt_token(tampered, aad=aad_a)
    except ValueError:
        tamper_rejected = True
    assert_test("Tampered ciphertext fails AES-GCM authentication tag", tamper_rejected)

    aad_rejected = False
    try:
        decrypt_token(ciphertext, aad=aad_b)
    except ValueError:
        aad_rejected = True
    assert_test("Cross-tenant AAD mismatch fails AES-GCM verification", aad_rejected)

    redacted_msg = redact_secrets(f"Failure with Bearer {sample_secret_token} & client_secret=my_top_secret")
    assert_test(
        "redact_secrets scrubs tokens and secret parameters",
        sample_secret_token not in redacted_msg and "my_top_secret" not in redacted_msg,
    )

    res = client.get('/api/oauth/config-status', headers=auth_hdr)
    assert_test("OAuth config-status returns 200", res.status_code == 200)
    cfg = res.get_json()
    providers = cfg.get('providers', {})
    assert_test("Config status covers Facebook, Instagram, YouTube", all(p in providers for p in ('Facebook', 'Instagram', 'YouTube')))

    def _collect_keys(obj):
        keys = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                keys.append(str(k).lower())
                keys.extend(_collect_keys(v))
        elif isinstance(obj, list):
            for item in obj:
                keys.extend(_collect_keys(item))
        return keys

    cfg_keys = _collect_keys(cfg)
    forbidden_keys = {'app_secret', 'client_secret', 'access_token', 'refresh_token', 'encrypted_access_token', 'encrypted_refresh_token', 'secret_key', 'token_encryption_key'}
    assert_test("Config status exposes no secrets or raw tokens", not any(k in forbidden_keys for k in cfg_keys))

    # Video upload support
    sample_mp4 = io.BytesIO(b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom')
    res = client.post('/api/upload', headers=auth_hdr, data={'file': (sample_mp4, 'clip.mp4')}, content_type='multipart/form-data')
    assert_test("Video file upload returns 201", res.status_code == 201)
    vid_data = res.get_json()
    assert_test("Video upload detects media_type == 'video'", vid_data.get('media_type') == 'video')
    if vid_data.get('filename'):
        created_uploads.append(vid_data['filename'])

    # Live Mode strict failure guarantees (never simulates failed/unsupported live calls)
    for test_label, live_payload in [
        ("Live Mode rejects Sandbox-only platform (X)", {'content': 'Live X test', 'platforms': ['X'], 'publish_mode': 'live', 'status': 'published'}),
        ("Live Mode rejects Instagram text-only post", {'content': 'Live IG text test', 'platforms': ['Instagram'], 'publish_mode': 'live', 'status': 'published'}),
        ("Live Mode rejects YouTube non-video post", {'content': 'Live YT text test', 'platforms': ['YouTube'], 'publish_mode': 'live', 'status': 'published'}),
    ]:
        res = client.post('/api/posts', headers=auth_hdr, json=live_payload)
        assert_test(f"{test_label} (422)", res.status_code == 422)
        err_post = res.get_json()
        assert_test(f"{test_label} saved as 'failed'", err_post.get('status') == 'failed' and err_post.get('publish_mode') == 'live')
        if err_post.get('id'):
            client.delete(f"/api/posts/{err_post['id']}", headers=auth_hdr)

    # Analytics includes separate live_analytics object
    anlt_res = client.get('/api/analytics?range=30d', headers=auth_hdr).get_json()
    assert_test("Analytics includes live_analytics separation block", isinstance(anlt_res.get('live_analytics'), dict) and 'snapshots' in anlt_res['live_analytics'])

    # 11. Security Audit: Strict Auth, IDOR Isolation, OAuth Anti-Replay, XSS & SSRF Guards
    print("\n--- 11. Security Audit & Authorization Hardening ---")
    protected_calls = [
        ('GET', '/api/auth/me'),
        ('PUT', '/api/auth/profile'),
        ('POST', '/api/auth/logout'),
        ('GET', '/api/settings/notifications'),
        ('PUT', '/api/settings/notifications'),
        ('GET', '/api/oauth/config-status'),
        ('GET', '/api/oauth/facebook/start'),
        ('GET', '/api/oauth/meta/pages'),
        ('POST', '/api/oauth/meta/select-page'),
        ('POST', '/api/oauth/facebook/disconnect'),
        ('GET', '/api/accounts'),
        ('POST', f'/api/accounts/{first_acc_id}/toggle'),
        ('POST', f'/api/accounts/{first_acc_id}/sync'),
        ('POST', '/api/accounts/sync-all'),
        ('GET', '/api/posts'),
        ('POST', '/api/posts'),
        ('PUT', '/api/posts/1'),
        ('DELETE', '/api/posts/1'),
        ('GET', '/api/campaigns'),
        ('POST', '/api/campaigns'),
        ('PUT', '/api/campaigns/1'),
        ('DELETE', '/api/campaigns/1'),
        ('GET', '/api/analytics'),
        ('GET', '/api/activity'),
        ('GET', '/api/search?q=a'),
    ]
    unauth_all_401 = all(client.open(path, method=method).status_code == 401 for method, path in protected_calls)
    assert_test("All 25 protected JSON endpoints reject unauthenticated requests with 401", unauth_all_401)
    assert_test("Unauthenticated /api/upload rejected with 401", client.post('/api/upload').status_code == 401)

    for label, bad_tok in [
        ("Rejects legacy local_offline_token", "Bearer local_offline_token"),
        ("Rejects forged JWT-like token", "Bearer forged.invalid.signature"),
    ]:
        bad_res = client.get('/api/accounts', headers={'Authorization': bad_tok})
        assert_test(f"{label} with 401", bad_res.status_code == 401)

    # Horizontal privilege escalation / IDOR isolation (User A vs User B)
    camp_a = client.post('/api/campaigns', headers=auth_hdr, json={'title': 'Private Tenant A Campaign'}).get_json()
    post_a = client.post('/api/posts', headers=auth_hdr, json={
        'content': 'Tenant A secret launch post',
        'platforms': ['Instagram'],
        'status': 'draft',
        'campaign_id': camp_a['id'],
    }).get_json()

    assert_test("User B sees isolated 0 posts from User A", len(client.get('/api/posts', headers=new_auth_hdr).get_json()) == 0)
    assert_test("User B sees isolated 0 campaigns from User A", len(client.get('/api/campaigns', headers=new_auth_hdr).get_json()) == 0)
    assert_test("User B search cannot see User A private content", len(client.get('/api/search?q=Tenant%20A%20secret', headers=new_auth_hdr).get_json().get('posts', [])) == 0)
    assert_test("User B cannot update User A post (404)", client.put(f"/api/posts/{post_a['id']}", headers=new_auth_hdr, json={'content': 'hijacked'}).status_code == 404)
    assert_test("User B cannot delete User A post (404)", client.delete(f"/api/posts/{post_a['id']}", headers=new_auth_hdr).status_code == 404)
    assert_test("User B cannot update User A campaign (404)", client.put(f"/api/campaigns/{camp_a['id']}", headers=new_auth_hdr, json={'title': 'hijacked'}).status_code == 404)
    assert_test("User B cannot delete User A campaign (404)", client.delete(f"/api/campaigns/{camp_a['id']}", headers=new_auth_hdr).status_code == 404)
    assert_test("User B cannot toggle User A account (404)", client.post(f"/api/accounts/{first_acc_id}/toggle", headers=new_auth_hdr).status_code == 404)
    assert_test("User B cannot sync User A account (404)", client.post(f"/api/accounts/{first_acc_id}/sync", headers=new_auth_hdr).status_code == 404)
    assert_test("User B cannot link post to User A campaign (404)", client.post('/api/posts', headers=new_auth_hdr, json={
        'content': 'Cross tenant link attempt',
        'platforms': ['Instagram'],
        'campaign_id': camp_a['id'],
    }).status_code == 404)

    client.delete(f"/api/posts/{post_a['id']}", headers=auth_hdr)
    client.delete(f"/api/campaigns/{camp_a['id']}", headers=auth_hdr)

    # SVG Stored XSS upload rejection + nosniff header check
    svg_payload = io.BytesIO(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    svg_res = client.post('/api/upload', headers=auth_hdr, data={'file': (svg_payload, 'xss.svg')}, content_type='multipart/form-data')
    assert_test("SVG upload rejected to prevent stored XSS (400)", svg_res.status_code == 400)
    if created_uploads:
        up_get = client.get(f"/uploads/{created_uploads[0]}")
        assert_test("Served upload includes X-Content-Type-Options: nosniff", up_get.headers.get('X-Content-Type-Options') == 'nosniff')
        up_get.close()

    # SSRF URL validation checks
    ssrf_blocks_local, _ = _validate_safe_remote_url("http://127.0.0.1:5000/secret")
    ssrf_blocks_meta, _ = _validate_safe_remote_url("http://169.254.169.254/latest/meta-data/")
    ssrf_blocks_file, _ = _validate_safe_remote_url("file:///C:/Windows/win.ini")
    assert_test("SSRF guard rejects loopback, metadata IP, and file:// URLs", not ssrf_blocks_local and not ssrf_blocks_meta and not ssrf_blocks_file)

    # OAuth CSRF single-use state nonce replay check (offline monkeypatched — ZERO external calls)
    old_meta_id = os.environ.get('META_APP_ID')
    old_meta_sec = os.environ.get('META_APP_SECRET')
    orig_exchange_meta = social_manager.exchange_meta_code
    orig_revoke = social_manager.revoke_oauth_connection
    exchange_calls = 0

    def _mock_exchange_meta(prov, code):
        nonlocal exchange_calls
        exchange_calls += 1
        return False, {"error": "Mocked test exchange abort (no external call)."}

    try:
        os.environ['META_APP_ID'] = 'test_meta_app_id_audit'
        os.environ['META_APP_SECRET'] = 'test_meta_secret_audit'
        social_manager.exchange_meta_code = _mock_exchange_meta

        start_res = client.get('/api/oauth/facebook/start', headers=new_auth_hdr)
        assert_test("OAuth start generates authorization URL when configured", start_res.status_code == 200)
        auth_url = start_res.get_json().get('auth_url', '')
        from urllib.parse import urlparse, parse_qs
        state_val = (parse_qs(urlparse(auth_url).query).get('state') or [''])[0]
        assert_test("OAuth start returns non-empty signed state", bool(state_val))

        cb1 = client.get(f"/api/oauth/facebook/callback?code=dummy&state={state_val}")
        assert_test("First OAuth callback consumes state nonce cleanly", exchange_calls == 1 and cb1.status_code == 400)

        cb2 = client.get(f"/api/oauth/facebook/callback?code=dummy&state={state_val}")
        cb2_html = cb2.get_data(as_text=True)
        assert_test("Replayed OAuth state is blocked before provider exchange", exchange_calls == 1 and cb2.status_code == 400 and "replay/CSRF" in cb2_html)
        assert_test("OAuth callback HTML locks postMessage to frontend origin (not '*')", '"*"' not in cb2_html)

        # Disconnect token wipe verification (offline monkeypatched revocation)
        social_manager.revoke_oauth_connection = lambda **kwargs: (True, "Mocked revocation")
        from app import _oauth_aad
        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO oauth_connections (user_id, platform, provider, external_account_id, account_name, encrypted_access_token, encrypted_refresh_token, connected)
            VALUES (?, 'YouTube', 'google', 'ch_test', 'Test Ch', ?, ?, 1)
            ''',
            (
                new_user_id,
                encrypt_token('test_access_secret', aad=_oauth_aad(new_user_id, 'YouTube')),
                encrypt_token('test_refresh_secret', aad=_oauth_aad(new_user_id, 'YouTube')),
            ),
        )
        conn.commit()
        conn.close()

        disc_res = client.post('/api/oauth/youtube/disconnect', headers=new_auth_hdr)
        conn = get_db_connection()
        wiped = conn.execute(
            "SELECT connected, encrypted_access_token, encrypted_refresh_token FROM oauth_connections WHERE user_id = ? AND platform = 'YouTube'",
            (new_user_id,),
        ).fetchone()
        conn.close()
        assert_test(
            "Disconnect wipes encrypted tokens and marks connection inactive",
            disc_res.status_code == 200 and wiped['connected'] == 0 and wiped['encrypted_access_token'] == '' and wiped['encrypted_refresh_token'] is None,
        )

        # --- 12. Security Audit 2 Remediation Verification ---
        print("\n--- 12. Security Hardening Verification (15 Fixes) ---")
        import re
        import tempfile
        import urllib.error
        import social_integrations
        from token_crypto import harden_file_permissions

        # 12A. Upload magic-byte verification, 128-bit randomness & /uploads/ CSP/CORS headers
        fake_png = io.BytesIO(b'#!/bin/sh\necho malicious payload disguised as png\n')
        spoof_res = client.post(
            '/api/upload',
            headers=new_auth_hdr,
            data={'file': (fake_png, 'spoofed.png')},
            content_type='multipart/form-data',
        )
        assert_test("Magic-byte guard rejects spoofed .png payload (400)", spoof_res.status_code == 400)

        sample_up_name = created_uploads[0] if created_uploads else ""
        assert_test(
            "Uploaded filename uses 128-bit hex token",
            bool(re.match(r'^media_[0-9a-f]{32}_sample\.png$', sample_up_name)),
            sample_up_name,
        )
        if sample_up_name:
            up_hdr_res = client.get(f"/uploads/{sample_up_name}", headers={'Origin': 'http://evil.example.com'})
            csp_val = up_hdr_res.headers.get('Content-Security-Policy', '')
            aco_val = up_hdr_res.headers.get('Access-Control-Allow-Origin', '')
            assert_test(
                "Uploads enforce default-src 'none' sandbox CSP and restrict CORS",
                "default-src 'none'" in csp_val and 'sandbox' in csp_val and aco_val != '*',
                f"CSP={csp_val!r}, ACAO={aco_val!r}",
            )
            up_hdr_res.close()

        # 12B. URL scheme validation on profile & post writes
        bad_prof = client.put('/api/auth/profile', headers=new_auth_hdr, json={'avatar': 'javascript:alert(1)'})
        assert_test("Profile rejects javascript: avatar URL (400)", bad_prof.status_code == 400)

        bad_post = client.post(
            '/api/posts',
            headers=new_auth_hdr,
            json={'content': 'XSS URL test', 'platforms': ['Instagram'], 'media_url': 'javascript:alert(1)'},
        )
        assert_test("Post creation rejects javascript: media_url (400)", bad_post.status_code == 400)

        good_draft = client.post(
            '/api/posts',
            headers=new_auth_hdr,
            json={'content': 'URL check post', 'platforms': ['Instagram'], 'status': 'draft'},
        ).get_json()
        bad_put_post = client.put(
            f"/api/posts/{good_draft['id']}",
            headers=new_auth_hdr,
            json={'media_url': 'data:text/html,<script>alert(1)</script>'},
        )
        assert_test("Post update rejects data: media_url (400)", bad_put_post.status_code == 400)
        client.delete(f"/api/posts/{good_draft['id']}", headers=new_auth_hdr)

        # 12C. SSRF redirect + DNS rebinding pinned IP + Google upload session URI guard
        sess_http, _, _ = social_integrations._validate_google_upload_session_url("http://upload.googleapis.com/upload/v1")
        sess_evil, _, _ = social_integrations._validate_google_upload_session_url("https://evil.example.com/upload/v1")
        sess_cred, _, _ = social_integrations._validate_google_upload_session_url("https://user:pass@upload.googleapis.com/upload/v1")
        sess_ip, _, _ = social_integrations._validate_google_upload_session_url("https://127.0.0.1/upload/v1")
        assert_test(
            "YouTube resumable session guard rejects HTTP, untrusted host, creds, and loopback",
            not sess_http and not sess_evil and not sess_cred and not sess_ip,
        )

        orig_getaddrinfo = social_integrations.socket.getaddrinfo
        pinned_ips_seen = []

        class _FakeHeaders:
            def __init__(self, headers_dict):
                self._h = headers_dict
            def get(self, key, default=None):
                return self._h.get(key, default)

        class _FakeResp:
            def __init__(self, status, headers_dict, body=b''):
                self.status = status
                self._headers = headers_dict
                self._body = body
                self._read_done = False
            def getheader(self, name, default=None):
                return self._headers.get(name, default)
            def read(self, n=-1):
                if self._read_done:
                    return b''
                self._read_done = True
                return self._body

        class _FakeConn:
            def __init__(self, meta):
                pinned_ips_seen.append(meta['pinned_ip'])
            def request(self, *args, **kwargs):
                pass
            def getresponse(self):
                return _FakeResp(302, {'Location': 'http://127.0.0.1:5000/internal'})
            def close(self):
                pass

        try:
            social_integrations.socket.getaddrinfo = lambda host, port, *a, **kw: [
                (2, 1, 6, '', ('93.184.216.34' if 'cdn.example.com' in str(host) else '127.0.0.1', port or 443))
            ]
            dl_ok, _, dl_err = social_integrations._download_remote_media_safely(
                "https://cdn.example.com/video.mp4",
                connection_factory=_FakeConn,
            )
            assert_test(
                "SSRF downloader pins validated public IP and blocks redirect to loopback",
                not dl_ok and pinned_ips_seen == ['93.184.216.34'] and ('private or internal' in (dl_err or '').lower() or 'disallowed' in (dl_err or '').lower() or 'loopback' in (dl_err or '').lower()),
                f"dl_ok={dl_ok}, pinned={pinned_ips_seen}, err={dl_err}",
            )
        finally:
            social_integrations.socket.getaddrinfo = orig_getaddrinfo

        # 12D. Meta POST token exchange & sibling-safe granular permission disconnect
        social_manager.exchange_meta_code = orig_exchange_meta
        orig_http_json = social_integrations._http_json
        recorded_meta_calls = []

        def _mock_http_json(method, url, headers=None, params=None, form_data=None, json_body=None, timeout=30):
            recorded_meta_calls.append((method, url, params, form_data))
            if 'oauth/access_token' in url:
                return True, 200, {'access_token': 'mock_fb_tok', 'expires_in': 3600}, None
            if 'me/accounts' in url:
                return True, 200, {'data': []}, None
            return False, 400, {}, 'unexpected call'

        try:
            social_integrations._http_json = _mock_http_json
            social_manager.exchange_meta_code('facebook', 'secret_auth_code_123')
            oauth_calls = [c for c in recorded_meta_calls if 'oauth/access_token' in c[1]]
            meta_post_only = (
                len(oauth_calls) == 2
                and all(c[0] == 'POST' and c[2] is None and isinstance(c[3], dict) for c in oauth_calls)
                and oauth_calls[0][3].get('client_secret') == 'test_meta_secret_audit'
                and oauth_calls[0][3].get('code') == 'secret_auth_code_123'
            )
            assert_test("Meta OAuth token & long-lived upgrade use POST body (never GET params)", meta_post_only)
        finally:
            social_integrations._http_json = orig_http_json

        revoke_calls = []
        def _capture_revoke(**kwargs):
            revoke_calls.append(kwargs)
            return True, "Mocked revocation"

        social_manager.revoke_oauth_connection = _capture_revoke
        conn = get_db_connection()
        for plat, ext_id in [('Facebook', 'fb_page_1'), ('Instagram', 'ig_biz_1')]:
            aad = _oauth_aad(new_user_id, plat)
            conn.execute(
                '''
                INSERT INTO oauth_connections (
                    user_id, platform, provider, external_account_id, account_name,
                    encrypted_access_token, encrypted_user_token, connected
                )
                VALUES (?, ?, 'meta', ?, ?, ?, ?, 1)
                ''',
                (
                    new_user_id,
                    plat,
                    ext_id,
                    f'{plat} Test',
                    encrypt_token(f'{plat}_page_tok', aad=aad),
                    encrypt_token('test_meta_user_tok', aad=aad),
                ),
            )
        conn.commit()
        conn.close()

        client.post('/api/oauth/facebook/disconnect', headers=new_auth_hdr)
        conn = get_db_connection()
        ig_still = conn.execute(
            "SELECT connected FROM oauth_connections WHERE user_id = ? AND platform = 'Instagram' AND provider = 'meta'",
            (new_user_id,),
        ).fetchone()
        conn.close()
        assert_test(
            "Disconnecting Facebook revokes only pages_manage_posts while sibling Instagram stays active",
            len(revoke_calls) == 1
            and revoke_calls[0].get('permission_name') == 'pages_manage_posts'
            and revoke_calls[0].get('user_access_token') == 'test_meta_user_tok'
            and ig_still and ig_still['connected'] == 1,
        )

        client.post('/api/oauth/instagram/disconnect', headers=new_auth_hdr)
        assert_test(
            "Disconnecting final Meta platform performs full permission revocation",
            len(revoke_calls) == 2 and revoke_calls[1].get('permission_name') is None,
        )

        # 12E. YouTube reactive 401 refresh + untrusted Location rejection
        tmp_vid = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        tmp_vid.write(b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom')
        tmp_vid.close()

        orig_urlopen = social_integrations.urllib.request.urlopen
        orig_pinned_https = social_integrations._PinnedHTTPSConnection
        orig_refresh_google = social_manager.refresh_google_access_token
        orig_resolve_safe = social_integrations._resolve_and_validate_safe_url
        put_attempts = []
        refreshed_tokens_saved = []

        class _MockInitResp:
            def __init__(self, location):
                self.headers = {'Location': location}
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False

        class _MockPinnedPutConn:
            def __init__(self, hostname, port, pinned_ip, timeout=300):
                self.hostname = hostname
            def putrequest(self, method, path_query):
                put_attempts.append((self.hostname, method, path_query))
            def putheader(self, k, v):
                pass
            def endheaders(self):
                pass
            def send(self, chunk):
                pass
            def getresponse(self):
                return _FakeResp(200, {}, b'{"id": "yt_video_123"}')
            def close(self):
                pass

        try:
            init_count = {'n': 0}
            def _mock_urlopen_401(req, timeout=30):
                init_count['n'] += 1
                if init_count['n'] == 1:
                    raise urllib.error.HTTPError(req.full_url, 401, 'Unauthorized', {}, io.BytesIO(b'{"error":{"message":"Invalid Credentials"}}'))
                return _MockInitResp('https://upload.googleapis.com/upload/youtube/v3/videos?upload_id=ok')

            social_integrations.urllib.request.urlopen = _mock_urlopen_401
            social_integrations._PinnedHTTPSConnection = _MockPinnedPutConn
            social_integrations._resolve_and_validate_safe_url = lambda u: (
                True,
                "",
                {'scheme': 'https', 'hostname': 'upload.googleapis.com', 'netloc': 'upload.googleapis.com', 'port': 443, 'path_query': '/upload/youtube/v3/videos?upload_id=ok', 'pinned_ip': '142.250.1.1'},
            )
            social_manager.refresh_google_access_token = lambda rt: (True, {'access_token': 'new_yt_tok', 'expires_at': '2099-01-01 00:00:00'})

            yt_ok_res = social_manager.publish_live_youtube(
                access_token='expired_yt_tok',
                refresh_token='yt_refresh_tok',
                expires_at='2099-01-01 00:00:00',
                content='Video desc',
                media_type='video',
                local_file_path=tmp_vid.name,
                token_refresh_cb=lambda tok, exp, rt: refreshed_tokens_saved.append(tok),
            )
            assert_test(
                "YouTube reactive 401 refreshes token, invokes persist callback, and completes upload",
                yt_ok_res.get('success') is True and yt_ok_res.get('external_post_id') == 'yt_video_123' and refreshed_tokens_saved == ['new_yt_tok'],
            )

            put_attempts.clear()
            social_integrations.urllib.request.urlopen = lambda req, timeout=30: _MockInitResp('https://evil.example.com/steal-token')
            yt_bad_loc = social_manager.publish_live_youtube(
                access_token='valid_yt_tok',
                refresh_token='yt_refresh_tok',
                expires_at='2099-01-01 00:00:00',
                content='Video desc',
                media_type='video',
                local_file_path=tmp_vid.name,
            )
            assert_test(
                "YouTube rejects untrusted upload Location URI before PUTting bearer token",
                yt_bad_loc.get('success') is False and len(put_attempts) == 0,
            )
        finally:
            social_integrations.urllib.request.urlopen = orig_urlopen
            social_integrations._PinnedHTTPSConnection = orig_pinned_https
            social_integrations._resolve_and_validate_safe_url = orig_resolve_safe
            social_manager.refresh_google_access_token = orig_refresh_google
            if os.path.exists(tmp_vid.name):
                os.remove(tmp_vid.name)

        # 12F. Popup origin matching & OAuth redirect URL query hygiene
        origin_start = client.get('/api/oauth/facebook/start?origin=http://127.0.0.1:5173', headers=new_auth_hdr)
        origin_auth_url = origin_start.get_json().get('auth_url', '')
        origin_state = (parse_qs(urlparse(origin_auth_url).query).get('state') or [''])[0]
        cb_origin = client.get(f"/api/oauth/facebook/callback?error=access_denied&error_description=User+cancelled&state={origin_state}")
        cb_origin_html = cb_origin.get_data(as_text=True)
        assert_test(
            "Popup callback targets exact allowed opener origin and omits error details from redirect query string",
            '"http://127.0.0.1:5173"' in cb_origin_html
            and 'http://127.0.0.1:5173/?oauth_status=error"' in cb_origin_html
            and 'oauth_message=' not in cb_origin_html,
        )

        # 12F-2. OAuth Callback Reflected XSS & State Validation Guards
        import json as _json
        import re as _re
        from urllib.parse import quote as _url_quote
        from app import _render_oauth_callback_html as _render_cb

        xss_probe = "</script><script>alert(1)</script>&<img src=x onerror=alert(2)>"
        xss_encoded = _url_quote(xss_probe, safe="")

        def _has_callback_security_headers(resp):
            csp = resp.headers.get("Content-Security-Policy", "")
            return (
                resp.headers.get("X-Frame-Options") == "DENY"
                and resp.headers.get("X-Content-Type-Options") == "nosniff"
                and resp.headers.get("Referrer-Policy") == "no-referrer"
                and resp.headers.get("Cache-Control") == "no-store"
                and "default-src 'none'" in csp
                and "script-src 'nonce-" in csp
                and "style-src 'nonce-" in csp
                and "frame-ancestors 'none'" in csp
                and "'unsafe-inline'" not in csp
            )

        # (a) Missing state with injected error/error_description reflects nothing and sets security headers
        cb_missing_state = client.get(
            f"/api/oauth/facebook/callback?error={xss_encoded}&error_description={xss_encoded}"
        )
        cb_missing_html = cb_missing_state.get_data(as_text=True)
        assert_test(
            "Missing OAuth state returns generic error, blocks XSS reflection, and sends CSP/XFO headers",
            cb_missing_state.status_code == 400
            and "OAuth state replay/CSRF" in cb_missing_html
            and "alert(1)" not in cb_missing_html
            and "alert(2)" not in cb_missing_html
            and "<img src=x" not in cb_missing_html
            and _has_callback_security_headers(cb_missing_state),
        )

        # (b) Tampered/invalid state with injected error payload returns generic error without reflection
        cb_bad_state = client.get(
            f"/api/oauth/facebook/callback?state=tampered.invalid.state&error={xss_encoded}&error_description={xss_encoded}"
        )
        cb_bad_html = cb_bad_state.get_data(as_text=True)
        assert_test(
            "Invalid OAuth state returns generic error and ignores attacker error parameters",
            cb_bad_state.status_code == 400
            and "OAuth state replay/CSRF" in cb_bad_html
            and "alert(1)" not in cb_bad_html
            and "alert(2)" not in cb_bad_html
            and _has_callback_security_headers(cb_bad_state),
        )

        # (c) Valid fresh state consumes nonce and safely serializes error payload inside JSON script + CSP nonce
        xss_start = client.get('/api/oauth/facebook/start?origin=http://127.0.0.1:5173', headers=new_auth_hdr)
        xss_auth_url = xss_start.get_json().get('auth_url', '')
        xss_state = (parse_qs(urlparse(xss_auth_url).query).get('state') or [''])[0]
        cb_xss_valid = client.get(
            f"/api/oauth/facebook/callback?error=access_denied&error_description={xss_encoded}&state={xss_state}"
        )
        cb_xss_html = cb_xss_valid.get_data(as_text=True)

        json_block_match = _re.search(
            r'<script id="oauth-callback-data" type="application/json">(.*?)</script>',
            cb_xss_html,
            _re.DOTALL,
        )
        exec_nonce_match = _re.search(r'<script nonce="([^"]+)">', cb_xss_html)
        csp_header_val = cb_xss_valid.headers.get("Content-Security-Policy", "")
        csp_nonce_match = _re.search(r"script-src 'nonce-([^']+)'", csp_header_val)

        parsed_cb_config = _json.loads(json_block_match.group(1)) if json_block_match else {}
        json_raw_text = json_block_match.group(1) if json_block_match else ""

        # Verify nonce was consumed by immediately replaying the same state with XSS payload
        cb_replay_xss = client.get(
            f"/api/oauth/facebook/callback?error={xss_encoded}&error_description={xss_encoded}&state={xss_state}"
        )
        cb_replay_html = cb_replay_xss.get_data(as_text=True)

        assert_test(
            "Valid OAuth callback escapes HTML/JSON safely, binds CSP nonce, and consumes state before error handling",
            cb_xss_valid.status_code == 400
            and "<script>alert(1)</script>" not in cb_xss_html
            and "<img src=x" not in cb_xss_html
            and "&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;" in cb_xss_html
            and bool(json_block_match)
            and "\\u003c" in json_raw_text
            and "\\u003e" in json_raw_text
            and "\\u0026" in json_raw_text
            and "<" not in json_raw_text
            and ">" not in json_raw_text
            and "&" not in json_raw_text
            and parsed_cb_config.get("targetOrigin") == "http://127.0.0.1:5173"
            and "alert(1)" in parsed_cb_config.get("payload", {}).get("error", "")
            and bool(exec_nonce_match and csp_nonce_match and exec_nonce_match.group(1) == csp_nonce_match.group(1))
            and _has_callback_security_headers(cb_xss_valid)
            and cb_replay_xss.status_code == 400
            and "OAuth state replay/CSRF" in cb_replay_html
            and "alert(1)" not in cb_replay_html,
        )

        # (d) Direct unit test of _render_oauth_callback_html escaping
        from app import app as _flask_app
        with _flask_app.app_context():
            unit_resp = _render_cb(
                False,
                f"Msg {xss_probe}",
                platforms=[{"name": "A</script><script>x</script>&'\""}],
                error=f"Err {xss_probe}",
                target_origin="http://127.0.0.1:5173",
            )
        unit_html = unit_resp.get_data(as_text=True)
        unit_json_match = _re.search(
            r'<script id="oauth-callback-data" type="application/json">(.*?)</script>',
            unit_html,
            _re.DOTALL,
        )
        unit_json_raw = unit_json_match.group(1) if unit_json_match else ""
        unit_parsed = _json.loads(unit_json_raw) if unit_json_match else {}
        assert_test(
            "_render_oauth_callback_html escapes <, >, &, quotes and prevents </script> breakout",
            unit_resp.status_code == 400
            and "<script>alert(1)</script>" not in unit_html
            and "<script>x</script>" not in unit_html
            and "&lt;/script&gt;" in unit_html
            and "\\u003c" in unit_json_raw
            and "\\u003e" in unit_json_raw
            and "\\u0026" in unit_json_raw
            and "\\u0027" in unit_json_raw
            and "<" not in unit_json_raw
            and ">" not in unit_json_raw
            and "&" not in unit_json_raw
            and unit_parsed.get("payload", {}).get("message") == f"Msg {xss_probe}"
            and unit_parsed.get("targetOrigin") == "http://127.0.0.1:5173"
            and _has_callback_security_headers(unit_resp),
        )

        # 12G. Standalone token_crypto string AAD & temp-file permission hardening
        str_ct = encrypt_token("standalone_secret_val", aad="user:99:str-aad")
        assert_test("token_crypto accepts string AAD cleanly", decrypt_token(str_ct, aad="user:99:str-aad") == "standalone_secret_val")

        acl_tmp = tempfile.NamedTemporaryFile(prefix='ss_acl_test_', delete=False)
        acl_tmp.write(b'ephemeral acl test')
        acl_tmp.close()
        try:
            acl_ok = harden_file_permissions(acl_tmp.name)
            assert_test("harden_file_permissions succeeds on newly created secret file", acl_ok is True)
        finally:
            if os.path.exists(acl_tmp.name):
                os.remove(acl_tmp.name)

        # 12I. Automated Scheduled Publishing Worker (Sandbox + Live Failure Separation)
        from app import process_due_scheduled_posts
        past_due = (datetime.now() - timedelta(minutes=2)).strftime('%Y-%m-%d %H:%M:%S')
        sched_sbx_res = client.post(
            '/api/posts',
            headers=new_auth_hdr,
            json={
                'content': 'Scheduled Sandbox smoke post',
                'platforms': ['Facebook'],
                'status': 'scheduled',
                'scheduled_for': past_due,
                'publish_mode': 'sandbox',
            },
        )
        sched_live_res = client.post(
            '/api/posts',
            headers=new_auth_hdr,
            json={
                'content': 'Scheduled Live unconfigured post',
                'platforms': ['Facebook'],
                'status': 'scheduled',
                'scheduled_for': past_due,
                'publish_mode': 'live',
            },
        )
        sched_sbx_id = sched_sbx_res.get_json().get('id')
        sched_live_id = sched_live_res.get_json().get('id')

        processed_cnt = process_due_scheduled_posts()
        conn = get_db_connection()
        sbx_row = conn.execute('SELECT status, publish_mode FROM posts WHERE id = ?', (sched_sbx_id,)).fetchone()
        live_row = conn.execute('SELECT status, publish_mode, error_message FROM posts WHERE id = ?', (sched_live_id,)).fetchone()
        conn.close()
        assert_test(
            "Scheduler processes due Sandbox post as published and due disconnected Live post as failed",
            processed_cnt >= 2
            and sbx_row and sbx_row['status'] == 'published' and sbx_row['publish_mode'] == 'sandbox'
            and live_row and live_row['status'] == 'failed' and bool(live_row['error_message']),
            f"processed={processed_cnt}, sbx={dict(sbx_row) if sbx_row else None}, live={dict(live_row) if live_row else None}",
        )

        # 12G-2. Dual Operating Modes (Dummy Demo Mode vs Live Server Mode) isolation & persistence
        mode_get_res = client.get('/api/settings/mode', headers=new_auth_hdr)
        assert_test(
            "GET /api/settings/mode defaults new user to 'demo' mode",
            mode_get_res.status_code == 200 and mode_get_res.get_json().get('app_mode') == 'demo',
            f"status={mode_get_res.status_code}, data={mode_get_res.get_json()}",
        )

        mode_live_res = client.put('/api/settings/mode', headers=new_auth_hdr, json={'app_mode': 'live'})
        mode_bad_res = client.put('/api/settings/mode', headers=new_auth_hdr, json={'app_mode': 'invalid'})
        mode_demo_res = client.put('/api/settings/mode', headers=new_auth_hdr, json={'app_mode': 'demo'})
        assert_test(
            "PUT /api/settings/mode persists valid switches and rejects invalid values",
            mode_live_res.status_code == 200
            and mode_live_res.get_json().get('app_mode') == 'live'
            and mode_bad_res.status_code == 400
            and mode_demo_res.status_code == 200
            and mode_demo_res.get_json().get('app_mode') == 'demo',
        )

        demo_accs_res = client.get('/api/accounts?workspace_mode=demo', headers=new_auth_hdr)
        demo_posts_res = client.get('/api/posts?workspace_mode=demo', headers=new_auth_hdr)
        demo_camps_res = client.get('/api/campaigns?workspace_mode=demo', headers=new_auth_hdr)
        demo_acts_res = client.get('/api/activity?workspace_mode=demo', headers=new_auth_hdr)
        demo_anlt_res = client.get('/api/analytics?range=30d&workspace_mode=demo', headers=new_auth_hdr)
        live_posts_res = client.get('/api/posts?workspace_mode=live', headers=new_auth_hdr)
        live_anlt_res = client.get('/api/analytics?range=7d&workspace_mode=live', headers=new_auth_hdr)

        demo_accs_data = demo_accs_res.get_json() or []
        demo_posts_data = demo_posts_res.get_json() or []
        demo_camps_data = demo_camps_res.get_json() or []
        demo_acts_data = demo_acts_res.get_json() or []
        demo_anlt_data = demo_anlt_res.get_json() or {}
        live_anlt_data = live_anlt_res.get_json() or {}

        assert_test(
            "Demo workspace lazily seeds realistic accounts, posts, campaigns, activity, and analytics cleanly separated from Live",
            len(demo_accs_data) >= 6
            and any(a['platform'] == 'Instagram' and a['followers'] > 0 and a.get('demo_connected') for a in demo_accs_data)
            and len(demo_posts_data) >= 4
            and len(demo_camps_data) >= 3
            and len(demo_acts_data) >= 3
            and demo_anlt_data.get('workspace_mode') == 'demo'
            and demo_anlt_data.get('summary', {}).get('total_followers', 0) > 0
            and live_anlt_data.get('workspace_mode') == 'live'
            and live_anlt_data.get('live_analytics', {}).get('oauth_required') is True,
            f"demo_accs={len(demo_accs_data)}, demo_posts={len(demo_posts_data)}, live_oauth_req={live_anlt_data.get('live_analytics', {}).get('oauth_required')}",
        )

        # Create, Demo Publish, Edit, Reschedule & Delete in Demo Mode; confirm Live stays untouched
        live_count_before = len(live_posts_res.get_json() or [])
        demo_pub_res = client.post(
            '/api/posts',
            headers=new_auth_hdr,
            json={
                'workspace_mode': 'demo',
                'content': 'Demo Publish isolation check post #DemoSync',
                'platforms': ['Instagram', 'YouTube'],
                'status': 'published',
                'publish_mode': 'demo',
            },
        )
        demo_pub_data = demo_pub_res.get_json() or {}
        demo_pub_id = demo_pub_data.get('id')
        live_count_after = len(client.get('/api/posts?workspace_mode=live', headers=new_auth_hdr).get_json() or [])
        assert_test(
            "Creating Demo Published post labels simulated results as 'Demo Published' and keeps Live posts untouched",
            demo_pub_res.status_code == 201
            and demo_pub_data.get('workspace_mode') == 'demo'
            and demo_pub_data.get('publish_mode') == 'demo'
            and any(r.get('label') == 'Demo Published' for r in (demo_pub_data.get('publish_results') or []))
            and live_count_after == live_count_before,
        )

        # Cross-workspace edit block + Demo edit/delete persistence
        cross_edit_res = client.put(
            f'/api/posts/{demo_pub_id}?workspace_mode=live',
            headers=new_auth_hdr,
            json={'workspace_mode': 'live', 'content': 'Cross mode attempt'},
        )
        demo_edit_res = client.put(
            f'/api/posts/{demo_pub_id}?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo', 'content': 'Updated Demo Post Content'},
        )
        demo_search_res = client.get('/api/search?workspace_mode=demo&q=Updated%20Demo%20Post', headers=new_auth_hdr)
        demo_del_res = client.delete(f'/api/posts/{demo_pub_id}?workspace_mode=demo', headers=new_auth_hdr)
        demo_search_after = client.get('/api/search?workspace_mode=demo&q=Updated%20Demo%20Post', headers=new_auth_hdr)

        assert_test(
            "Cross-workspace edit is blocked (404) while Demo CRUD & Search persist properly",
            cross_edit_res.status_code == 404
            and demo_edit_res.status_code == 200
            and len((demo_search_res.get_json() or {}).get('posts') or []) == 1
            and demo_del_res.status_code == 200
            and len((demo_search_after.get_json() or {}).get('posts') or []) == 0,
        )

        # Explicit Live sync without OAuth returns honest OAuth Setup Required; Demo sync succeeds
        live_accs = client.get('/api/accounts?workspace_mode=live', headers=new_auth_hdr).get_json() or []
        live_ig_id = next((a['id'] for a in live_accs if a['platform'] == 'Instagram'), None)
        demo_ig_id = next((a['id'] for a in demo_accs_data if a['platform'] == 'Instagram'), None)
        live_sync_res = client.post(
            f'/api/accounts/{live_ig_id}/sync?workspace_mode=live',
            headers=new_auth_hdr,
            json={'workspace_mode': 'live'},
        )
        demo_sync_res = client.post(
            f'/api/accounts/{demo_ig_id}/sync?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo'},
        )
        assert_test(
            "Explicit Live sync returns honest OAuth Setup Required while Demo sync updates demo metrics",
            live_sync_res.status_code == 400
            and 'OAuth Setup Required' in (live_sync_res.get_json() or {}).get('error', '')
            and demo_sync_res.status_code == 200
            and (demo_sync_res.get_json() or {}).get('account', {}).get('mode') == 'demo',
            f"live_status={live_sync_res.status_code}, demo_status={demo_sync_res.status_code}",
        )

        # 12G.2 Dummy Demo Mode Persistence, Dynamic Analytics & Notifications
        me_check = client.get('/api/auth/me', headers=new_auth_hdr).get_json() or {}
        demo_accs_repeat = client.get('/api/accounts?workspace_mode=demo', headers=new_auth_hdr).get_json() or []
        demo_posts_repeat_1 = client.get('/api/posts?workspace_mode=demo', headers=new_auth_hdr).get_json() or []
        demo_posts_repeat_2 = client.get('/api/posts?workspace_mode=demo', headers=new_auth_hdr).get_json() or []
        demo_camps_repeat_1 = client.get('/api/campaigns?workspace_mode=demo', headers=new_auth_hdr).get_json() or []
        demo_camps_repeat_2 = client.get('/api/campaigns?workspace_mode=demo', headers=new_auth_hdr).get_json() or []
        assert_test(
            "Demo seeding is idempotent without duplicate records and /api/auth/me exposes app_mode",
            me_check.get('app_mode') in ('demo', 'live')
            and len(demo_accs_repeat) == 6
            and len(demo_posts_repeat_1) == len(demo_posts_repeat_2)
            and len(demo_camps_repeat_1) == len(demo_camps_repeat_2) == 3,
        )

        # Toggle account & capture analytics baseline before Demo Publish/Campaign lifecycle
        toggle_demo_res = client.post(
            f'/api/accounts/{demo_ig_id}/toggle?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo'},
        )
        an_before = client.get('/api/analytics?workspace_mode=demo&range=7d', headers=new_auth_hdr).get_json() or {}
        reach_before = (an_before.get('summary') or {}).get('total_reach', 0)

        # Campaign -> linked Demo Publish -> Delete linked post -> Campaign reach drops back to 0 -> Edit -> Delete
        camp_res = client.post(
            '/api/campaigns?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo', 'title': 'Demo QA Campaign', 'target_reach': 100000, 'budget': '$2,500'},
        )
        camp_id = (camp_res.get_json() or {}).get('id')
        sched_res = client.post(
            '/api/posts?workspace_mode=demo',
            headers=new_auth_hdr,
            json={
                'workspace_mode': 'demo',
                'publish_mode': 'demo',
                'campaign_id': camp_id,
                'content': 'Demo Scheduled Announcement',
                'platforms': ['Instagram'],
                'status': 'scheduled',
                'scheduled_for': '2026-12-01 10:00:00',
            },
        )
        sched_id = (sched_res.get_json() or {}).get('id')
        resched_res = client.put(
            f'/api/posts/{sched_id}?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo', 'status': 'scheduled', 'scheduled_for': '2026-12-03 14:30:00'},
        )
        pub_camp_res = client.put(
            f'/api/posts/{sched_id}?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo', 'status': 'published', 'publish_mode': 'demo'},
        )
        camp_mid = next(
            (c for c in (client.get('/api/campaigns?workspace_mode=demo', headers=new_auth_hdr).get_json() or []) if c['id'] == camp_id),
            {},
        )
        an_mid = client.get('/api/analytics?workspace_mode=demo&range=7d', headers=new_auth_hdr).get_json() or {}
        reach_mid = (an_mid.get('summary') or {}).get('total_reach', 0)
        hist_mid = an_mid.get('history') or []
        hist_sum_mid = sum(h.get('reach', 0) for h in hist_mid)

        del_linked_res = client.delete(f'/api/posts/{sched_id}?workspace_mode=demo', headers=new_auth_hdr)
        camp_after_del = next(
            (c for c in (client.get('/api/campaigns?workspace_mode=demo', headers=new_auth_hdr).get_json() or []) if c['id'] == camp_id),
            {},
        )
        an_after = client.get('/api/analytics?workspace_mode=demo&range=7d', headers=new_auth_hdr).get_json() or {}
        reach_after = (an_after.get('summary') or {}).get('total_reach', 0)

        edit_camp_res = client.put(
            f'/api/campaigns/{camp_id}?workspace_mode=demo',
            headers=new_auth_hdr,
            json={'workspace_mode': 'demo', 'title': 'Demo QA Campaign Updated', 'status': 'completed', 'target_reach': 120000},
        )
        del_camp_res = client.delete(f'/api/campaigns/{camp_id}?workspace_mode=demo', headers=new_auth_hdr)
        demo_act_titles = [
            a.get('title') for a in (client.get('/api/activity?workspace_mode=demo', headers=new_auth_hdr).get_json() or [])
        ]

        assert_test(
            "Demo Campaign reach, Analytics 7d curve, and Post/Campaign delete stay dynamically synchronized",
            camp_res.status_code == 201
            and sched_res.status_code == 201
            and resched_res.status_code == 200
            and pub_camp_res.status_code == 200
            and (camp_mid.get('current_reach') or 0) > 0
            and reach_mid > reach_before
            and len(hist_mid) == 7
            and abs(hist_sum_mid - reach_mid) <= 50
            and del_linked_res.status_code == 200
            and camp_after_del.get('current_reach') == 0
            and reach_after == reach_before
            and edit_camp_res.status_code == 200
            and del_camp_res.status_code == 200,
            f"reach_before={reach_before}, reach_mid={reach_mid}, hist_sum={hist_sum_mid}, camp_after_del={camp_after_del.get('current_reach')}, reach_after={reach_after}",
        )
        assert_test(
            "Demo Activity notifications record Sync, Toggle, Reschedule, Publish, Delete, and Campaign edits",
            toggle_demo_res.status_code == 200
            and any('Instagram' in (t or '') and ('Paused' in t or 'Connected' in t) for t in demo_act_titles)
            and any('Instagram Synced' in (t or '') for t in demo_act_titles)
            and 'Demo Post Rescheduled' in demo_act_titles
            and 'Demo Published' in demo_act_titles
            and 'Demo Post Deleted' in demo_act_titles
            and 'Demo Campaign Updated' in demo_act_titles
            and 'Demo Campaign Deleted' in demo_act_titles,
            f"titles={demo_act_titles}",
        )

        # 12H. Server-side token revocation (POST /api/auth/logout) & rate limiting (429)
        logout_res = client.post('/api/auth/logout', headers=new_auth_hdr)
        revoked_me = client.get('/api/auth/me', headers=new_auth_hdr)
        assert_test(
            "POST /api/auth/logout increments token_version and invalidates prior bearer token",
            logout_res.status_code == 200 and revoked_me.status_code == 401,
        )

        rl_login_codes = []
        rl_login_retry = None
        for idx in range(9):
            rl_r = client.post(
                '/api/auth/login',
                json={'email': 'ratelimit_probe@example.com', 'password': f'wrong_{idx}'},
                environ_base={'REMOTE_ADDR': '203.0.113.50'},
            )
            rl_login_codes.append(rl_r.status_code)
            if rl_r.status_code == 429:
                rl_login_retry = rl_r.headers.get('Retry-After')

        rl_reg_codes = []
        rl_reg_retry = None
        for idx in range(11):
            rl_rg = client.post(
                '/api/auth/register',
                json={'name': 'RL', 'email': 'bad-email', 'password': '123'},
                environ_base={'REMOTE_ADDR': '203.0.113.51'},
            )
            rl_reg_codes.append(rl_rg.status_code)
            if rl_rg.status_code == 429:
                rl_reg_retry = rl_rg.headers.get('Retry-After')

        assert_test(
            "Login rate limiter triggers 429 + Retry-After after repeated failed attempts",
            rl_login_codes[:8].count(401) == 8 and rl_login_codes[8] == 429 and bool(rl_login_retry),
            f"codes={rl_login_codes}",
        )
        assert_test(
            "Register rate limiter triggers 429 + Retry-After after burst threshold",
            rl_reg_codes[10] == 429 and bool(rl_reg_retry),
            f"codes={rl_reg_codes}",
        )
    finally:
        social_manager.exchange_meta_code = orig_exchange_meta
        social_manager.revoke_oauth_connection = orig_revoke
        if old_meta_id is None:
            os.environ.pop('META_APP_ID', None)
        else:
            os.environ['META_APP_ID'] = old_meta_id
        if old_meta_sec is None:
            os.environ.pop('META_APP_SECRET', None)
        else:
            os.environ['META_APP_SECRET'] = old_meta_sec

        # Clean up test uploaded files & temporary test user rows so DB stays pristine
        upload_dir = app.config['UPLOAD_FOLDER']
        for fname in created_uploads:
            fpath = os.path.join(upload_dir, fname)
            if os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                except OSError:
                    pass
        if new_user_id:
            conn = get_db_connection()
            conn.execute('DELETE FROM oauth_connections WHERE user_id = ?', (new_user_id,))
            conn.execute('DELETE FROM oauth_states WHERE user_id = ?', (new_user_id,))
            conn.execute('DELETE FROM social_accounts WHERE user_id = ?', (new_user_id,))
            conn.execute('DELETE FROM activity WHERE user_id = ?', (new_user_id,))
            conn.execute('DELETE FROM posts WHERE user_id = ?', (new_user_id,))
            conn.execute('DELETE FROM campaigns WHERE user_id = ?', (new_user_id,))
            conn.execute('DELETE FROM users WHERE id = ?', (new_user_id,))
            conn.commit()
            conn.close()

    print("\n==================================================")
    print(f"TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("==================================================")
    return failed == 0

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)

