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
        'token_version': "INTEGER DEFAULT 1"
    })
    cursor.execute("UPDATE users SET token_version = 1 WHERE token_version IS NULL")

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
        'account_meta': 'TEXT'
    })

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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    _ensure_columns(cursor, 'campaigns', {
        'user_id': 'INTEGER DEFAULT 1',
        'created_at': 'TIMESTAMP'
    })

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
        'published_at': 'TIMESTAMP'
    })

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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')
    _ensure_columns(cursor, 'activity', {
        'user_id': 'INTEGER DEFAULT 1'
    })

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
    conn.close()

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
    """Provisions isolated default sandbox platform entries for a newly registered user."""
    existing = conn.execute(
        'SELECT COUNT(*) as cnt FROM social_accounts WHERE user_id = ?',
        (user_id,),
    ).fetchone()
    if existing and existing['cnt'] > 0:
        return
    defaults = [
        (user_id, 'Instagram', 'Instagram Channel', '@instagram_sandbox', 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0),
        (user_id, 'Facebook', 'Facebook Page', '@facebook_sandbox', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0),
        (user_id, 'X', 'X Channel', '@x_sandbox', 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0),
        (user_id, 'LinkedIn', 'LinkedIn Page', 'company/sandbox', 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0),
        (user_id, 'YouTube', 'YouTube Channel', '@youtube_sandbox', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0),
        (user_id, 'TikTok', 'TikTok Channel', '@tiktok_sandbox', 'https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=120&auto=format&fit=crop&q=80', 0, 0, '+0.0%', 1, 'sandbox', 0),
    ]
    conn.executemany('''
    INSERT INTO social_accounts (user_id, platform, name, handle, avatar, followers, following, growth, connected, mode, credentials_configured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', defaults)
    conn.commit()


if __name__ == '__main__':
    init_db()
    print("Database schema upgraded, passwords migrated, and tables initialized successfully!")
