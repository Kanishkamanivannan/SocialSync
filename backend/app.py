import os
import json
import time
import secrets
import threading
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlparse, urlencode
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature

from env_loader import load_env_file
from database import get_db_connection, init_db, ensure_user_social_accounts
from token_crypto import encrypt_token, decrypt_token, get_runtime_secret, redact_secrets
from social_integrations import (
    social_manager,
    get_oauth_config_status,
    get_frontend_url,
    get_oauth_redirect_base,
)

load_env_file()

app = Flask(__name__)
# Secret key for cryptographically signed tokens (persisted runtime CSPRNG if env unset)
app.config['SECRET_KEY'] = get_runtime_secret('SECRET_KEY')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 256 * 1024 * 1024  # 256 MB max upload (supports videos)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def _extract_origin(url):
    parsed = urlparse((url or '').strip())
    if parsed.scheme in ('http', 'https') and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return None


def _get_allowed_cors_origins():
    candidates = [
        _extract_origin(get_frontend_url()),
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    origins = []
    for item in candidates:
        if item and item not in origins:
            origins.append(item)
    return origins


# Restrict API & upload CORS to trusted frontend origins
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": _get_allowed_cors_origins(),
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        },
        r"/uploads/*": {
            "origins": _get_allowed_cors_origins(),
            "methods": ["GET", "OPTIONS"],
        },
    },
)

# Ensure database exists on startup
init_db()

# Token Serializer
token_serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# Thread-safe in-memory sliding-window rate limiter for auth routes
_rate_limit_lock = threading.Lock()
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)


def _get_client_ip() -> str:
    return (request.remote_addr or 'unknown').strip() or 'unknown'


def _check_rate_limit(key: str, max_attempts: int, window_seconds: int, record: bool = True) -> tuple[bool, int]:
    """Checks sliding-window attempts for `key` and returns (allowed, retry_after_seconds)."""
    now = time.monotonic()
    cutoff = now - window_seconds
    with _rate_limit_lock:
        dq = _rate_limit_buckets[key]
        while dq and dq[0] <= cutoff:
            dq.popleft()
        if len(dq) >= max_attempts:
            retry_after = max(1, int(dq[0] + window_seconds - now) + 1)
            return False, retry_after
        if record:
            dq.append(now)
    return True, 0


def _clear_rate_limit(key: str) -> None:
    with _rate_limit_lock:
        _rate_limit_buckets.pop(key, None)


def _is_safe_web_url(url: str | None, allow_relative_upload: bool = False) -> bool:
    """Validates that external URLs use only http:// or https:// with no control characters."""
    if not url or not isinstance(url, str):
        return False
    cleaned = url.strip()
    if not cleaned or any(ch in cleaned for ch in ('\r', '\n', '\x00')):
        return False
    if allow_relative_upload and cleaned.startswith('/uploads/') and '..' not in cleaned:
        return True
    parsed = urlparse(cleaned)
    return parsed.scheme.lower() in ('http', 'https') and bool(parsed.netloc)


def generate_token(user_id, token_version=1):
    """Generates a cryptographically signed token bound to the user's current token_version."""
    return token_serializer.dumps({'user_id': int(user_id), 'tv': int(token_version or 1)})


def get_current_user_from_token():
    """Extracts and verifies the user and active token_version from the Bearer token."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ', 1)[1].strip()
    if not token or token == 'local_offline_token':
        return None
    try:
        data = token_serializer.loads(token, max_age=86400 * 7)  # 7 days
        user_id = data.get('user_id') if isinstance(data, dict) else None
        token_ver = data.get('tv') if isinstance(data, dict) else None
        if not user_id or token_ver is None:
            return None
    except (SignatureExpired, BadTimeSignature, Exception):
        return None

    conn = get_db_connection()
    try:
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return None
        db_ver = user['token_version'] if 'token_version' in user.keys() and user['token_version'] is not None else 1
        if int(token_ver) != int(db_ver):
            return None
        return dict(user)
    finally:
        conn.close()

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user_from_token()
        if not user:
            return jsonify({"success": False, "message": "Unauthorized. Please sign in."}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def _oauth_aad(user_id, platform):
    """Associated authenticated data binding ciphertext to tenant user_id and platform."""
    return f"socialsync:oauth:{int(user_id)}:{str(platform or '').strip().lower()}".encode("utf-8")


IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
VIDEO_EXTENSIONS = {'mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


def _detect_media_type(media_url, explicit_type=None):
    if explicit_type in ('text', 'image', 'video'):
        if explicit_type != 'text' and not media_url:
            return 'text'
        return explicit_type
    if not media_url:
        return 'text'
    parsed_path = urlparse(media_url).path.lower()
    ext = parsed_path.rsplit('.', 1)[-1] if '.' in parsed_path else ''
    if ext in VIDEO_EXTENSIONS:
        return 'video'
    return 'image'


def _resolve_local_upload_path(media_url):
    if not media_url or '/uploads/' not in media_url:
        return None
    raw_name = media_url.split('/uploads/', 1)[1].split('?', 1)[0]
    safe_name = secure_filename(raw_name)
    if not safe_name:
        return None
    upload_dir = os.path.abspath(app.config['UPLOAD_FOLDER'])
    candidate = os.path.abspath(os.path.join(upload_dir, safe_name))
    if not candidate.startswith(upload_dir + os.sep):
        return None
    return candidate if os.path.isfile(candidate) else None


def _serialize_post(post_row):
    item = dict(post_row)
    try:
        item['platforms'] = json.loads(item['platforms'])
    except Exception:
        item['platforms'] = [item['platforms']] if item.get('platforms') else []

    raw_results = item.get('publish_results')
    if isinstance(raw_results, str) and raw_results.strip():
        try:
            item['publish_results'] = json.loads(raw_results)
        except Exception:
            item['publish_results'] = []
    elif not raw_results:
        item['publish_results'] = []
    return item


def _get_active_oauth_connection(conn, platform_name, user_id):
    if not user_id:
        return None
    row = conn.execute(
        '''
        SELECT * FROM oauth_connections
        WHERE platform = ? AND user_id = ? AND connected = 1
        ORDER BY updated_at DESC, id DESC LIMIT 1
        ''',
        (platform_name, int(user_id)),
    ).fetchone()
    return dict(row) if row else None


def _persist_refreshed_oauth_tokens(
    conn, oauth_conn_id, user_id, platform, new_access_token, new_expires_at, new_refresh_token=None
):
    aad = _oauth_aad(user_id, platform)
    enc_access = encrypt_token(new_access_token, aad=aad)
    if new_refresh_token:
        enc_refresh = encrypt_token(new_refresh_token, aad=aad)
        conn.execute(
            '''
            UPDATE oauth_connections
            SET encrypted_access_token = ?, encrypted_refresh_token = ?, expires_at = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            ''',
            (enc_access, enc_refresh, new_expires_at, oauth_conn_id, int(user_id)),
        )
    else:
        conn.execute(
            '''
            UPDATE oauth_connections
            SET encrypted_access_token = ?, expires_at = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            ''',
            (enc_access, new_expires_at, oauth_conn_id, int(user_id)),
        )
    conn.commit()


def _mark_oauth_needs_reauth(conn, oauth_conn_id, user_id, platform, err_msg):
    safe_err = redact_secrets(err_msg)
    conn.execute(
        '''
        UPDATE oauth_connections
        SET connected = 0, encrypted_access_token = '', encrypted_refresh_token = NULL, encrypted_user_token = NULL,
            last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
        ''',
        (safe_err, oauth_conn_id, int(user_id)),
    )
    conn.execute(
        '''
        UPDATE social_accounts
        SET mode = 'simulated', credentials_configured = 0
        WHERE user_id = ? AND LOWER(platform) = LOWER(?)
        ''',
        (int(user_id), platform),
    )


def _execute_post_publishing(
    conn,
    platforms,
    content,
    media_url=None,
    media_type='text',
    publish_mode='sandbox',
    user_id=1,
    video_title=None,
    youtube_privacy='private',
):
    """
    Executes publishing for a list of target platforms.
    Strictly separates Live Mode (official APIs + OAuth tokens) from Sandbox Mode (simulation).
    """
    publish_results = []
    errors = []
    total_reach = 0
    total_likes = 0
    total_comments = 0
    total_shares = 0

    local_file_path = _resolve_local_upload_path(media_url)

    if publish_mode != 'live':
        for pl in platforms:
            sim_res = social_manager.simulate_sandbox_publish(pl)
            perf = sim_res.get('initial_performance', {})
            total_reach += perf.get('reach', 0)
            total_likes += perf.get('likes', 0)
            total_comments += perf.get('comments', 0)
            total_shares += perf.get('shares', 0)
            publish_results.append({
                'platform': pl,
                'success': True,
                'simulated': True,
                'mode': 'sandbox',
                'external_post_id': sim_res.get('external_post_id'),
                'permalink': None,
                'published_at': sim_res.get('published_at'),
                'message': sim_res.get('message'),
            })
        return {
            'status': 'published',
            'publish_mode': 'sandbox',
            'publish_results': publish_results,
            'error_message': None,
            'reach': total_reach,
            'likes': total_likes,
            'comments': total_comments,
            'shares': total_shares,
        }

    # --- LIVE MODE: Official APIs Only (Never simulate success!) ---
    for pl in platforms:
        acc_row = conn.execute(
            'SELECT * FROM social_accounts WHERE user_id = ? AND LOWER(platform) = LOWER(?) ORDER BY id ASC LIMIT 1',
            (int(user_id), pl),
        ).fetchone()
        if acc_row and acc_row['connected'] == 0:
            err_msg = f"{pl} is currently paused/disconnected in Connected Accounts."
            errors.append(f"{pl}: {err_msg}")
            publish_results.append({
                'platform': pl,
                'success': False,
                'simulated': False,
                'mode': 'live',
                'error': err_msg,
            })
            continue

        oauth_conn = _get_active_oauth_connection(conn, pl, user_id)
        if not oauth_conn:
            caps = social_manager.get_capabilities(pl)
            if not caps.get('official_api'):
                err_msg = f"{pl} only supports Sandbox Mode in this release (no live OAuth connector)."
            else:
                err_msg = f"{pl} is not authorized via OAuth. Connect {pl} via OAuth on the Accounts page before Live publishing."
            errors.append(f"{pl}: {err_msg}")
            publish_results.append({
                'platform': pl,
                'success': False,
                'simulated': False,
                'mode': 'live',
                'error': err_msg,
            })
            continue

        aad = _oauth_aad(user_id, pl)
        try:
            access_token = decrypt_token(oauth_conn['encrypted_access_token'], aad=aad)
            refresh_token = decrypt_token(oauth_conn.get('encrypted_refresh_token'), aad=aad)
        except Exception as exc:
            err_msg = redact_secrets(f"Failed to verify or decrypt stored OAuth token for {pl}. Please reconnect {pl} via OAuth. ({str(exc)})")
            _mark_oauth_needs_reauth(conn, oauth_conn['id'], user_id, pl, err_msg)
            errors.append(f"{pl}: {err_msg}")
            publish_results.append({
                'platform': pl,
                'success': False,
                'simulated': False,
                'mode': 'live',
                'error': err_msg,
            })
            continue

        if pl == 'Facebook':
            res = social_manager.publish_live_facebook(
                page_id=oauth_conn.get('page_id') or oauth_conn.get('external_account_id'),
                page_access_token=access_token,
                content=content,
                media_url=media_url,
                media_type=media_type,
                local_file_path=local_file_path,
                video_title=video_title,
                expires_at=oauth_conn.get('expires_at'),
            )
        elif pl == 'Instagram':
            res = social_manager.publish_live_instagram(
                ig_user_id=oauth_conn.get('external_account_id'),
                access_token=access_token,
                provider=oauth_conn.get('provider', 'meta'),
                content=content,
                media_url=media_url,
                media_type=media_type,
                expires_at=oauth_conn.get('expires_at'),
                token_refresh_cb=lambda new_tok, new_exp, cid=oauth_conn['id'], uid=user_id, plat=pl: _persist_refreshed_oauth_tokens(
                    conn, cid, uid, plat, new_tok, new_exp
                ),
            )
        elif pl == 'YouTube':
            res = social_manager.publish_live_youtube(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=oauth_conn.get('expires_at'),
                content=content,
                media_url=media_url,
                media_type=media_type,
                local_file_path=local_file_path,
                video_title=video_title,
                privacy_status=youtube_privacy or 'private',
                token_refresh_cb=lambda new_tok, new_exp, new_ref=None, cid=oauth_conn['id'], uid=user_id, plat=pl: _persist_refreshed_oauth_tokens(
                    conn, cid, uid, plat, new_tok, new_exp, new_ref
                ),
            )
        else:
            res = {
                'success': False,
                'mode': 'live',
                'platform': pl,
                'error': f"Live publishing is not supported for {pl}.",
            }

        if res.get('success'):
            conn.execute(
                'UPDATE oauth_connections SET last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (oauth_conn['id'],),
            )
            publish_results.append({
                'platform': pl,
                'success': True,
                'simulated': False,
                'mode': 'live',
                'external_post_id': res.get('external_post_id'),
                'permalink': res.get('permalink'),
                'privacy_status': res.get('privacy_status'),
                'published_at': res.get('published_at'),
                'message': res.get('message'),
            })
        else:
            err_msg = redact_secrets(res.get('error') or f"Unknown live API error for {pl}.")
            if res.get('needs_reauth'):
                _mark_oauth_needs_reauth(conn, oauth_conn['id'], user_id, pl, err_msg)
            else:
                conn.execute(
                    'UPDATE oauth_connections SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    (err_msg, oauth_conn['id']),
                )
            errors.append(f"{pl}: {err_msg}")
            publish_results.append({
                'platform': pl,
                'success': False,
                'simulated': False,
                'mode': 'live',
                'error': err_msg,
                'needs_reauth': bool(res.get('needs_reauth')),
            })

    success_count = sum(1 for r in publish_results if r.get('success'))
    if success_count == len(publish_results) and success_count > 0:
        final_status = 'published'
    elif success_count > 0:
        final_status = 'partial'
    else:
        final_status = 'failed'

    return {
        'status': final_status,
        'publish_mode': 'live',
        'publish_results': publish_results,
        'error_message': ' | '.join(errors) if errors else None,
        'reach': 0,
        'likes': 0,
        'comments': 0,
        'shares': 0,
    }


# --- BACKGROUND AUTOMATED SCHEDULER ---
_scheduler_lock = threading.Lock()
_active_scheduled_post_ids: set[int] = set()


def process_due_scheduled_posts(now_str: str | None = None) -> int:
    """
    Claims and dispatches all scheduled posts whose release time has arrived.
    Tracks active post IDs under a thread lock so slow uploads cannot trigger duplicate publishing.
    """
    if now_str is None:
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    processed = 0
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            SELECT * FROM posts
            WHERE status = 'scheduled'
              AND scheduled_for IS NOT NULL
              AND scheduled_for <= ?
            ''',
            (now_str,),
        )
        due_posts = cursor.fetchall()

        for post in due_posts:
            post_id = post['id']
            post_uid = post['user_id']
            if not post_uid:
                continue

            with _scheduler_lock:
                if post_id in _active_scheduled_post_ids:
                    continue
                fresh = cursor.execute(
                    'SELECT status FROM posts WHERE id = ?',
                    (post_id,),
                ).fetchone()
                if not fresh or fresh['status'] != 'scheduled':
                    continue
                _active_scheduled_post_ids.add(post_id)

            try:
                try:
                    platforms = json.loads(post['platforms'])
                except Exception:
                    platforms = [post['platforms']] if post['platforms'] else ['Instagram']

                post_mode = (post['publish_mode'] if 'publish_mode' in post.keys() and post['publish_mode'] else 'sandbox')
                media_type = _detect_media_type(
                    post['media_url'],
                    post['media_type'] if 'media_type' in post.keys() else None,
                )
                video_title = post['video_title'] if 'video_title' in post.keys() else None
                yt_privacy = post['youtube_privacy'] if 'youtube_privacy' in post.keys() and post['youtube_privacy'] else 'private'

                pub_outcome = _execute_post_publishing(
                    conn=conn,
                    platforms=platforms,
                    content=post['content'],
                    media_url=post['media_url'],
                    media_type=media_type,
                    publish_mode=post_mode,
                    user_id=post_uid,
                    video_title=video_title,
                    youtube_privacy=yt_privacy,
                )

                cursor.execute(
                    '''
                    UPDATE posts
                    SET status = ?,
                        publish_results = ?,
                        error_message = ?,
                        published_at = CASE WHEN ? IN ('published', 'partial') THEN CURRENT_TIMESTAMP ELSE published_at END,
                        reach = COALESCE(NULLIF(reach, 0), ?),
                        likes = COALESCE(NULLIF(likes, 0), ?),
                        comments = COALESCE(NULLIF(comments, 0), ?),
                        shares = COALESCE(NULLIF(shares, 0), ?)
                    WHERE id = ?
                    ''',
                    (
                        pub_outcome['status'],
                        json.dumps(pub_outcome['publish_results']),
                        pub_outcome['error_message'],
                        pub_outcome['status'],
                        pub_outcome['reach'],
                        pub_outcome['likes'],
                        pub_outcome['comments'],
                        pub_outcome['shares'],
                        post_id,
                    ),
                )

                preview = (post['content'][:45] + '...') if len(post['content']) > 45 else post['content']
                safe_err = redact_secrets(pub_outcome['error_message']) if pub_outcome.get('error_message') else ''
                if pub_outcome['status'] == 'published':
                    act_title = (
                        'Scheduled Post Published Live'
                        if post_mode == 'live'
                        else 'Scheduled Post Published [Sandbox]'
                    )
                    act_desc = f"'{preview}' processed in {post_mode.upper()} mode across {len(platforms)} platform(s)."
                elif pub_outcome['status'] == 'partial':
                    act_title = 'Scheduled Post Partially Published'
                    act_desc = f"'{preview}' succeeded on some channels but failed on others: {safe_err}"
                else:
                    act_title = 'Scheduled Live Publish Failed'
                    act_desc = f"'{preview}' failed to publish: {safe_err}"

                cursor.execute(
                    '''
                    INSERT INTO activity (user_id, type, title, description, platform)
                    VALUES (?, 'post', ?, ?, ?)
                    ''',
                    (post_uid, act_title, redact_secrets(act_desc), platforms[0] if platforms else 'Multi-channel'),
                )
                conn.commit()
                processed += 1
                print(f"[Scheduler] Post #{post_id} finished with status={pub_outcome['status']} mode={post_mode}.")
            except Exception as post_exc:
                safe_exc = redact_secrets(str(post_exc))
                cursor.execute(
                    "UPDATE posts SET status = 'failed', error_message = ? WHERE id = ?",
                    (safe_exc, post_id),
                )
                conn.commit()
                print(f"[Scheduler Error] Post #{post_id}: {safe_exc}")
            finally:
                with _scheduler_lock:
                    _active_scheduled_post_ids.discard(post_id)
    finally:
        conn.close()
    return processed


def background_scheduler_worker():
    """
    Background worker thread that periodically checks for scheduled posts
    whose scheduled release time has arrived, dispatching Live API or Sandbox publishing.
    """
    print("[Scheduler] Automated social publishing background daemon started.")
    while True:
        try:
            process_due_scheduled_posts()
        except Exception as e:
            print(f"[Scheduler Error] {redact_secrets(str(e))}")

        # Poll every 12 seconds
        time.sleep(12)

# Start background scheduler as a non-blocking daemon thread
scheduler_thread = threading.Thread(target=background_scheduler_worker, daemon=True)
scheduler_thread.start()


# --- HEALTH CHECK ---
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "SocialSync API",
        "timestamp": datetime.now().isoformat(),
        "version": "2.1.0",
        "database": "SQLite",
        "scheduler": "active"
    })

# --- FILE UPLOADS (IMAGES & VIDEOS) ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _matches_allowed_media_signature(file_stream, ext: str) -> bool:
    """Verifies uploaded bytes match the declared image/video magic header to stop polyglot/HTML uploads."""
    pos = file_stream.tell()
    try:
        head = file_stream.read(64)
    finally:
        file_stream.seek(pos)

    if not head:
        return False
    if ext == 'png':
        return head.startswith(b'\x89PNG\r\n\x1a\n')
    if ext in ('jpg', 'jpeg'):
        return head.startswith(b'\xff\xd8\xff')
    if ext == 'gif':
        return head[:6] in (b'GIF87a', b'GIF89a')
    if ext == 'webp':
        return len(head) >= 12 and head.startswith(b'RIFF') and head[8:12] == b'WEBP'
    if ext in ('mp4', 'mov', 'm4v'):
        return len(head) >= 8 and (b'ftyp' in head[4:16] or head[4:8] in (b'moov', b'mdat', b'free', b'wide'))
    if ext in ('webm', 'mkv'):
        return head.startswith(b'\x1a\x45\xdf\xa3')
    if ext == 'avi':
        return len(head) >= 12 and head.startswith(b'RIFF') and head[8:12] == b'AVI '
    return False


@app.route('/api/upload', methods=['POST'])
@auth_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part in request"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No file selected"}), 400

    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        if not _matches_allowed_media_signature(file.stream, ext):
            return jsonify({
                "success": False,
                "message": "Uploaded file content does not match the declared media file format.",
            }), 400

        safe_orig = secure_filename(file.filename) or f"upload.{ext}"
        unique_name = f"media_{secrets.token_hex(16)}_{safe_orig}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
        file.save(filepath)

        host = request.host_url.rstrip('/')
        file_url = f"{host}/uploads/{unique_name}"
        media_type = 'video' if ext in VIDEO_EXTENSIONS else 'image'
        return jsonify({
            "success": True,
            "url": file_url,
            "filename": unique_name,
            "media_type": media_type,
            "mime_type": file.mimetype or ('video/mp4' if media_type == 'video' else 'image/png'),
            "size_bytes": os.path.getsize(filepath),
        }), 201

    return jsonify({
        "success": False,
        "message": "Unsupported file format. Allowed images: PNG, JPG, GIF, WebP. Allowed videos: MP4, MOV, WebM, M4V, AVI, MKV."
    }), 400


@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    safe_name = secure_filename(filename or '')
    if not safe_name or safe_name != filename or not allowed_file(safe_name):
        return jsonify({"success": False, "message": "File not found."}), 404
    resp = make_response(send_from_directory(app.config['UPLOAD_FOLDER'], safe_name))
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Content-Security-Policy'] = "default-src 'none'; sandbox"
    resp.headers['Cache-Control'] = 'private, max-age=300'
    return resp

# --- AUTH ENDPOINTS ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    client_ip = _get_client_ip()
    allowed_ip, retry_after = _check_rate_limit(f"register_ip:{client_ip}", max_attempts=10, window_seconds=300, record=True)
    if not allowed_ip:
        resp = jsonify({"success": False, "message": "Too many registration attempts. Please try again later."})
        resp.status_code = 429
        resp.headers['Retry-After'] = str(retry_after)
        return resp

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not name or not email or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400

    if '@' not in email or '.' not in email.split('@')[-1]:
        return jsonify({"success": False, "message": "Please enter a valid email address"}), 400

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters"}), 400

    conn = get_db_connection()
    try:
        existing = conn.execute('SELECT id FROM users WHERE LOWER(email) = ?', (email,)).fetchone()
        if existing:
            return jsonify({"success": False, "message": "An account with this email already exists"}), 400

        username = '@' + name.lower().replace(' ', '')
        hashed_pwd = generate_password_hash(password)
        avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"

        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO users (name, username, email, password, avatar, role, token_version)
        VALUES (?, ?, ?, ?, ?, 'Social Media Manager', 1)
        ''', (name, username, email, hashed_pwd, avatar))
        user_id = cursor.lastrowid
        ensure_user_social_accounts(conn, user_id)
        conn.commit()
    finally:
        conn.close()

    token = generate_token(user_id, 1)
    return jsonify({
        "success": True,
        "user": {
            "id": user_id,
            "name": name,
            "username": username,
            "email": email,
            "avatar": avatar,
            "role": "Social Media Manager"
        },
        "token": token
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    client_ip = _get_client_ip()
    allowed_ip, ip_retry = _check_rate_limit(f"login_ip:{client_ip}", max_attempts=30, window_seconds=60, record=True)
    if not allowed_ip:
        resp = jsonify({"success": False, "message": "Too many login requests. Please wait a minute and try again."})
        resp.status_code = 429
        resp.headers['Retry-After'] = str(ip_retry)
        return resp

    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    fail_key = f"login_fail:{client_ip}:{email}"
    allowed_acct, acct_retry = _check_rate_limit(fail_key, max_attempts=8, window_seconds=300, record=False)
    if not allowed_acct:
        resp = jsonify({"success": False, "message": "Too many failed login attempts. Please try again later."})
        resp.status_code = 429
        resp.headers['Retry-After'] = str(acct_retry)
        return resp

    allow_demo_seed = (
        os.environ.get('FLASK_ENV', '').strip().lower() != 'production'
        and os.environ.get('ALLOW_DEMO_SEED', 'true').strip().lower() == 'true'
    )

    conn = get_db_connection()
    try:
        user = conn.execute('SELECT * FROM users WHERE LOWER(email) = ?', (email,)).fetchone()

        # In non-production mode, auto-seed demo user on explicit demo login if missing
        if allow_demo_seed and not user and email == 'alex@socialsync.io' and password == 'password123':
            cursor = conn.cursor()
            cursor.execute('''
            INSERT INTO users (name, username, email, password, avatar, role, token_version)
            VALUES ('Alex Morgan', '@alexmorgan', 'alex@socialsync.io', ?, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Lead Brand Strategist', 1)
            ''', (generate_password_hash('password123'),))
            conn.commit()
            user = conn.execute('SELECT * FROM users WHERE LOWER(email) = ?', (email,)).fetchone()

        if user and user['password'].startswith(('scrypt:', 'pbkdf2:')):
            if check_password_hash(user['password'], password):
                _clear_rate_limit(fail_key)
                ensure_user_social_accounts(conn, user['id'])
                conn.commit()
                db_ver = user['token_version'] if 'token_version' in user.keys() and user['token_version'] is not None else 1
                token = generate_token(user['id'], db_ver)
                return jsonify({
                    "success": True,
                    "user": {
                        "id": user['id'],
                        "name": user['name'],
                        "username": user['username'] if 'username' in user.keys() and user['username'] else ('@' + user['name'].lower().replace(' ', '')),
                        "email": user['email'],
                        "avatar": user['avatar'],
                        "role": user['role']
                    },
                    "token": token
                })
    finally:
        conn.close()

    _check_rate_limit(fail_key, max_attempts=8, window_seconds=300, record=True)
    return jsonify({"success": False, "message": "Invalid email or password"}), 401


@app.route('/api/auth/logout', methods=['POST'])
@auth_required
def logout():
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        conn.execute(
            'UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
            (user_id,),
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True, "message": "Logged out and session token revoked."})


@app.route('/api/auth/me', methods=['GET'])
@auth_required
def get_current_user():
    data = dict(request.current_user)
    data.pop('password', None)
    data.pop('token_version', None)
    if not data.get('username'):
        data['username'] = '@' + data['name'].lower().replace(' ', '')
    return jsonify(data)


@app.route('/api/auth/profile', methods=['PUT', 'POST'])
@app.route('/api/auth/me', methods=['PUT'])
@auth_required
def update_profile():
    user = request.current_user
    data = request.get_json() or {}
    name = data.get('name', user['name']).strip()
    username = data.get('username', user.get('username', '')).strip().replace('@', '')
    email = data.get('email', user['email']).strip().lower()
    role = data.get('role', user['role']).strip()
    avatar = (data.get('avatar') if 'avatar' in data else user['avatar']) or ''
    avatar = str(avatar).strip()

    if not name or not email:
        return jsonify({"success": False, "message": "Name and email cannot be empty"}), 400
    if avatar and not _is_safe_web_url(avatar, allow_relative_upload=True):
        return jsonify({"success": False, "message": "Invalid avatar URL scheme. Only http:// and https:// URLs are allowed."}), 400

    conn = get_db_connection()
    try:
        conflict = conn.execute(
            'SELECT id FROM users WHERE LOWER(email) = ? AND id != ?',
            (email, user['id']),
        ).fetchone()
        if conflict:
            return jsonify({"success": False, "message": "Another account already uses this email"}), 400

        conn.execute('''
        UPDATE users
        SET name = ?, username = ?, email = ?, role = ?, avatar = COALESCE(NULLIF(?, ''), avatar)
        WHERE id = ?
        ''', (name, '@' + username if username else user['username'], email, role, avatar, user['id']))
        conn.commit()

        updated = conn.execute('SELECT id, name, username, email, avatar, role FROM users WHERE id = ?', (user['id'],)).fetchone()
    finally:
        conn.close()

    return jsonify({"success": True, "user": dict(updated)})

# --- NOTIFICATION PREFERENCES ---
@app.route('/api/settings/notifications', methods=['GET', 'PUT'])
@auth_required
def user_notification_settings():
    user = request.current_user

    conn = get_db_connection()
    try:
        if request.method == 'PUT':
            data = request.get_json() or {}
            publish = 1 if data.get('notify_publish', True) else 0
            engage = 1 if data.get('notify_engage', True) else 0
            email = 1 if data.get('notify_email', False) else 0

            conn.execute('''
            UPDATE users
            SET notify_publish = ?, notify_engage = ?, notify_email = ?
            WHERE id = ?
            ''', (publish, engage, email, user['id']))
            conn.commit()

        curr = conn.execute('SELECT notify_publish, notify_engage, notify_email FROM users WHERE id = ?', (user['id'],)).fetchone()
    finally:
        conn.close()

    return jsonify({
        "notify_publish": bool(curr['notify_publish'] if curr else 1),
        "notify_engage": bool(curr['notify_engage'] if curr else 1),
        "notify_email": bool(curr['notify_email'] if curr else 0)
    })

def _upsert_oauth_connection(
    conn,
    user_id,
    platform,
    provider,
    external_account_id,
    account_name,
    handle,
    avatar,
    access_token,
    refresh_token=None,
    user_access_token=None,
    scopes=None,
    expires_at=None,
    page_id=None,
    extra_dict=None,
    connected=1,
    followers=None,
):
    uid = int(user_id)
    ensure_user_social_accounts(conn, uid)
    aad = _oauth_aad(uid, platform)
    enc_access = encrypt_token(access_token, aad=aad)
    enc_refresh = encrypt_token(refresh_token, aad=aad) if refresh_token else None
    enc_user = encrypt_token(user_access_token, aad=aad) if user_access_token else None
    scopes_json = json.dumps(scopes or [])
    extra_json = json.dumps(extra_dict or {})

    existing = conn.execute(
        '''
        SELECT id, encrypted_refresh_token, encrypted_user_token FROM oauth_connections
        WHERE user_id = ? AND platform = ? AND external_account_id = ?
        ''',
        (uid, platform, str(external_account_id)),
    ).fetchone()

    if existing:
        final_refresh = enc_refresh if enc_refresh else existing['encrypted_refresh_token']
        existing_user_tok = existing['encrypted_user_token'] if 'encrypted_user_token' in existing.keys() else None
        final_user = enc_user if enc_user else existing_user_tok
        conn.execute(
            '''
            UPDATE oauth_connections
            SET provider = ?, account_name = ?, handle = ?, avatar = ?,
                encrypted_access_token = ?, encrypted_refresh_token = ?, encrypted_user_token = ?,
                scopes = ?, expires_at = ?, page_id = ?, extra_json = ?,
                connected = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            ''',
            (
                provider, account_name, handle, avatar,
                enc_access, final_refresh, final_user,
                scopes_json, expires_at, page_id, extra_json,
                connected, existing['id'], uid,
            ),
        )
    else:
        conn.execute(
            '''
            INSERT INTO oauth_connections (
                user_id, platform, provider, external_account_id,
                account_name, handle, avatar,
                encrypted_access_token, encrypted_refresh_token, encrypted_user_token,
                scopes, expires_at, page_id, extra_json, connected
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                uid, platform, provider, str(external_account_id),
                account_name, handle, avatar,
                enc_access, enc_refresh, enc_user,
                scopes_json, expires_at, page_id, extra_json, connected,
            ),
        )

    if connected == 1:
        # Deactivate any other older OAuth connection for the same platform & user so one is active
        conn.execute(
            '''
            UPDATE oauth_connections
            SET connected = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND platform = ? AND external_account_id != ?
            ''',
            (uid, platform, str(external_account_id)),
        )
        # Update only this user's matching social_accounts row
        acc = conn.execute(
            'SELECT * FROM social_accounts WHERE user_id = ? AND LOWER(platform) = LOWER(?) ORDER BY id ASC LIMIT 1',
            (uid, platform),
        ).fetchone()
        meta_json = json.dumps(extra_dict or {})
        if acc:
            conn.execute(
                '''
                UPDATE social_accounts
                SET name = COALESCE(NULLIF(?, ''), name),
                    handle = COALESCE(NULLIF(?, ''), handle),
                    avatar = COALESCE(NULLIF(?, ''), avatar),
                    followers = CASE WHEN ? IS NOT NULL THEN ? ELSE followers END,
                    connected = 1,
                    mode = 'live',
                    credentials_configured = 1,
                    external_account_id = ?,
                    oauth_provider = ?,
                    account_meta = ?,
                    last_synced = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                ''',
                (
                    account_name, handle, avatar,
                    followers, followers,
                    str(external_account_id), provider, meta_json, acc['id'], uid,
                ),
            )


def _resolve_oauth_target_origin(candidate_origin: str | None = None) -> str:
    allowed = _get_allowed_cors_origins()
    extracted = _extract_origin(candidate_origin) if candidate_origin else None
    if extracted and extracted in allowed:
        return extracted
    return _extract_origin(get_frontend_url()) or "http://localhost:5173"


def _render_oauth_callback_html(
    success: bool,
    message: str,
    platforms=None,
    error: str | None = None,
    target_origin: str | None = None,
):
    import html as html_lib

    resolved_origin = _resolve_oauth_target_origin(target_origin)
    safe_err = redact_secrets(error) if error else None
    payload = {
        "type": "socialsync-oauth",
        "success": success,
        "message": message,
        "platforms": platforms or [],
        "error": safe_err,
    }
    # Never place provider/error details into redirect URL query parameters (browser history / Referer safety)
    qs = urlencode({"oauth_status": "success" if success else "error"})
    redirect_target = f"{resolved_origin}/?{qs}"
    safe_title = "Authorization Complete" if success else "Authorization Failed"
    safe_body = html_lib.escape(message if success else (safe_err or message))
    accent = "#10B981" if success else "#EF4444"

    page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SocialSync OAuth - {safe_title}</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; }}
    .card {{ background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 2rem; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }}
    .pill {{ display: inline-block; padding: 0.35rem 0.9rem; border-radius: 999px; font-weight: 700; font-size: 0.82rem; background: {accent}22; color: {accent}; margin-bottom: 1rem; }}
    h2 {{ margin: 0 0 0.65rem 0; font-size: 1.25rem; }}
    p {{ color: #cbd5e1; font-size: 0.92rem; line-height: 1.5; margin-bottom: 1.5rem; word-break: break-word; }}
    a.btn {{ display: inline-block; background: #6c5ce7; color: #fff; text-decoration: none; padding: 0.65rem 1.3rem; border-radius: 8px; font-weight: 600; font-size: 0.9rem; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="pill">{safe_title}</div>
    <h2>SocialSync Account Connection</h2>
    <p>{safe_body}</p>
    <a class="btn" href="{html_lib.escape(redirect_target)}">Return to SocialSync</a>
  </div>
  <script>
    (function() {{
      var data = {json.dumps(payload)};
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(data, {json.dumps(resolved_origin)});
          setTimeout(function() {{ window.close(); }}, 1200);
          return;
        }}
      }} catch (e) {{}}
      setTimeout(function() {{
        window.location.href = {json.dumps(redirect_target)};
      }}, 1500);
    }})();
  </script>
</body>
</html>"""
    resp = make_response(page_html, 200 if success else 400)
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


# --- OAUTH 2.0 ENDPOINTS (META FACEBOOK PAGES / INSTAGRAM / YOUTUBE) ---
@app.route('/api/oauth/config-status', methods=['GET'])
@auth_required
def oauth_config_status():
    return jsonify({
        "success": True,
        "providers": get_oauth_config_status(),
        "redirect_base": get_oauth_redirect_base(),
        "frontend_url": get_frontend_url(),
    })


@app.route('/api/oauth/<provider>/start', methods=['GET'])
@auth_required
def oauth_start(provider):
    provider = provider.lower().strip()
    if provider not in ('facebook', 'instagram', 'youtube'):
        return jsonify({"success": False, "error": f"Unsupported OAuth provider: {provider}"}), 400

    user_id = request.current_user['id']
    method = request.args.get('method')
    req_origin = _extract_origin(request.args.get('origin') or request.headers.get('Origin'))
    validated_origin = req_origin if req_origin in _get_allowed_cors_origins() else None
    nonce = secrets.token_urlsafe(24)
    state = token_serializer.dumps({
        'user_id': user_id,
        'provider': provider,
        'method': method,
        'nonce': nonce,
        'origin': validated_origin,
    })

    ok, res = social_manager.build_oauth_authorization_url(provider, state, method=method)
    if not ok:
        return jsonify({"success": False, **res}), 400

    now_utc = datetime.now(timezone.utc)
    expires_at = (now_utc + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
    now_str = now_utc.strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM oauth_states WHERE expires_at < ? OR used_at IS NOT NULL', (now_str,))
        conn.execute(
            '''
            INSERT INTO oauth_states (nonce, user_id, provider, method, expires_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (nonce, user_id, provider, method, expires_at),
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"success": True, **res})


@app.route('/api/oauth/<provider>/callback', methods=['GET'])
def oauth_callback(provider):
    provider = provider.lower().strip()
    req_origin_hint = request.headers.get('Origin')
    if provider not in ('facebook', 'instagram', 'youtube'):
        return _render_oauth_callback_html(False, "Unsupported OAuth provider.", error="Unsupported provider.", target_origin=req_origin_hint)

    err = request.args.get('error')
    err_desc = request.args.get('error_description') or request.args.get('error_reason')
    state = request.args.get('state')
    target_origin = req_origin_hint
    if state:
        try:
            peek = token_serializer.loads(state, max_age=900)
            if isinstance(peek, dict) and peek.get('origin'):
                target_origin = peek.get('origin')
        except Exception:
            pass

    if err:
        return _render_oauth_callback_html(
            False,
            "Authorization was cancelled or denied.",
            error=redact_secrets(f"{err}: {err_desc or 'Access denied'}"),
            target_origin=target_origin,
        )

    code = request.args.get('code')
    if not code or not state:
        return _render_oauth_callback_html(False, "Missing OAuth code or state parameter.", error="Invalid OAuth callback parameters.", target_origin=target_origin)

    try:
        state_data = token_serializer.loads(state, max_age=900)
    except (SignatureExpired, BadTimeSignature, Exception):
        return _render_oauth_callback_html(False, "OAuth state expired or invalid.", error="OAuth security state expired. Please try connecting again.", target_origin=target_origin)

    if not isinstance(state_data, dict) or state_data.get('provider') != provider:
        return _render_oauth_callback_html(False, "OAuth provider mismatch.", error="State provider mismatch.", target_origin=target_origin)

    target_origin = state_data.get('origin') or target_origin
    nonce = state_data.get('nonce')
    raw_uid = state_data.get('user_id')
    if not nonce or not raw_uid:
        return _render_oauth_callback_html(False, "Invalid OAuth security state.", error="Missing OAuth state nonce or user binding.", target_origin=target_origin)

    user_id = int(raw_uid)
    method = state_data.get('method')
    conn = get_db_connection()

    try:
        user_exists = conn.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user_exists:
            conn.close()
            return _render_oauth_callback_html(False, "OAuth user account not found.", error="Invalid user in OAuth state.", target_origin=target_origin)

        # Enforce single-use server-side CSRF nonce atomically
        now_utc = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        consumed = conn.execute(
            '''
            UPDATE oauth_states
            SET used_at = CURRENT_TIMESTAMP
            WHERE nonce = ? AND user_id = ? AND provider = ? AND used_at IS NULL AND expires_at >= ?
            ''',
            (nonce, user_id, provider, now_utc),
        )
        conn.commit()
        if consumed.rowcount != 1:
            conn.close()
            return _render_oauth_callback_html(
                False,
                "OAuth security state invalid, expired, or already used.",
                error="OAuth state replay/CSRF check failed. Please initiate connection again from Connected Accounts.",
                target_origin=target_origin,
            )

        if provider in ('facebook', 'instagram') and method != 'instagram_login' and not (
            provider == 'instagram'
            and os.environ.get('INSTAGRAM_APP_ID')
            and os.environ.get('INSTAGRAM_APP_SECRET')
            and not (os.environ.get('META_APP_ID') and os.environ.get('META_APP_SECRET'))
        ):
            ok, meta_res = social_manager.exchange_meta_code(provider, code)
            if not ok:
                conn.close()
                return _render_oauth_callback_html(False, "Meta OAuth connection failed.", error=meta_res.get('error'), target_origin=target_origin)

            pages = meta_res['pages']
            connected_platforms = []
            # Select first page (or first page with an Instagram Business Account when started from Instagram)
            selected_idx = 0
            if provider == 'instagram':
                for idx, p in enumerate(pages):
                    if p.get('instagram_business_account'):
                        selected_idx = idx
                        break

            for idx, page in enumerate(pages):
                is_active = 1 if idx == selected_idx else 0
                page_id = str(page['id'])
                page_name = page.get('name', 'Facebook Page')
                page_handle = f"@{page['username']}" if page.get('username') else page_name
                page_avatar = page.get('picture', {}).get('data', {}).get('url')
                page_followers = int(page.get('followers_count') or page.get('fan_count') or 0)
                page_token = page.get('access_token') or meta_res['user_access_token']
                ig_obj = page.get('instagram_business_account')

                _upsert_oauth_connection(
                    conn=conn,
                    user_id=user_id,
                    platform='Facebook',
                    provider='meta',
                    external_account_id=page_id,
                    account_name=page_name,
                    handle=page_handle,
                    avatar=page_avatar,
                    access_token=page_token,
                    user_access_token=meta_res['user_access_token'],
                    scopes=meta_res['scopes'],
                    expires_at=meta_res['expires_at'],
                    page_id=page_id,
                    extra_dict={
                        'page_id': page_id,
                        'page_name': page_name,
                        'has_instagram': bool(ig_obj),
                        'instagram_id': ig_obj.get('id') if ig_obj else None,
                        'instagram_username': ig_obj.get('username') if ig_obj else None,
                    },
                    connected=is_active,
                    followers=page_followers if is_active else None,
                )
                if is_active:
                    connected_platforms.append(f"Facebook ({page_name})")

                if ig_obj and ig_obj.get('id'):
                    ig_id = str(ig_obj['id'])
                    ig_username = ig_obj.get('username') or ''
                    ig_handle = f"@{ig_username}" if ig_username else page_handle
                    ig_name = ig_obj.get('name') or ig_username or page_name
                    ig_avatar = ig_obj.get('profile_picture_url')
                    ig_followers = int(ig_obj.get('followers_count') or 0)

                    _upsert_oauth_connection(
                        conn=conn,
                        user_id=user_id,
                        platform='Instagram',
                        provider='meta',
                        external_account_id=ig_id,
                        account_name=ig_name,
                        handle=ig_handle,
                        avatar=ig_avatar,
                        access_token=meta_res['user_access_token'],
                        user_access_token=meta_res['user_access_token'],
                        scopes=meta_res['scopes'],
                        expires_at=meta_res['expires_at'],
                        page_id=page_id,
                        extra_dict={
                            'ig_user_id': ig_id,
                            'linked_page_id': page_id,
                            'linked_page_name': page_name,
                            'media_count': int(ig_obj.get('media_count') or 0),
                            'follows_count': int(ig_obj.get('follows_count') or 0),
                        },
                        connected=is_active,
                        followers=ig_followers if is_active else None,
                    )
                    if is_active:
                        connected_platforms.append(f"Instagram ({ig_handle})")

            if provider == 'instagram' and not any(p.get('instagram_business_account') for p in pages):
                conn.commit()
                conn.close()
                return _render_oauth_callback_html(
                    False,
                    "Facebook Page connected, but no Instagram Business/Creator account was linked.",
                    error="No Instagram Business or Creator account is linked to your Facebook Pages. Link an Instagram Professional account to a Facebook Page in Meta Business Suite and retry.",
                    target_origin=target_origin,
                )

            conn.execute(
                '''
                INSERT INTO activity (user_id, type, title, description, platform)
                VALUES (?, 'account', 'Live OAuth Connected', ?, ?)
                ''',
                (user_id, f"Authorized real OAuth access for {', '.join(connected_platforms)}.", 'Facebook' if provider == 'facebook' else 'Instagram'),
            )
            conn.commit()
            conn.close()
            return _render_oauth_callback_html(
                True,
                f"Successfully connected {', '.join(connected_platforms)} in Live Mode.",
                platforms=connected_platforms,
                target_origin=target_origin,
            )

        if provider == 'instagram':
            ok, ig_res = social_manager.exchange_instagram_login_code(code)
            if not ok:
                conn.close()
                return _render_oauth_callback_html(False, "Instagram Login failed.", error=ig_res.get('error'), target_origin=target_origin)

            prof = ig_res['profile']
            ig_handle = f"@{prof['username']}" if prof.get('username') else prof['name']
            _upsert_oauth_connection(
                conn=conn,
                user_id=user_id,
                platform='Instagram',
                provider='instagram_login',
                external_account_id=prof['id'],
                account_name=prof['name'],
                handle=ig_handle,
                avatar=prof.get('profile_picture_url'),
                access_token=ig_res['access_token'],
                scopes=ig_res['scopes'],
                expires_at=ig_res['expires_at'],
                extra_dict={'media_count': prof.get('media_count', 0), 'follows_count': prof.get('follows_count', 0)},
                connected=1,
                followers=prof.get('followers_count', 0),
            )
            conn.execute(
                '''
                INSERT INTO activity (user_id, type, title, description, platform)
                VALUES (?, 'account', 'Instagram OAuth Connected', ?, 'Instagram')
                ''',
                (user_id, f"Authorized Instagram Professional account {ig_handle}."),
            )
            conn.commit()
            conn.close()
            return _render_oauth_callback_html(
                True,
                f"Successfully connected Instagram ({ig_handle}) in Live Mode.",
                platforms=[f"Instagram ({ig_handle})"],
                target_origin=target_origin,
            )

        if provider == 'youtube':
            ok, yt_res = social_manager.exchange_youtube_code(code)
            if not ok:
                conn.close()
                return _render_oauth_callback_html(False, "YouTube OAuth failed.", error=yt_res.get('error'), target_origin=target_origin)

            ch = yt_res['channel']
            _upsert_oauth_connection(
                conn=conn,
                user_id=user_id,
                platform='YouTube',
                provider='google',
                external_account_id=ch['id'],
                account_name=ch['title'],
                handle=ch['handle'],
                avatar=ch.get('avatar'),
                access_token=yt_res['access_token'],
                refresh_token=yt_res.get('refresh_token'),
                scopes=yt_res['scopes'],
                expires_at=yt_res['expires_at'],
                extra_dict={'views': ch.get('views', 0), 'videos': ch.get('videos', 0)},
                connected=1,
                followers=ch.get('subscribers', 0),
            )
            conn.execute(
                '''
                INSERT INTO activity (user_id, type, title, description, platform)
                VALUES (?, 'account', 'YouTube OAuth Connected', ?, 'YouTube')
                ''',
                (user_id, f"Authorized YouTube channel {ch['title']} ({ch['handle']})."),
            )
            conn.commit()
            conn.close()
            return _render_oauth_callback_html(
                True,
                f"Successfully connected YouTube ({ch['title']}) in Live Mode.",
                platforms=[f"YouTube ({ch['title']})"],
                target_origin=target_origin,
            )

        conn.close()
        return _render_oauth_callback_html(False, "Unsupported provider.", error=provider, target_origin=target_origin)
    except Exception as exc:
        conn.close()
        return _render_oauth_callback_html(False, "Unexpected error saving OAuth connection.", error=redact_secrets(str(exc)), target_origin=target_origin)


@app.route('/api/oauth/meta/pages', methods=['GET'])
@auth_required
def get_meta_pages():
    user_id = request.current_user['id']
    conn = get_db_connection()
    rows = conn.execute(
        '''
        SELECT external_account_id, account_name, handle, avatar, connected, extra_json
        FROM oauth_connections
        WHERE platform = 'Facebook' AND provider = 'meta' AND user_id = ? AND encrypted_access_token != ''
        ORDER BY connected DESC, id ASC
        ''',
        (user_id,),
    ).fetchall()
    conn.close()

    pages = []
    for r in rows:
        extra = {}
        try:
            extra = json.loads(r['extra_json'] or '{}')
        except Exception:
            pass
        pages.append({
            'page_id': r['external_account_id'],
            'name': r['account_name'],
            'handle': r['handle'],
            'avatar': r['avatar'],
            'active': bool(r['connected']),
            'has_instagram': bool(extra.get('has_instagram')),
            'instagram_username': extra.get('instagram_username'),
        })
    return jsonify({"success": True, "pages": pages})


@app.route('/api/oauth/meta/select-page', methods=['POST'])
@auth_required
def select_meta_page():
    user_id = request.current_user['id']
    data = request.get_json() or {}
    page_id = str(data.get('page_id') or '').strip()
    if not page_id:
        return jsonify({"success": False, "error": "page_id is required"}), 400

    conn = get_db_connection()
    try:
        ensure_user_social_accounts(conn, user_id)
        target = conn.execute(
            '''
            SELECT * FROM oauth_connections
            WHERE platform = 'Facebook' AND provider = 'meta' AND user_id = ? AND external_account_id = ?
              AND encrypted_access_token != ''
            ''',
            (user_id, page_id),
        ).fetchone()
        if not target:
            return jsonify({"success": False, "error": "Facebook Page connection not found."}), 404

        conn.execute(
            "UPDATE oauth_connections SET connected = 0, updated_at = CURRENT_TIMESTAMP WHERE platform = 'Facebook' AND user_id = ?",
            (user_id,),
        )
        conn.execute(
            "UPDATE oauth_connections SET connected = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (target['id'], user_id),
        )
        conn.execute(
            '''
            UPDATE social_accounts
            SET name = ?, handle = ?, avatar = COALESCE(NULLIF(?, ''), avatar),
                external_account_id = ?, oauth_provider = 'meta', mode = 'live', credentials_configured = 1, connected = 1
            WHERE user_id = ? AND LOWER(platform) = 'facebook'
            ''',
            (target['account_name'], target['handle'], target['avatar'], page_id, user_id),
        )

        ig_row = conn.execute(
            '''
            SELECT * FROM oauth_connections
            WHERE platform = 'Instagram' AND provider = 'meta' AND user_id = ? AND page_id = ?
              AND encrypted_access_token != ''
            ''',
            (user_id, page_id),
        ).fetchone()
        if ig_row:
            conn.execute(
                "UPDATE oauth_connections SET connected = 0, updated_at = CURRENT_TIMESTAMP WHERE platform = 'Instagram' AND user_id = ?",
                (user_id,),
            )
            conn.execute(
                "UPDATE oauth_connections SET connected = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                (ig_row['id'], user_id),
            )
            conn.execute(
                '''
                UPDATE social_accounts
                SET name = ?, handle = ?, avatar = COALESCE(NULLIF(?, ''), avatar),
                    external_account_id = ?, oauth_provider = 'meta', mode = 'live', credentials_configured = 1, connected = 1
                WHERE user_id = ? AND LOWER(platform) = 'instagram'
                ''',
                (ig_row['account_name'], ig_row['handle'], ig_row['avatar'], ig_row['external_account_id'], user_id),
            )

        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True, "message": f"Switched active Facebook Page to {target['account_name']}."})


@app.route('/api/oauth/<platform>/disconnect', methods=['POST'])
@auth_required
def disconnect_oauth(platform):
    platform_norm = platform.strip().lower()
    canonical_map = {'facebook': 'Facebook', 'instagram': 'Instagram', 'youtube': 'YouTube'}
    canonical = canonical_map.get(platform_norm)
    if not canonical:
        return jsonify({"success": False, "error": f"Unsupported OAuth platform: {platform}"}), 400

    user_id = request.current_user['id']
    conn = get_db_connection()
    revocation_notes = []
    try:
        rows = conn.execute(
            '''
            SELECT id, provider, encrypted_access_token, encrypted_refresh_token, encrypted_user_token
            FROM oauth_connections
            WHERE user_id = ? AND platform = ?
              AND (encrypted_access_token != '' OR encrypted_refresh_token IS NOT NULL OR encrypted_user_token IS NOT NULL)
            ''',
            (user_id, canonical),
        ).fetchall()

        sibling_active_meta = conn.execute(
            '''
            SELECT COUNT(*) as cnt FROM oauth_connections
            WHERE user_id = ? AND provider = 'meta' AND platform != ? AND connected = 1 AND encrypted_access_token != ''
            ''',
            (user_id, canonical),
        ).fetchone()
        has_active_meta_sibling = bool(sibling_active_meta and sibling_active_meta['cnt'] > 0)

        aad = _oauth_aad(user_id, canonical)
        revoked_pairs = set()
        for row in rows:
            acc_tok = None
            ref_tok = None
            meta_user_tok = None
            try:
                acc_tok = decrypt_token(row['encrypted_access_token'], aad=aad)
            except Exception:
                acc_tok = None
            try:
                ref_tok = decrypt_token(row['encrypted_refresh_token'], aad=aad)
            except Exception:
                ref_tok = None
            try:
                enc_ut = row['encrypted_user_token'] if 'encrypted_user_token' in row.keys() else None
                meta_user_tok = decrypt_token(enc_ut, aad=aad) if enc_ut else None
            except Exception:
                meta_user_tok = None

            if row['provider'] == 'meta':
                if not meta_user_tok and canonical == 'Instagram':
                    meta_user_tok = acc_tok
                if not meta_user_tok and canonical == 'Facebook':
                    sib_ig = conn.execute(
                        '''
                        SELECT encrypted_user_token, encrypted_access_token FROM oauth_connections
                        WHERE user_id = ? AND provider = 'meta' AND platform = 'Instagram'
                          AND (encrypted_user_token IS NOT NULL OR encrypted_access_token != '')
                        ORDER BY updated_at DESC, id DESC LIMIT 1
                        ''',
                        (user_id,),
                    ).fetchone()
                    if sib_ig:
                        ig_aad = _oauth_aad(user_id, 'Instagram')
                        try:
                            meta_user_tok = decrypt_token(
                                sib_ig['encrypted_user_token'] or sib_ig['encrypted_access_token'],
                                aad=ig_aad,
                            )
                        except Exception:
                            meta_user_tok = None

                if not meta_user_tok:
                    revocation_notes.append(
                        f"Cleared local {canonical} OAuth tokens (no Meta User Access Token present to call /me/permissions)."
                    )
                    continue

                perm_to_revoke = None
                if has_active_meta_sibling:
                    perm_to_revoke = 'pages_manage_posts' if canonical == 'Facebook' else 'instagram_content_publish'

                key = ('meta', meta_user_tok, perm_to_revoke or 'ALL')
                if key not in revoked_pairs:
                    revoked_pairs.add(key)
                    _, rev_msg = social_manager.revoke_oauth_connection(
                        provider='meta',
                        access_token=acc_tok,
                        user_access_token=meta_user_tok,
                        permission_name=perm_to_revoke,
                    )
                    if rev_msg:
                        revocation_notes.append(redact_secrets(rev_msg))
                continue

            if acc_tok or ref_tok:
                key = (row['provider'], acc_tok or '', ref_tok or '')
                if key not in revoked_pairs:
                    revoked_pairs.add(key)
                    _, rev_msg = social_manager.revoke_oauth_connection(
                        provider=row['provider'],
                        access_token=acc_tok,
                        refresh_token=ref_tok,
                    )
                    if rev_msg:
                        revocation_notes.append(redact_secrets(rev_msg))

        conn.execute(
            '''
            UPDATE oauth_connections
            SET connected = 0, encrypted_access_token = '', encrypted_refresh_token = NULL, encrypted_user_token = NULL,
                last_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND platform = ?
            ''',
            (user_id, canonical),
        )
        conn.execute(
            '''
            UPDATE social_accounts
            SET mode = 'simulated', credentials_configured = 0, oauth_provider = NULL
            WHERE user_id = ? AND LOWER(platform) = LOWER(?)
            ''',
            (user_id, canonical),
        )
        conn.execute(
            '''
            INSERT INTO activity (user_id, type, title, description, platform)
            VALUES (?, 'account', 'OAuth Disconnected', ?, ?)
            ''',
            (user_id, f"Revoked OAuth token for {canonical}. Account returned to Sandbox Mode.", canonical),
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        "success": True,
        "platform": canonical,
        "message": f"{canonical} OAuth disconnected safely.",
        "revocation_notes": revocation_notes,
    })


# --- SOCIAL ACCOUNTS ENDPOINTS ---
def _enrich_account_dict(conn, acc_row, user_id):
    item = dict(acc_row)
    oauth_conn = _get_active_oauth_connection(conn, item['platform'], user_id)
    info = social_manager.get_platform_info(item['platform'], oauth_conn)
    item['mode'] = info['mode']
    item['credentials_configured'] = 1 if info['configured'] else 0
    item['oauth_configured'] = info['oauth_configured']
    item['oauth_connected'] = info['oauth_connected']
    item['missing_env'] = info['missing_env']
    item['capabilities'] = info['capabilities']
    item['status_message'] = info['status_message']
    if oauth_conn:
        try:
            item['scopes'] = json.loads(oauth_conn.get('scopes') or '[]')
        except Exception:
            item['scopes'] = []
        item['last_error'] = redact_secrets(oauth_conn.get('last_error')) if oauth_conn.get('last_error') else None
        item['token_expires_at'] = oauth_conn.get('expires_at')
        item['needs_reauth'] = False
    else:
        item['scopes'] = []
        latest_row = conn.execute(
            '''
            SELECT last_error FROM oauth_connections
            WHERE user_id = ? AND platform = ?
            ORDER BY updated_at DESC, id DESC LIMIT 1
            ''',
            (int(user_id), item['platform']),
        ).fetchone()
        raw_err = latest_row['last_error'] if latest_row else None
        item['last_error'] = redact_secrets(raw_err) if raw_err else None
        item['needs_reauth'] = bool(raw_err)
    try:
        item['account_meta'] = json.loads(item.get('account_meta') or '{}')
    except Exception:
        item['account_meta'] = {}
    return item


@app.route('/api/accounts', methods=['GET'])
@auth_required
def get_accounts():
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        ensure_user_social_accounts(conn, user_id)
        conn.commit()
        accounts = conn.execute(
            'SELECT * FROM social_accounts WHERE user_id = ? ORDER BY id ASC',
            (user_id,),
        ).fetchall()
        result = [_enrich_account_dict(conn, acc, user_id) for acc in accounts]
    finally:
        conn.close()
    return jsonify(result)


@app.route('/api/accounts/<int:acc_id>/toggle', methods=['POST'])
@auth_required
def toggle_account_connection(acc_id):
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        account = conn.execute(
            'SELECT * FROM social_accounts WHERE id = ? AND user_id = ?',
            (acc_id, user_id),
        ).fetchone()
        if not account:
            return jsonify({"error": "Account not found"}), 404

        new_status = 0 if account['connected'] else 1
        conn.execute(
            'UPDATE social_accounts SET connected = ?, last_synced = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            (new_status, acc_id, user_id),
        )
        conn.commit()
        updated = conn.execute(
            'SELECT * FROM social_accounts WHERE id = ? AND user_id = ?',
            (acc_id, user_id),
        ).fetchone()
        item = _enrich_account_dict(conn, updated, user_id)
    finally:
        conn.close()
    return jsonify(item)


def _sync_single_account(conn, acc_row, user_id):
    platform = acc_row['platform']
    oauth_conn = _get_active_oauth_connection(conn, platform, user_id)
    if oauth_conn:
        aad = _oauth_aad(user_id, platform)
        try:
            access_token = decrypt_token(oauth_conn['encrypted_access_token'], aad=aad)
            refresh_token = decrypt_token(oauth_conn.get('encrypted_refresh_token'), aad=aad)
        except Exception as exc:
            err_msg = redact_secrets(f"Failed to verify or decrypt stored OAuth token. Please reconnect {platform} via OAuth. ({str(exc)})")
            _mark_oauth_needs_reauth(conn, oauth_conn['id'], user_id, platform, err_msg)
            return False, None, err_msg

        sync_res = social_manager.sync_live_account(
            oauth_conn=oauth_conn,
            access_token=access_token,
            refresh_token=refresh_token,
            token_refresh_cb=lambda new_tok, new_exp, new_ref=None, cid=oauth_conn['id'], uid=user_id, plat=platform: _persist_refreshed_oauth_tokens(
                conn, cid, uid, plat, new_tok, new_exp, new_ref
            ),
        )
        if not sync_res.get('success'):
            err_msg = redact_secrets(sync_res.get('error', f"Live API sync failed for {platform}"))
            if sync_res.get('needs_reauth'):
                _mark_oauth_needs_reauth(conn, oauth_conn['id'], user_id, platform, err_msg)
            else:
                conn.execute(
                    'UPDATE oauth_connections SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    (err_msg, oauth_conn['id'], int(user_id)),
                )
            return False, None, err_msg

        perm_note = redact_secrets(sync_res.get('permission_note')) if sync_res.get('permission_note') else None
        meta = {
            'views': sync_res.get('views', 0),
            'reach': sync_res.get('reach', 0),
            'engagement': sync_res.get('engagement', 0),
            'video_count': sync_res.get('video_count', 0),
            'media_count': sync_res.get('media_count', 0),
            'permission_note': perm_note,
        }
        conn.execute(
            '''
            UPDATE social_accounts
            SET name = COALESCE(NULLIF(?, ''), name),
                handle = COALESCE(NULLIF(?, ''), handle),
                avatar = COALESCE(NULLIF(?, ''), avatar),
                followers = ?,
                following = COALESCE(?, following),
                growth = ?,
                mode = 'live',
                credentials_configured = 1,
                account_meta = ?,
                last_synced = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            ''',
            (
                sync_res.get('name'),
                sync_res.get('handle'),
                sync_res.get('avatar'),
                sync_res.get('followers', acc_row['followers']),
                sync_res.get('following'),
                sync_res.get('growth', 'Live'),
                json.dumps(meta),
                acc_row['id'],
                int(user_id),
            ),
        )
        conn.execute(
            'UPDATE oauth_connections SET last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            (oauth_conn['id'], int(user_id)),
        )
        conn.execute(
            '''
            INSERT INTO analytics_snapshots (
                user_id, platform, external_account_id, followers, views, reach, engagement, video_count, media_count, metrics_json, source_mode, permission_note
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?)
            ''',
            (
                int(user_id),
                platform,
                sync_res.get('external_account_id'),
                sync_res.get('followers', 0),
                sync_res.get('views', 0),
                sync_res.get('reach', 0),
                sync_res.get('engagement', 0),
                sync_res.get('video_count', 0),
                sync_res.get('media_count', 0),
                json.dumps(sync_res),
                perm_note,
            ),
        )
        return True, sync_res, perm_note

    # Sandbox account sync
    sim_data = social_manager.simulate_sandbox_metrics(acc_row['followers'])
    conn.execute(
        '''
        UPDATE social_accounts
        SET followers = ?, growth = ?, mode = 'simulated', credentials_configured = 0, last_synced = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
        ''',
        (sim_data['followers'], sim_data['growth'], acc_row['id'], int(user_id)),
    )
    return True, sim_data, None


@app.route('/api/accounts/<int:acc_id>/sync', methods=['POST'])
@auth_required
def sync_single_account_endpoint(acc_id):
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        acc = conn.execute(
            'SELECT * FROM social_accounts WHERE id = ? AND user_id = ?',
            (acc_id, user_id),
        ).fetchone()
        if not acc:
            return jsonify({"success": False, "error": "Account not found"}), 404

        ok, sync_res, note = _sync_single_account(conn, acc, user_id)
        conn.commit()
        updated = conn.execute(
            'SELECT * FROM social_accounts WHERE id = ? AND user_id = ?',
            (acc_id, user_id),
        ).fetchone()
        enriched = _enrich_account_dict(conn, updated, user_id)
    finally:
        conn.close()

    if not ok:
        return jsonify({"success": False, "error": note, "account": enriched}), 502

    msg = f"{acc['platform']} synced in {enriched['mode'].upper()} mode."
    if note:
        msg += f" Note: {note}"
    return jsonify({"success": True, "account": enriched, "sync_details": sync_res, "message": msg})


@app.route('/api/accounts/sync-all', methods=['POST'])
@auth_required
def sync_all_accounts():
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        ensure_user_social_accounts(conn, user_id)
        accounts = conn.execute(
            'SELECT * FROM social_accounts WHERE user_id = ? ORDER BY id ASC',
            (user_id,),
        ).fetchall()
        updated_list = []
        errors = []
        notes = []

        for acc in accounts:
            ok, _, note = _sync_single_account(conn, acc, user_id)
            if not ok:
                errors.append(f"{acc['platform']}: {note}")
            elif note:
                notes.append(f"{acc['platform']}: {note}")
            updated_acc = conn.execute(
                'SELECT * FROM social_accounts WHERE id = ? AND user_id = ?',
                (acc['id'], user_id),
            ).fetchone()
            updated_list.append(_enrich_account_dict(conn, updated_acc, user_id))
        conn.commit()

        act_desc = "Synchronized accounts."
        if errors:
            act_desc = f"Sync completed with API errors: {' | '.join(errors)}"
        elif notes:
            act_desc = f"Accounts synchronized. Notes: {' | '.join(notes)}"

        conn.execute(
            '''
            INSERT INTO activity (user_id, type, title, description, platform)
            VALUES (?, 'account', 'Accounts Synchronized', ?, 'Multi-channel')
            ''',
            (user_id, redact_secrets(act_desc)),
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        "success": len(errors) == 0,
        "accounts": updated_list,
        "errors": errors,
        "notes": notes,
        "message": (
            "All accounts synchronized successfully!"
            if not errors
            else f"Sync finished with {len(errors)} live API error(s)."
        ),
    })

# --- POSTS CRUD & SCHEDULING ---
@app.route('/api/posts', methods=['GET'])
@auth_required
def get_posts():
    user_id = request.current_user['id']
    status = request.args.get('status')
    campaign_id = request.args.get('campaign_id')
    search = request.args.get('search', '').strip()

    conn = get_db_connection()
    try:
        query = (
            'SELECT p.*, c.title as campaign_title '
            'FROM posts p LEFT JOIN campaigns c ON p.campaign_id = c.id AND c.user_id = p.user_id '
            'WHERE p.user_id = ?'
        )
        params = [user_id]

        if status and status != 'all':
            query += ' AND p.status = ?'
            params.append(status)

        if campaign_id:
            query += ' AND p.campaign_id = ?'
            params.append(campaign_id)

        if search:
            query += ' AND (p.content LIKE ? OR p.platforms LIKE ?)'
            params.extend([f'%{search}%', f'%{search}%'])

        query += ' ORDER BY p.created_at DESC, p.id DESC'
        posts = conn.execute(query, params).fetchall()
    finally:
        conn.close()

    return jsonify([_serialize_post(p) for p in posts])


@app.route('/api/posts', methods=['POST'])
@auth_required
def create_post():
    user_id = request.current_user['id']
    data = request.get_json() or {}
    content = data.get('content', '').strip()
    platforms = data.get('platforms', [])
    media_url = data.get('media_url') or None
    if isinstance(media_url, str):
        media_url = media_url.strip() or None
    if media_url and not _is_safe_web_url(media_url, allow_relative_upload=True):
        return jsonify({"error": "Invalid media_url scheme. Only http:// and https:// URLs are allowed."}), 400
    media_type = _detect_media_type(media_url, data.get('media_type'))
    status = data.get('status', 'draft')
    scheduled_for = data.get('scheduled_for')
    campaign_id = data.get('campaign_id')
    video_title = (data.get('video_title') or '').strip() or None
    youtube_privacy = (data.get('youtube_privacy') or 'private').strip().lower()
    if youtube_privacy not in ('private', 'unlisted', 'public'):
        youtube_privacy = 'private'

    publish_mode = (data.get('publish_mode') or 'sandbox').strip().lower()
    if publish_mode not in ('live', 'sandbox'):
        publish_mode = 'sandbox'

    if not content:
        return jsonify({"error": "Post content is required"}), 400

    if not platforms or not isinstance(platforms, list):
        return jsonify({"error": "Select at least one target platform"}), 400

    if status not in ['draft', 'scheduled', 'published']:
        status = 'draft'

    if status == 'scheduled' and not scheduled_for:
        scheduled_for = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db_connection()
    try:
        if campaign_id not in (None, ''):
            owned_camp = conn.execute(
                'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
                (campaign_id, user_id),
            ).fetchone()
            if not owned_camp:
                return jsonify({"error": "Referenced campaign not found"}), 404
        else:
            campaign_id = None

        cursor = conn.cursor()

        final_status = status
        publish_results = []
        error_message = None
        initial_reach = 0
        initial_likes = 0
        initial_comments = 0
        initial_shares = 0
        published_at = None

        if status == 'published':
            outcome = _execute_post_publishing(
                conn=conn,
                platforms=platforms,
                content=content,
                media_url=media_url,
                media_type=media_type,
                publish_mode=publish_mode,
                user_id=user_id,
                video_title=video_title,
                youtube_privacy=youtube_privacy,
            )
            final_status = outcome['status']
            publish_results = outcome['publish_results']
            error_message = outcome['error_message']
            initial_reach = outcome['reach']
            initial_likes = outcome['likes']
            initial_comments = outcome['comments']
            initial_shares = outcome['shares']
            if final_status in ('published', 'partial'):
                published_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute(
            '''
            INSERT INTO posts (
                user_id, campaign_id, content, platforms, media_url, media_type,
                status, scheduled_for, likes, comments, shares, reach,
                publish_mode, publish_results, error_message, video_title, youtube_privacy, published_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                user_id, campaign_id, content, json.dumps(platforms), media_url, media_type,
                final_status, scheduled_for, initial_likes, initial_comments, initial_shares, initial_reach,
                publish_mode, json.dumps(publish_results), error_message, video_title, youtube_privacy, published_at,
            ),
        )
        post_id = cursor.lastrowid

        # Accurate activity log
        if final_status == 'published':
            activity_title = "Published Live" if publish_mode == 'live' else "Published [Sandbox]"
            activity_desc = f"Post published ({publish_mode.upper()}) to {', '.join(platforms)}."
        elif final_status == 'partial':
            activity_title = "Partially Published Live"
            activity_desc = f"Some channels succeeded while others failed: {error_message}"
        elif final_status == 'failed':
            activity_title = "Live Publish Failed"
            activity_desc = f"Publishing failed: {error_message}"
        elif final_status == 'scheduled':
            activity_title = f"Post Scheduled ({publish_mode.upper()})"
            activity_desc = f"Scheduled for {scheduled_for} across {', '.join(platforms)}."
        else:
            activity_title = "Draft Saved"
            activity_desc = f"New draft post created for {', '.join(platforms)}."

        cursor.execute(
            '''
            INSERT INTO activity (user_id, type, title, description, platform)
            VALUES (?, 'post', ?, ?, ?)
            ''',
            (user_id, activity_title, redact_secrets(activity_desc), platforms[0] if platforms else 'Multi-channel'),
        )
        conn.commit()

        new_post = conn.execute('SELECT * FROM posts WHERE id = ? AND user_id = ?', (post_id, user_id)).fetchone()
    finally:
        conn.close()

    item = _serialize_post(new_post)
    if final_status == 'failed':
        return jsonify({**item, "success": False, "error": error_message or "Live publishing failed on all selected channels."}), 422
    return jsonify(item), 201


@app.route('/api/posts/<int:post_id>', methods=['PUT'])
@auth_required
def update_post(post_id):
    user_id = request.current_user['id']
    data = request.get_json() or {}
    conn = get_db_connection()
    try:
        existing = conn.execute('SELECT * FROM posts WHERE id = ? AND user_id = ?', (post_id, user_id)).fetchone()
        if not existing:
            return jsonify({"error": "Post not found"}), 404

        content = data.get('content', existing['content'])
        platforms_list = data.get('platforms', json.loads(existing['platforms']))
        platforms_json = json.dumps(platforms_list)
        media_url = data.get('media_url', existing['media_url'])
        if isinstance(media_url, str):
            media_url = media_url.strip() or None
        if media_url and not _is_safe_web_url(media_url, allow_relative_upload=True):
            return jsonify({"error": "Invalid media_url scheme. Only http:// and https:// URLs are allowed."}), 400
        media_type = _detect_media_type(
            media_url,
            data.get('media_type', existing['media_type'] if 'media_type' in existing.keys() else None),
        )
        requested_status = data.get('status', existing['status'])
        if requested_status not in ('draft', 'scheduled', 'published', 'partial', 'failed'):
            requested_status = existing['status']
        scheduled_for = data.get('scheduled_for', existing['scheduled_for'])
        campaign_id = data.get('campaign_id', existing['campaign_id'])
        if 'campaign_id' in data:
            if campaign_id not in (None, ''):
                owned_camp = conn.execute(
                    'SELECT id FROM campaigns WHERE id = ? AND user_id = ?',
                    (campaign_id, user_id),
                ).fetchone()
                if not owned_camp:
                    return jsonify({"error": "Referenced campaign not found"}), 404
            else:
                campaign_id = None

        publish_mode = data.get('publish_mode', existing['publish_mode'] if 'publish_mode' in existing.keys() else 'sandbox')
        video_title = data.get('video_title', existing['video_title'] if 'video_title' in existing.keys() else None)
        youtube_privacy = data.get('youtube_privacy', existing['youtube_privacy'] if 'youtube_privacy' in existing.keys() else 'private')

        publish_results_json = existing['publish_results'] if 'publish_results' in existing.keys() else None
        error_message = existing['error_message'] if 'error_message' in existing.keys() else None
        final_status = requested_status

        # If user explicitly transitions an unpublished post to 'published' via Edit, execute publishing
        if requested_status == 'published' and existing['status'] != 'published':
            outcome = _execute_post_publishing(
                conn=conn,
                platforms=platforms_list,
                content=content,
                media_url=media_url,
                media_type=media_type,
                publish_mode=publish_mode,
                user_id=user_id,
                video_title=video_title,
                youtube_privacy=youtube_privacy,
            )
            final_status = outcome['status']
            publish_results_json = json.dumps(outcome['publish_results'])
            error_message = outcome['error_message']

        conn.execute(
            '''
            UPDATE posts
            SET content = ?, platforms = ?, media_url = ?, media_type = ?,
                status = ?, scheduled_for = ?, campaign_id = ?,
                publish_mode = ?, publish_results = ?, error_message = ?,
                video_title = ?, youtube_privacy = ?
            WHERE id = ? AND user_id = ?
            ''',
            (
                content, platforms_json, media_url, media_type,
                final_status, scheduled_for, campaign_id,
                publish_mode, publish_results_json, error_message,
                video_title, youtube_privacy, post_id, user_id,
            ),
        )
        conn.commit()
        updated = conn.execute('SELECT * FROM posts WHERE id = ? AND user_id = ?', (post_id, user_id)).fetchone()
    finally:
        conn.close()

    item = _serialize_post(updated)
    if final_status == 'failed':
        return jsonify({**item, "success": False, "error": error_message or "Live publishing failed."}), 422
    return jsonify(item)

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@auth_required
def delete_post(post_id):
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM posts WHERE id = ? AND user_id = ?', (post_id, user_id))
        conn.commit()
        deleted = cursor.rowcount > 0
    finally:
        conn.close()

    if deleted:
        return jsonify({"success": True, "message": "Post deleted successfully"})
    return jsonify({"error": "Post not found"}), 404

# --- CAMPAIGNS ENDPOINTS ---
@app.route('/api/campaigns', methods=['GET'])
@auth_required
def get_campaigns():
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        campaigns = conn.execute(
            'SELECT * FROM campaigns WHERE user_id = ? ORDER BY id DESC',
            (user_id,),
        ).fetchall()

        result = []
        for c in campaigns:
            item = dict(c)
            stats = conn.execute(
                '''
                SELECT COALESCE(SUM(reach), 0) as post_reach, COUNT(*) as post_count
                FROM posts
                WHERE campaign_id = ? AND user_id = ? AND status = 'published'
                ''',
                (item['id'], user_id),
            ).fetchone()

            calc_reach = stats['post_reach'] if stats and stats['post_reach'] > 0 else item['current_reach']
            target = item['target_reach'] or 50000
            progress = min(100, int((calc_reach / target) * 100)) if target > 0 else 0

            item['current_reach'] = calc_reach
            item['progress'] = progress
            item['linked_posts_count'] = stats['post_count'] if stats else 0
            result.append(item)
    finally:
        conn.close()

    return jsonify(result)

@app.route('/api/campaigns', methods=['POST'])
@auth_required
def create_campaign():
    user_id = request.current_user['id']
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    budget = str(data.get('budget', '$1,000')).strip()
    try:
        target_reach = int(data.get('target_reach', 50000))
    except (TypeError, ValueError):
        return jsonify({"error": "target_reach must be a valid integer"}), 400
    if target_reach <= 0:
        return jsonify({"error": "target_reach must be positive"}), 400
    start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
    end_date = data.get('end_date')

    if not title:
        return jsonify({"error": "Campaign title is required"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO campaigns (user_id, title, description, status, progress, target_reach, current_reach, budget, start_date, end_date)
        VALUES (?, ?, ?, 'active', 0, ?, 0, ?, ?, ?)
        ''', (user_id, title, description, target_reach, budget, start_date, end_date))
        camp_id = cursor.lastrowid

        cursor.execute('''
        INSERT INTO activity (user_id, type, title, description, platform)
        VALUES (?, 'campaign', 'Campaign Launched', ?, 'Campaigns')
        ''', (user_id, f"Initiated '{title}' targeted reach {target_reach:,}."))
        conn.commit()

        new_camp = conn.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', (camp_id, user_id)).fetchone()
    finally:
        conn.close()
    return jsonify(dict(new_camp)), 201

@app.route('/api/campaigns/<int:camp_id>', methods=['PUT'])
@auth_required
def update_campaign(camp_id):
    user_id = request.current_user['id']
    data = request.get_json() or {}
    conn = get_db_connection()
    try:
        existing = conn.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', (camp_id, user_id)).fetchone()
        if not existing:
            return jsonify({"error": "Campaign not found"}), 404

        title = data.get('title', existing['title']).strip()
        description = data.get('description', existing['description']).strip()
        budget = str(data.get('budget', existing['budget'])).strip()
        try:
            target_reach = int(data.get('target_reach', existing['target_reach']))
        except (TypeError, ValueError):
            return jsonify({"error": "target_reach must be a valid integer"}), 400
        status = data.get('status', existing['status']).strip()
        end_date = data.get('end_date', existing['end_date'])

        conn.execute('''
        UPDATE campaigns
        SET title = ?, description = ?, budget = ?, target_reach = ?, status = ?, end_date = ?
        WHERE id = ? AND user_id = ?
        ''', (title, description, budget, target_reach, status, end_date, camp_id, user_id))
        conn.commit()

        updated = conn.execute('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', (camp_id, user_id)).fetchone()
    finally:
        conn.close()
    return jsonify(dict(updated))

@app.route('/api/campaigns/<int:camp_id>', methods=['DELETE'])
@auth_required
def delete_campaign(camp_id):
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('UPDATE posts SET campaign_id = NULL WHERE campaign_id = ? AND user_id = ?', (camp_id, user_id))
        cursor.execute('DELETE FROM campaigns WHERE id = ? AND user_id = ?', (camp_id, user_id))
        conn.commit()
        deleted = cursor.rowcount > 0
    finally:
        conn.close()

    if deleted:
        return jsonify({"success": True, "message": "Campaign deleted successfully"})
    return jsonify({"error": "Campaign not found"}), 404

# --- ANALYTICS ENDPOINTS ---
@app.route('/api/analytics', methods=['GET'])
@auth_required
def get_analytics():
    user_id = request.current_user['id']
    range_filter = request.args.get('range', '7d').lower() # '7d', '30d', '3m', '1y'

    conn = get_db_connection()
    try:
        ensure_user_social_accounts(conn, user_id)
        accounts = conn.execute('SELECT * FROM social_accounts WHERE user_id = ? ORDER BY id ASC', (user_id,)).fetchall()
        total_followers = sum(a['followers'] for a in accounts)
        total_following = sum(a['following'] for a in accounts)

        posts_stats = conn.execute('''
        SELECT
            COUNT(*) as total_posts,
            COALESCE(SUM(likes), 0) as total_likes,
            COALESCE(SUM(comments), 0) as total_comments,
            COALESCE(SUM(shares), 0) as total_shares,
            COALESCE(SUM(reach), 0) as total_reach
        FROM posts
        WHERE user_id = ?
        ''', (user_id,)).fetchone()

        total_posts = posts_stats['total_posts'] or 0
        total_likes = posts_stats['total_likes'] or 0
        total_reach = posts_stats['total_reach'] or 0
        total_interactions = total_likes + (posts_stats['total_comments'] or 0) + (posts_stats['total_shares'] or 0)

        history = []
        if range_filter == '30d':
            for i in range(1, 31, 3):
                history.append({
                    "day": f"Day {i}",
                    "impressions": int(total_reach * 0.03) + (i * 1200 if total_reach > 0 else 0),
                    "reach": int(total_reach * 0.02) + (i * 900 if total_reach > 0 else 0),
                    "engagement": round(5.0 + (i * 0.08), 1) if total_reach > 0 else 0.0
                })
        elif range_filter == '3m':
            for i in range(1, 13):
                history.append({
                    "day": f"Wk {i}",
                    "impressions": int(total_reach * 0.08) + (i * 4500 if total_reach > 0 else 0),
                    "reach": int(total_reach * 0.06) + (i * 3200 if total_reach > 0 else 0),
                    "engagement": round(5.2 + (i * 0.12), 1) if total_reach > 0 else 0.0
                })
        elif range_filter == '1y':
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            for m in months:
                history.append({
                    "day": m,
                    "impressions": int(total_reach * 0.15) + (len(m) * 12000 if total_reach > 0 else 0),
                    "reach": int(total_reach * 0.12) + (len(m) * 8500 if total_reach > 0 else 0),
                    "engagement": round(5.8 + (len(m) * 0.15), 1) if total_reach > 0 else 0.0
                })
        else:
            days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            for idx, d in enumerate(days):
                history.append({
                    "day": d,
                    "impressions": (125000 + (idx * 15000)) if total_reach > 0 else 0,
                    "reach": (98000 + (idx * 12000)) if total_reach > 0 else 0,
                    "engagement": round(4.8 + (idx * 0.4), 1) if total_reach > 0 else 0.0
                })

        platform_distribution = []
        colors = {
            "Instagram": "#E1306C",
            "TikTok": "#000000",
            "Facebook": "#1877F2",
            "YouTube": "#FF0000",
            "LinkedIn": "#0A66C2",
            "X": "#1DA1F2"
        }

        for acc in accounts:
            pct = round((acc['followers'] / total_followers) * 100) if total_followers > 0 else 0
            platform_distribution.append({
                "platform": acc['platform'],
                "percentage": pct,
                "followers": acc['followers'],
                "color": colors.get(acc['platform'], "#6C5CE7")
            })

        mode_counts = conn.execute('''
        SELECT
            SUM(CASE WHEN publish_mode = 'live' AND status IN ('published', 'partial') THEN 1 ELSE 0 END) as live_posts,
            SUM(CASE WHEN COALESCE(publish_mode, 'sandbox') != 'live' AND status = 'published' THEN 1 ELSE 0 END) as sandbox_posts,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_posts
        FROM posts
        WHERE user_id = ?
        ''', (user_id,)).fetchone()

        live_snapshots = conn.execute('''
        SELECT s.*
        FROM analytics_snapshots s
        INNER JOIN (
            SELECT platform, MAX(id) as max_id
            FROM analytics_snapshots
            WHERE user_id = ? AND source_mode = 'live'
            GROUP BY platform
        ) latest ON s.id = latest.max_id
        WHERE s.user_id = ?
        ORDER BY s.platform ASC
        ''', (user_id, user_id)).fetchall()

        active_oauth = conn.execute(
            'SELECT platform, account_name, handle, last_error, updated_at, expires_at FROM oauth_connections WHERE user_id = ? AND connected = 1',
            (user_id,),
        ).fetchall()

        live_platforms = []
        for snap in live_snapshots:
            item = dict(snap)
            try:
                item['details'] = json.loads(item.get('metrics_json') or '{}')
            except Exception:
                item['details'] = {}
            item.pop('metrics_json', None)
            live_platforms.append(item)

        conn_list = []
        for oa in active_oauth:
            oa_dict = dict(oa)
            if oa_dict.get('last_error'):
                oa_dict['last_error'] = redact_secrets(oa_dict['last_error'])
            conn_list.append(oa_dict)
    finally:
        conn.close()

    return jsonify({
        "summary": {
            "total_followers": total_followers,
            "total_following": total_following,
            "weekly_growth": "+14.8%" if total_followers > 0 else "0.0%",
            "total_posts": total_posts,
            "total_likes": total_likes,
            "total_reach": total_reach,
            "total_interactions": total_interactions,
            "engagement_rate": "6.4%" if total_interactions > 0 else "0.0%",
            "range": range_filter
        },
        "history": history,
        "platforms": platform_distribution,
        "live_analytics": {
            "connected_live_accounts": conn_list,
            "snapshots": live_platforms,
            "live_posts_count": int(mode_counts['live_posts'] or 0) if mode_counts else 0,
            "sandbox_posts_count": int(mode_counts['sandbox_posts'] or 0) if mode_counts else 0,
            "failed_posts_count": int(mode_counts['failed_posts'] or 0) if mode_counts else 0,
        }
    })

# --- RECENT ACTIVITY ---
@app.route('/api/activity', methods=['GET'])
@auth_required
def get_activity():
    user_id = request.current_user['id']
    conn = get_db_connection()
    try:
        activities = conn.execute(
            'SELECT * FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT 15',
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    return jsonify([dict(a) for a in activities])

# --- GLOBAL SEARCH ENDPOINT ---
@app.route('/api/search', methods=['GET'])
@auth_required
def global_search():
    user_id = request.current_user['id']
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({"posts": [], "accounts": [], "campaigns": []})

    conn = get_db_connection()
    try:
        like_q = f'%{q}%'

        posts = conn.execute('''
        SELECT id, content, platforms, status, scheduled_for, created_at
        FROM posts
        WHERE user_id = ? AND (content LIKE ? OR platforms LIKE ?)
        LIMIT 6
        ''', (user_id, like_q, like_q)).fetchall()

        accounts = conn.execute('''
        SELECT id, platform, name, handle, followers, connected
        FROM social_accounts
        WHERE user_id = ? AND (name LIKE ? OR handle LIKE ? OR platform LIKE ?)
        LIMIT 6
        ''', (user_id, like_q, like_q, like_q)).fetchall()

        campaigns = conn.execute('''
        SELECT id, title, description, status, progress, budget
        FROM campaigns
        WHERE user_id = ? AND (title LIKE ? OR description LIKE ?)
        LIMIT 6
        ''', (user_id, like_q, like_q)).fetchall()
    finally:
        conn.close()

    result_posts = []
    for p in posts:
        item = dict(p)
        try:
            item['platforms'] = json.loads(item['platforms'])
        except Exception:
            item['platforms'] = [item['platforms']] if item['platforms'] else []
        result_posts.append(item)

    return jsonify({
        "posts": result_posts,
        "accounts": [dict(a) for a in accounts],
        "campaigns": [dict(c) for c in campaigns]
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    print(f"SocialSync Flask Backend running on http://{host}:{port}")
    app.run(host=host, port=port, debug=False)
