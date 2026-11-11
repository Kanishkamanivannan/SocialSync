import sqlite3
import os
import json
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

DB_FILE = os.path.join(os.path.dirname(__file__), 'socialsync.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.row_factory = sqlite3.Row
    return conn

def _ensure_columns(cursor, table, columns_def):
    """Safely adds missing columns to existing SQLite tables."""
    cursor.execute(f"PRAGMA table_info({table})")
    existing_cols = [row['name'] for row in cursor.fetchall()]
    for col_name, col_type in columns_def.items():
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")

def _migrate_posts_table_if_needed(conn):
    """
    Safely widens posts.status CHECK constraint to allow 'partial' and 'failed'
    without deleting or altering any existing post rows.
    """
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='posts'"
    ).fetchone()
    if not row or not row['sql']:
        return
    if "'failed'" in row['sql'] and "'partial'" in row['sql']:
        return

    cursor.execute("PRAGMA foreign_keys = OFF")
    cursor.execute("BEGIN")
    try:
        cursor.execute('''
        CREATE TABLE posts_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            campaign_id INTEGER,
            content TEXT NOT NULL,
            platforms TEXT NOT NULL,
            media_url TEXT,
            media_type TEXT DEFAULT 'text',
            status TEXT NOT NULL CHECK(status IN ('draft', 'scheduled', 'published', 'partial', 'failed')),
            scheduled_for TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            likes INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            shares INTEGER DEFAULT 0,
            reach INTEGER DEFAULT 0,
            publish_mode TEXT DEFAULT 'sandbox',
            publish_results TEXT,
            error_message TEXT,
            video_title TEXT,
            youtube_privacy TEXT DEFAULT 'private',
            published_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
        )
        ''')
        cursor.execute('''
        INSERT INTO posts_new (
            id, user_id, campaign_id, content, platforms, media_url,
            media_type, status, scheduled_for, created_at, likes, comments, shares, reach, publish_mode
        )
        SELECT
            id,
            COALESCE(user_id, 1),
            campaign_id,
            content,
            platforms,
            media_url,
            CASE WHEN media_url IS NOT NULL AND TRIM(media_url) != '' THEN 'image' ELSE 'text' END,
            status,
            scheduled_for,
            created_at,
            COALESCE(likes, 0),
            COALESCE(comments, 0),
            COALESCE(shares, 0),
            COALESCE(reach, 0),
            'sandbox'
        FROM posts
        ''')
        cursor.execute("DROP TABLE posts")
        cursor.execute("ALTER TABLE posts_new RENAME TO posts")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.execute("PRAGMA foreign_keys = ON")


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT DEFAULT '@alexmorgan',
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        role TEXT DEFAULT 'Social Media Manager',
        notify_publish INTEGER DEFAULT 1,
        notify_engage INTEGER DEFAULT 1,
        notify_email INTEGER DEFAULT 0,
        token_version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Ensure all user columns exist
    _ensure_columns(cursor, 'users', {
        'username': "TEXT DEFAULT '@alexmorgan'",
        'notify_publish': "INTEGER DEFAULT 1",
        'notify_engage': "INTEGER DEFAULT 1",
        'notify_email': "INTEGER DEFAULT 0",
        'token_version': "INTEGER DEFAULT 1",
        'app_mode': "TEXT DEFAULT 'demo'",
        'demo_seeded': "INTEGER DEFAULT 0"
    })
    cursor.execute("UPDATE users SET token_version = 1 WHERE token_version IS NULL")
    cursor.execute("UPDATE users SET app_mode = 'demo' WHERE app_mode IS NULL OR app_mode NOT IN ('demo', 'live')")
    cursor.execute("UPDATE users SET demo_seeded = 0 WHERE demo_seeded IS NULL")

    # 2. Social Accounts Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS social_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        handle TEXT NOT NULL,
        avatar TEXT,
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        growth TEXT DEFAULT '+0.0%',
        connected INTEGER DEFAULT 1,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        mode TEXT DEFAULT 'simulated',
        credentials_configured INTEGER DEFAULT 0,
        external_account_id TEXT,
        oauth_provider TEXT,
        account_meta TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    _ensure_columns(cursor, 'social_accounts', {
        'user_id': 'INTEGER DEFAULT 1',
        'mode': "TEXT DEFAULT 'simulated'",
        'credentials_configured': 'INTEGER DEFAULT 0',
        'external_account_id': 'TEXT',
        'oauth_provider': 'TEXT',
        'account_meta': 'TEXT',
        'workspace_mode': "TEXT DEFAULT 'live'"
    })
    cursor.execute("UPDATE social_accounts SET workspace_mode = 'live' WHERE workspace_mode IS NULL")

    # 3. Campaigns Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        progress INTEGER DEFAULT 0,
        target_reach INTEGER DEFAULT 50000,
        current_reach INTEGER DEFAULT 0,
        budget TEXT DEFAULT '$1,500',
        start_date TEXT,
        end_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        workspace_mode TEXT DEFAULT 'live',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    _ensure_columns(cursor, 'campaigns', {
        'user_id': 'INTEGER DEFAULT 1',
        'created_at': 'TIMESTAMP',
        'workspace_mode': "TEXT DEFAULT 'live'"
    })
    cursor.execute("UPDATE campaigns SET workspace_mode = 'live' WHERE workspace_mode IS NULL")

    # 4. Posts Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        campaign_id INTEGER,
        content TEXT NOT NULL,
        platforms TEXT NOT NULL, -- JSON list of platforms
        media_url TEXT,
        media_type TEXT DEFAULT 'text',
        status TEXT NOT NULL CHECK(status IN ('draft', 'scheduled', 'published', 'partial', 'failed')),
        scheduled_for TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0,
        publish_mode TEXT DEFAULT 'sandbox',
        publish_results TEXT,
        error_message TEXT,
        video_title TEXT,
        youtube_privacy TEXT DEFAULT 'private',
        published_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
    )
    ''')
    conn.commit()
    _migrate_posts_table_if_needed(conn)
    _ensure_columns(cursor, 'posts', {
        'user_id': 'INTEGER DEFAULT 1',
        'campaign_id': 'INTEGER',
        'media_type': "TEXT DEFAULT 'text'",
        'publish_mode': "TEXT DEFAULT 'sandbox'",
        'publish_results': 'TEXT',
        'error_message': 'TEXT',
        'video_title': 'TEXT',
        'youtube_privacy': "TEXT DEFAULT 'private'",
        'published_at': 'TIMESTAMP',
        'workspace_mode': "TEXT DEFAULT 'live'"
    })
    cursor.execute("UPDATE posts SET workspace_mode = 'live' WHERE workspace_mode IS NULL")

    # 5. Activity Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        platform TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        workspace_mode TEXT DEFAULT 'live',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    _ensure_columns(cursor, 'activity', {
        'user_id': 'INTEGER DEFAULT 1',
        'workspace_mode': "TEXT DEFAULT 'live'"
    })
    cursor.execute("UPDATE activity SET workspace_mode = 'live' WHERE workspace_mode IS NULL")

    # 6. OAuth Connections Table (Encrypted access & refresh tokens per user/platform)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS oauth_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        platform TEXT NOT NULL,
        provider TEXT NOT NULL,
        external_account_id TEXT NOT NULL,
        account_name TEXT,
        handle TEXT,
        avatar TEXT,
        encrypted_access_token TEXT NOT NULL,
        encrypted_refresh_token TEXT,
        encrypted_user_token TEXT,
        token_type TEXT DEFAULT 'Bearer',
        scopes TEXT,
        expires_at TIMESTAMP,
        page_id TEXT,
        extra_json TEXT,
        connected INTEGER DEFAULT 1,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform, external_account_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    _ensure_columns(cursor, 'oauth_connections', {
        'encrypted_user_token': 'TEXT',
    })

    # 7. Real Live API Analytics Snapshots
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        platform TEXT NOT NULL,
        external_account_id TEXT,
        followers INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0,
        engagement INTEGER DEFAULT 0,
        video_count INTEGER DEFAULT 0,
        media_count INTEGER DEFAULT 0,
        metrics_json TEXT,
        source_mode TEXT DEFAULT 'live',
        permission_note TEXT,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # 8. Single-Use Server-Side OAuth State Store (CSRF & Replay Protection)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS oauth_states (
        nonce TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        method TEXT,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    conn.commit()

    # 6. Migrate unhashed passwords to secure hashes
    cursor.execute('SELECT id, password FROM users')
    users = cursor.fetchall()
    for u in users:
        pwd = u['password']
        if not pwd.startswith(('scrypt:', 'pbkdf2:')):
            hashed = generate_password_hash(pwd)
            cursor.execute('UPDATE users SET password = ? WHERE id = ?', (hashed, u['id']))
    conn.commit()

    seed_demo_data(cursor, conn)
    _sanitize_legacy_gibberish_records(cursor, conn)
    _upgrade_unmodified_v1_demo_seed(cursor, conn)
    conn.close()


def _sanitize_legacy_gibberish_records(cursor, conn):
    """
    Replaces known placeholder/gibberish text left over from manual UI typing tests
    with realistic professional marketing content without deleting any database rows.
    """
    campaign_replacements = [
        (
            "jjjiojoi",
            "Brand Awareness Accelerator",
            "Multi-channel storytelling initiative focused on audience growth across Instagram and Facebook.",
            "$1,800",
        ),
        (
            "bkhwshdljwdj'WL'D",
            "Q4 Multi-Channel Creator Launch",
            "Coordinated product showcase highlighting short-form video reels and YouTube walkthroughs.",
            "$2,400",
        ),
    ]
    for old_title, new_title, new_desc, new_budget in campaign_replacements:
        row = cursor.execute(
            "SELECT id, budget FROM campaigns WHERE title = ?",
            (old_title,),
        ).fetchone()
        if row:
            budget_val = new_budget if str(row['budget'] or '').isdigit() else row['budget']
            cursor.execute(
                "UPDATE campaigns SET title = ?, description = ?, budget = ? WHERE id = ?",
                (new_title, new_desc, budget_val, row['id']),
            )

    post_replacements = [
        (
            "jijijio #MarketingTips",
            "Planning this week's multi-channel content calendar with cohesive visual hooks. #MarketingTips",
        ),
        (
            "kkuh #Growth2026",
            "Consistent short-form storytelling drives steady organic reach across social channels. #Growth2026",
        ),
        (
            "Nothing...Just Good morning! #Growth2026 #BrandStrategy",
            "Good morning creators! Reviewing weekly engagement highlights and queuing fresh posts. #Growth2026 #BrandStrategy",
        ),
    ]
    for old_content, new_content in post_replacements:
        cursor.execute(
            "UPDATE posts SET content = ? WHERE content = ?",
            (new_content, old_content),
        )
    conn.commit()

def seed_demo_data(cursor, conn):
    # Check if demo user exists
    cursor.execute('SELECT COUNT(*) as count FROM users')
    if cursor.fetchone()['count'] == 0:
        cursor.execute('''
        INSERT INTO users (name, username, email, password, avatar, role)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'Alex Morgan',
            '@alexmorgan',
            'alex@socialsync.io',
            generate_password_hash('password123'),
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            'Lead Brand Strategist'
        ))

    # Check social accounts
    cursor.execute('SELECT COUNT(*) as count FROM social_accounts')
    if cursor.fetchone()['count'] == 0:
        accounts = [
            (1, 'Instagram', 'SocialSync Official', '@socialsync_app', 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80', 142500, 480, '+12.4%', 1, 'simulated', 0),
            (1, 'Facebook', 'SocialSync Page', '@socialsynchq', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=80', 88400, 120, '+5.8%', 1, 'simulated', 0),
            (1, 'X', 'SocialSync Tech', '@socialsync_live', 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=120&auto=format&fit=crop&q=80', 65200, 890, '+18.2%', 1, 'simulated', 0),
            (1, 'LinkedIn', 'SocialSync Inc.', 'company/socialsync', 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=120&auto=format&fit=crop&q=80', 34100, 50, '+8.7%', 1, 'simulated', 0),
            (1, 'YouTube', 'SocialSync Studio', '@SocialSyncStudio', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=120&auto=format&fit=crop&q=80', 52900, 15, '+14.1%', 1, 'simulated', 0),
            (1, 'TikTok', 'SocialSync Viral', '@socialsync_now', 'https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=120&auto=format&fit=crop&q=80', 215400, 310, '+24.6%', 1, 'simulated', 0)
        ]
        cursor.executemany('''
        INSERT INTO social_accounts (user_id, platform, name, handle, avatar, followers, following, growth, connected, mode, credentials_configured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', accounts)

    # Check campaigns
    cursor.execute('SELECT COUNT(*) as count FROM campaigns')
    if cursor.fetchone()['count'] == 0:
        now = datetime.now()
        campaigns = [
            (1, "Q4 Product Launch Blitz", "Cross-platform blitz to introduce SocialSync 2.0 to enterprise creators.", "active", 72, 100000, 72400, "$3,200", (now - timedelta(days=20)).strftime('%Y-%m-%d'), (now + timedelta(days=25)).strftime('%Y-%m-%d')),
            (1, "Holiday Creator Giveaway", "Instagram & TikTok interactive campaign driving app downloads.", "active", 45, 80000, 36000, "$2,000", (now - timedelta(days=10)).strftime('%Y-%m-%d'), (now + timedelta(days=20)).strftime('%Y-%m-%d')),
            (1, "Thought Leadership Series", "Weekly CEO interview highlights distributed across LinkedIn and X.", "planning", 20, 45000, 9000, "$1,100", now.strftime('%Y-%m-%d'), (now + timedelta(days=45)).strftime('%Y-%m-%d'))
        ]
        cursor.executemany('''
        INSERT INTO campaigns (user_id, title, description, status, progress, target_reach, current_reach, budget, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', campaigns)

    # Check posts
    cursor.execute('SELECT COUNT(*) as count FROM posts')
    if cursor.fetchone()['count'] == 0:
        now = datetime.now()
        posts = [
            (
                1, 1,
                "🚀 Unveiling our next-gen social intelligence suite! Schedule, analyze, and automate cross-platform growth seamlessly. #SocialMediaMarketing #AI #ProductLaunch",
                json.dumps(['Instagram', 'LinkedIn', 'X']),
                "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
                'published',
                (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'),
                1420, 184, 96, 28400
            ),
            (
                1, 2,
                "✨ 5 Proven Tips to Boost Instagram Engagement in 2026: 1. Authentic Reels 2. Interactive Polls 3. Consistent Timing 4. Direct DMs 5. Micro-influencer collabs! Save this for later 📌",
                json.dumps(['Instagram', 'TikTok']),
                "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80",
                'published',
                (now - timedelta(hours=18)).strftime('%Y-%m-%d %H:%M:%S'),
                3890, 420, 312, 64200
            ),
            (
                1, 3,
                "🎙️ Live Q&A this Thursday at 3 PM EST: How Top Brands 10x Their Social Reach with Unified Scheduling. RSVP link in bio!",
                json.dumps(['LinkedIn', 'X', 'Facebook']),
                "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80",
                'scheduled',
                (now + timedelta(days=1, hours=4)).strftime('%Y-%m-%d %H:%M:%S'),
                0, 0, 0, 0
            ),
            (
                1, 1,
                "Behind the scenes at SocialSync HQ! Building the features you asked for. What tool would you love to see next? Drop a comment! 👇",
                json.dumps(['Instagram', 'YouTube']),
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
                'scheduled',
                (now + timedelta(days=2, hours=2)).strftime('%Y-%m-%d %H:%M:%S'),
                0, 0, 0, 0
            ),
            (
                1, None,
                "Drafting our Q4 Creator Growth Playbook: key benchmarks across TikTok vs YouTube Shorts. Looking for beta readers!",
                json.dumps(['X', 'LinkedIn']),
                None,
                'draft',
                None,
                0, 0, 0, 0
            )
        ]
        cursor.executemany('''
        INSERT INTO posts (user_id, campaign_id, content, platforms, media_url, status, scheduled_for, likes, comments, shares, reach)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', posts)

    # Check activity
    cursor.execute('SELECT COUNT(*) as count FROM activity')
    if cursor.fetchone()['count'] == 0:
        activities = [
            (1, "follower", "New Milestone Reached", "Instagram passed 140K followers with +12.4% weekly surge.", "Instagram"),
            (1, "post", "Post Published Automatically", "'5 Proven Tips to Boost Instagram Engagement' published to 2 platforms.", "Instagram"),
            (1, "like", "Surge in Engagements", "LinkedIn campaign reached 2,400+ reactions in under 4 hours.", "LinkedIn"),
            (1, "schedule", "Post Scheduled", "Live Q&A teaser scheduled for Thursday at 3:00 PM.", "X"),
            (1, "account", "Account Re-synced", "YouTube Studio analytics synchronized with zero errors.", "YouTube")
        ]
        cursor.executemany('''
        INSERT INTO activity (user_id, type, title, description, platform)
        VALUES (?, ?, ?, ?, ?)
        ''', activities)

    conn.commit()


def ensure_user_social_accounts(conn, user_id: int) -> None:
    """Provisions isolated default live-workspace platform entries for a user."""
    existing = conn.execute(
        "SELECT COUNT(*) as cnt FROM social_accounts WHERE user_id = ? AND COALESCE(workspace_mode, 'live') = 'live'",
        (user_id,),
    ).fetchone()
    if existing and existing['cnt'] > 0:
        return
    defaults = [
        (user_id, 'Instagram', 'Instagram Channel', '@instagram_live', 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0, 'live'),
        (user_id, 'Facebook', 'Facebook Page', '@facebook_live', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0, 'live'),
        (user_id, 'X', 'X Channel', '@x_sandbox', 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0, 'live'),
        (user_id, 'LinkedIn', 'LinkedIn Page', 'company/sandbox', 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0, 'live'),
        (user_id, 'YouTube', 'YouTube Channel', '@youtube_live', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0, 'live'),
        (user_id, 'TikTok', 'TikTok Channel', '@tiktok_sandbox', 'https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0, 'live'),
    ]
    conn.executemany('''
    INSERT INTO social_accounts (user_id, platform, name, handle, avatar, followers, following, growth, connected, mode, credentials_configured, workspace_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', defaults)
    conn.commit()


_DEMO_CHANNEL_SPECS = [
    ('Instagram', 'SocialSync Demo IG', '@socialsync_demo', 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80', 84200, 412, '+11.4%'),
    ('Facebook', 'SocialSync Demo Page', '@socialsynchq_demo', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=80', 38400, 145, '+6.2%'),
    ('YouTube', 'SocialSync Demo Studio', '@SocialSyncStudioDemo', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=120&auto=format&fit=crop&q=80', 26500, 24, '+13.5%'),
    ('X', 'SocialSync Tech Demo', '@socialsync_tech', 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=120&auto=format&fit=crop&q=80', 18900, 520, '+9.1%'),
    ('LinkedIn', 'SocialSync Demo Inc.', 'company/socialsync-demo', 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=120&auto=format&fit=crop&q=80', 11700, 68, '+7.4%'),
    ('TikTok', 'SocialSync Viral Demo', '@socialsync_viral', 'https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=120&auto=format&fit=crop&q=80', 68900, 290, '+16.8%'),
]


def _demo_publish_results(platforms: list[str], ts: str) -> str:
    return json.dumps([
        {
            'platform': p,
            'success': True,
            'simulated': True,
            'mode': 'demo',
            'label': 'Demo Published',
            'published_at': ts,
            'message': 'Demo Published (Simulated in Demo Mode)',
        }
        for p in platforms
    ])


def _demo_day_ts(now: datetime, days_ago: int, hours_back_today: int = 0) -> str:
    if days_ago == 0:
        dt = now - timedelta(hours=min(hours_back_today, now.hour))
    else:
        dt = (now - timedelta(days=days_ago)).replace(hour=14, minute=15, second=0, microsecond=0)
    return dt.strftime('%Y-%m-%d %H:%M:%S')


def _build_demo_published_specs(now: datetime, c1, c2) -> list[dict]:
    """Returns 8 cohesive Demo Published posts spread across the trailing 7 days."""
    specs = [
        {
            'campaign_id': c1,
            'content': "Introducing SocialSync Studio — plan, schedule, and review multi-channel releases from a single workspace. #ProductLaunch #CreatorStudio",
            'platforms': ['Instagram', 'Facebook'],
            'media_url': "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 6),
            'likes': 890, 'comments': 94, 'shares': 52, 'reach': 21400,
        },
        {
            'campaign_id': c2,
            'content': "5 Proven Strategies to Boost Audience Retention in 2026: consistent hooks, crisp pacing, and interactive community follow-ups.",
            'platforms': ['Instagram', 'YouTube'],
            'media_url': "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 5),
            'likes': 1040, 'comments': 112, 'shares': 64, 'reach': 24800,
        },
        {
            'campaign_id': None,
            'content': "Weekly Analytics Breakdown: How shorter first-frame intros lifted cross-channel watch completion across Q4 launches.",
            'platforms': ['LinkedIn', 'X'],
            'media_url': "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 4),
            'likes': 790, 'comments': 86, 'shares': 41, 'reach': 19600,
        },
        {
            'campaign_id': c2,
            'content': "60-second Creator Edit Workflow: batching vertical reels and YouTube Shorts without duplicating timelines. #CreatorOps",
            'platforms': ['TikTok', 'Instagram'],
            'media_url': "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 3),
            'likes': 1180, 'comments': 128, 'shares': 79, 'reach': 28500,
        },
        {
            'campaign_id': c1,
            'content': "Q4 Product Launch Blitz Milestone: teams scheduling three formats weekly saw steady organic reach gains across channels.",
            'platforms': ['Instagram', 'Facebook', 'LinkedIn'],
            'media_url': "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 2),
            'likes': 1310, 'comments': 145, 'shares': 88, 'reach': 31200,
        },
        {
            'campaign_id': None,
            'content': "Studio Walkthrough: Designing high-contrast thumbnail hooks and concise copy that convert casual scrollers.",
            'platforms': ['YouTube', 'X'],
            'media_url': "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 1),
            'likes': 1090, 'comments': 118, 'shares': 67, 'reach': 26900,
        },
        {
            'campaign_id': None,
            'content': "Community Spotlight: Highlighting top creator templates built for fast feedback cycles inside SocialSync.",
            'platforms': ['Facebook', 'TikTok'],
            'media_url': "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 0, hours_back_today=6),
            'likes': 760, 'comments': 82, 'shares': 44, 'reach': 18400,
        },
        {
            'campaign_id': None,
            'content': "Midweek Publishing Checklist: optimal posting slots, concise captions, and measurable campaign pacing.",
            'platforms': ['Instagram', 'YouTube'],
            'media_url': "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80",
            'ts': _demo_day_ts(now, 0, hours_back_today=2),
            'likes': 980, 'comments': 106, 'shares': 62, 'reach': 23400,
        },
    ]
    return specs


def _upgrade_unmodified_v1_demo_seed(cursor, conn):
    """
    Non-destructively updates untouched v1 demo baselines (598,500 audience / 2 published posts)
    to the cohesive 248,600 audience + 8-post 7-day baseline without deleting any rows.
    """
    user_rows = cursor.execute(
        "SELECT DISTINCT user_id FROM social_accounts WHERE workspace_mode = 'demo'"
    ).fetchall()
    now = datetime.now()
    changed = False
    for ur in user_rows:
        uid = ur['user_id']
        accs = cursor.execute(
            "SELECT id, platform, followers FROM social_accounts WHERE user_id = ? AND workspace_mode = 'demo'",
            (uid,),
        ).fetchall()
        pub_posts = cursor.execute(
            "SELECT id, reach, campaign_id FROM posts WHERE user_id = ? AND workspace_mode = 'demo' AND status = 'published' ORDER BY id ASC",
            (uid,),
        ).fetchall()
        if sum(a['followers'] for a in accs) != 598500 or len(pub_posts) != 2 or sum(p['reach'] for p in pub_posts) != 99200:
            continue

        spec_by_plat = {row[0]: row for row in _DEMO_CHANNEL_SPECS}
        for acc in accs:
            spec = spec_by_plat.get(acc['platform'])
            if spec:
                cursor.execute(
                    '''
                    UPDATE social_accounts
                    SET name = ?, handle = ?, avatar = ?, followers = ?, following = ?, growth = ?
                    WHERE id = ?
                    ''',
                    (spec[1], spec[2], spec[3], spec[4], spec[5], spec[6], acc['id']),
                )

        camps = cursor.execute(
            "SELECT id FROM campaigns WHERE user_id = ? AND workspace_mode = 'demo' ORDER BY id ASC",
            (uid,),
        ).fetchall()
        c1 = camps[0]['id'] if len(camps) > 0 else pub_posts[0]['campaign_id']
        c2 = camps[1]['id'] if len(camps) > 1 else c1
        specs = _build_demo_published_specs(now, c1, c2)

        for idx, existing_post in enumerate(pub_posts):
            sp = specs[idx]
            cursor.execute(
                '''
                UPDATE posts
                SET campaign_id = ?, content = ?, platforms = ?, media_url = ?, media_type = 'image',
                    scheduled_for = ?, published_at = ?, created_at = ?,
                    likes = ?, comments = ?, shares = ?, reach = ?, publish_mode = 'demo', publish_results = ?
                WHERE id = ?
                ''',
                (
                    sp['campaign_id'], sp['content'], json.dumps(sp['platforms']), sp['media_url'],
                    sp['ts'], sp['ts'], sp['ts'],
                    sp['likes'], sp['comments'], sp['shares'], sp['reach'],
                    _demo_publish_results(sp['platforms'], sp['ts']), existing_post['id'],
                ),
            )

        for sp in specs[2:]:
            cursor.execute(
                '''
                INSERT INTO posts (
                    user_id, campaign_id, content, platforms, media_url, media_type,
                    status, scheduled_for, published_at, created_at, likes, comments, shares, reach,
                    publish_mode, publish_results, workspace_mode
                )
                VALUES (?, ?, ?, ?, ?, 'image', 'published', ?, ?, ?, ?, ?, ?, ?, 'demo', ?, 'demo')
                ''',
                (
                    uid, sp['campaign_id'], sp['content'], json.dumps(sp['platforms']), sp['media_url'],
                    sp['ts'], sp['ts'], sp['ts'],
                    sp['likes'], sp['comments'], sp['shares'], sp['reach'],
                    _demo_publish_results(sp['platforms'], sp['ts']),
                ),
            )

        cursor.execute(
            '''
            UPDATE activity
            SET description = 'Instagram demo channel reached 84.2K followers (+11.4% trend).'
            WHERE user_id = ? AND workspace_mode = 'demo' AND title = 'Demo Milestone Reached' AND description LIKE '%142.5K%'
            ''',
            (uid,),
        )
        cursor.execute(
            '''
            UPDATE activity
            SET description = 'Q4 Product Launch Blitz reached 52,600 simulated impressions from linked posts.'
            WHERE user_id = ? AND workspace_mode = 'demo' AND title = 'Campaign Milestone (Demo)' AND description LIKE '%52,400%'
            ''',
            (uid,),
        )
        changed = True

    if changed:
        conn.commit()


def ensure_user_demo_workspace(conn, user_id: int) -> None:
    """
    Lazily initializes rich Dummy Demo Mode records inside SQLite strictly isolated
    under workspace_mode = 'demo', seeded only once per user so edits/deletes persist.
    """
    existing_accs = conn.execute(
        "SELECT COUNT(*) as cnt FROM social_accounts WHERE user_id = ? AND workspace_mode = 'demo'",
        (user_id,),
    ).fetchone()
    if not existing_accs or existing_accs['cnt'] == 0:
        demo_accounts = [
            (user_id, plat, name, handle, avatar, followers, following, growth, 1, 'demo', 0, 'demo')
            for (plat, name, handle, avatar, followers, following, growth) in _DEMO_CHANNEL_SPECS
        ]
        conn.executemany('''
        INSERT INTO social_accounts (user_id, platform, name, handle, avatar, followers, following, growth, connected, mode, credentials_configured, workspace_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', demo_accounts)

    user_row = conn.execute('SELECT demo_seeded FROM users WHERE id = ?', (user_id,)).fetchone()
    if user_row and user_row['demo_seeded']:
        conn.commit()
        return

    now = datetime.now()

    camp_ids = []
    existing_camps = conn.execute(
        "SELECT id FROM campaigns WHERE user_id = ? AND workspace_mode = 'demo' ORDER BY id ASC",
        (user_id,),
    ).fetchall()
    if not existing_camps:
        demo_campaigns = [
            (user_id, "Q4 Product Launch Blitz", "Cross-platform launch campaign introducing SocialSync Studio workflows across Instagram and Facebook.", "active", 53, 100000, 0, "$3,200", (now - timedelta(days=14)).strftime('%Y-%m-%d'), (now + timedelta(days=21)).strftime('%Y-%m-%d'), 'demo'),
            (user_id, "Creator Shorts Sprint", "High-frequency short-form video series driving tutorial views across Instagram and YouTube.", "active", 67, 80000, 0, "$2,000", (now - timedelta(days=7)).strftime('%Y-%m-%d'), (now + timedelta(days=18)).strftime('%Y-%m-%d'), 'demo'),
            (user_id, "Community Highlights Series", "Weekly creator interviews and educational threads scheduled for steady audience growth.", "planning", 0, 45000, 0, "$1,100", now.strftime('%Y-%m-%d'), (now + timedelta(days=35)).strftime('%Y-%m-%d'), 'demo'),
        ]
        cur = conn.cursor()
        for row in demo_campaigns:
            cur.execute('''
            INSERT INTO campaigns (user_id, title, description, status, progress, target_reach, current_reach, budget, start_date, end_date, workspace_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', row)
            camp_ids.append(cur.lastrowid)
    else:
        camp_ids = [r['id'] for r in existing_camps]

    existing_posts = conn.execute(
        "SELECT COUNT(*) as cnt FROM posts WHERE user_id = ? AND workspace_mode = 'demo'",
        (user_id,),
    ).fetchone()
    if not existing_posts or existing_posts['cnt'] == 0:
        c1 = camp_ids[0] if len(camp_ids) > 0 else None
        c2 = camp_ids[1] if len(camp_ids) > 1 else c1
        c3 = camp_ids[2] if len(camp_ids) > 2 else c1

        sched1 = (now + timedelta(hours=4)).strftime('%Y-%m-%d %H:%M:%S')
        sched2 = (now + timedelta(days=2, hours=2)).strftime('%Y-%m-%d %H:%M:%S')
        created_now = now.strftime('%Y-%m-%d %H:%M:%S')

        demo_posts = [
            (
                user_id, sp['campaign_id'], sp['content'], json.dumps(sp['platforms']),
                sp['media_url'], 'image', 'published', sp['ts'], sp['ts'], sp['ts'],
                sp['likes'], sp['comments'], sp['shares'], sp['reach'],
                'demo', _demo_publish_results(sp['platforms'], sp['ts']),
            )
            for sp in _build_demo_published_specs(now, c1, c2)
        ] + [
            (user_id, c3, "Live Q&A Session: Scaling Content Calendars Across Teams — drop your workflow questions below!", json.dumps(['Facebook', 'LinkedIn', 'X']), "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80", 'image', 'scheduled', sched1, None, created_now, 0, 0, 0, 0, 'demo', json.dumps([])),
            (user_id, c1, "Behind the scenes at the Creator Studio: how we structure weekly video batches for YouTube and Instagram.", json.dumps(['Instagram', 'YouTube']), "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80", 'image', 'scheduled', sched2, None, created_now, 0, 0, 0, 0, 'demo', json.dumps([])),
            (user_id, None, "Draft: Q4 Benchmark Playbook summary thread comparing short-form engagement vs long-form tutorials.", json.dumps(['X', 'LinkedIn']), None, 'text', 'draft', None, None, created_now, 0, 0, 0, 0, 'demo', json.dumps([])),
        ]
        conn.executemany('''
        INSERT INTO posts (
            user_id, campaign_id, content, platforms, media_url, media_type,
            status, scheduled_for, published_at, created_at, likes, comments, shares, reach, publish_mode, publish_results, workspace_mode
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo')
        ''', demo_posts)

    existing_acts = conn.execute(
        "SELECT COUNT(*) as cnt FROM activity WHERE user_id = ? AND workspace_mode = 'demo'",
        (user_id,),
    ).fetchone()
    if not existing_acts or existing_acts['cnt'] == 0:
        act_ts = now.strftime('%Y-%m-%d %H:%M:%S')
        demo_activities = [
            (user_id, "follower", "Demo Milestone Reached", "Instagram demo channel reached 84.2K followers (+11.4% trend).", "Instagram", act_ts, 'demo'),
            (user_id, "post", "Demo Published", "'Midweek Publishing Checklist' marked as Demo Published for Instagram & YouTube.", "Instagram", act_ts, 'demo'),
            (user_id, "like", "Campaign Milestone (Demo)", "Q4 Product Launch Blitz reached 52,600 simulated impressions from linked posts.", "Facebook", act_ts, 'demo'),
            (user_id, "schedule", "Post Scheduled (Demo)", "Live Q&A Session teaser queued on the Demo Content Calendar.", "Facebook", act_ts, 'demo'),
            (user_id, "account", "Demo Channels Synced", "Instagram, Facebook, and YouTube demo connections refreshed in SQLite.", "YouTube", act_ts, 'demo'),
        ]
        conn.executemany('''
        INSERT INTO activity (user_id, type, title, description, platform, created_at, workspace_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', demo_activities)

    conn.execute('UPDATE users SET demo_seeded = 1 WHERE id = ?', (user_id,))
    conn.commit()


if __name__ == '__main__':
    init_db()
    print("Database schema upgraded, passwords migrated, and tables initialized successfully!")
