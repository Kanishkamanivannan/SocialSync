import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_FILE = os.path.join(os.path.dirname(__file__), 'socialsync.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT DEFAULT '@alexmorgan',
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        role TEXT DEFAULT 'Social Media Manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN username TEXT DEFAULT '@alexmorgan'")
    except Exception:
        pass

    # Social Accounts Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS social_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        handle TEXT NOT NULL,
        avatar TEXT,
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        growth TEXT DEFAULT '+0.0%',
        connected INTEGER DEFAULT 1,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Posts Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        platforms TEXT NOT NULL, -- JSON list of platforms
        media_url TEXT,
        status TEXT NOT NULL CHECK(status IN ('draft', 'scheduled', 'published')),
        scheduled_for TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0
    )
    ''')

    # Campaigns Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        progress INTEGER DEFAULT 0,
        target_reach INTEGER DEFAULT 50000,
        current_reach INTEGER DEFAULT 0,
        budget TEXT DEFAULT '$1,500',
        start_date TEXT,
        end_date TEXT
    )
    ''')

    # Activity Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        platform TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()
    seed_demo_data(cursor, conn)
    conn.close()

def seed_demo_data(cursor, conn):
    # Check if demo user exists
    cursor.execute('SELECT COUNT(*) as count FROM users')
    if cursor.fetchone()['count'] == 0:
        cursor.execute('''
        INSERT INTO users (name, email, password, avatar, role)
        VALUES (?, ?, ?, ?, ?)
        ''', (
            'Alex Morgan',
            'alex@socialsync.io',
            'password123',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            'Lead Brand Strategist'
        ))

    # Check social accounts
    cursor.execute('SELECT COUNT(*) as count FROM social_accounts')
    if cursor.fetchone()['count'] == 0:
        accounts = [
            ('Instagram', 'SocialSync Official', '@socialsync_app', 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80', 142500, 480, '+12.4%', 1),
            ('Facebook', 'SocialSync Page', '@socialsynchq', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=80', 88400, 120, '+5.8%', 1),
            ('X', 'SocialSync Tech', '@socialsync_live', 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=120&auto=format&fit=crop&q=80', 65200, 890, '+18.2%', 1),
            ('LinkedIn', 'SocialSync Inc.', 'company/socialsync', 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=120&auto=format&fit=crop&q=80', 34100, 50, '+8.7%', 1),
            ('YouTube', 'SocialSync Studio', '@SocialSyncStudio', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=120&auto=format&fit=crop&q=80', 52900, 15, '+14.1%', 1),
            ('TikTok', 'SocialSync Viral', '@socialsync_now', 'https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=120&auto=format&fit=crop&q=80', 215400, 310, '+24.6%', 1)
        ]
        cursor.executemany('''
        INSERT INTO social_accounts (platform, name, handle, avatar, followers, following, growth, connected)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', accounts)

    # Check posts
    cursor.execute('SELECT COUNT(*) as count FROM posts')
    if cursor.fetchone()['count'] == 0:
        now = datetime.now()
        posts = [
            (
                "🚀 Unveiling our next-gen social intelligence suite! Schedule, analyze, and automate cross-platform growth seamlessly. #SocialMediaMarketing #AI #ProductLaunch",
                json.dumps(['Instagram', 'LinkedIn', 'X']),
                "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
                'published',
                (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'),
                1420, 184, 96, 28400
            ),
            (
                "✨ 5 Proven Tips to Boost Instagram Engagement in 2026: 1. Authentic Reels 2. Interactive Polls 3. Consistent Timing 4. Direct DMs 5. Micro-influencer collabs! Save this for later 📌",
                json.dumps(['Instagram', 'TikTok']),
                "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80",
                'published',
                (now - timedelta(hours=18)).strftime('%Y-%m-%d %H:%M:%S'),
                3890, 420, 312, 64200
            ),
            (
                "🎙️ Live Q&A this Thursday at 3 PM EST: How Top Brands 10x Their Social Reach with Unified Scheduling. RSVP link in bio!",
                json.dumps(['LinkedIn', 'X', 'Facebook']),
                "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80",
                'scheduled',
                (now + timedelta(days=1, hours=4)).strftime('%Y-%m-%d %H:%M:%S'),
                0, 0, 0, 0
            ),
            (
                "Behind the scenes at SocialSync HQ! Building the features you asked for. What tool would you love to see next? Drop a comment! 👇",
                json.dumps(['Instagram', 'YouTube']),
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
                'scheduled',
                (now + timedelta(days=2, hours=2)).strftime('%Y-%m-%d %H:%M:%S'),
                0, 0, 0, 0
            ),
            (
                "Drafting our Q4 Creator Growth Playbook: key benchmarks across TikTok vs YouTube Shorts. Looking for beta readers!",
                json.dumps(['X', 'LinkedIn']),
                None,
                'draft',
                None,
                0, 0, 0, 0
            )
        ]
        cursor.executemany('''
        INSERT INTO posts (content, platforms, media_url, status, scheduled_for, likes, comments, shares, reach)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', posts)

    # Check campaigns
    cursor.execute('SELECT COUNT(*) as count FROM campaigns')
    if cursor.fetchone()['count'] == 0:
        campaigns = [
            ("Q4 Product Launch Blitz", "Cross-platform blitz to introduce SocialSync 2.0 to enterprise creators.", "active", 72, 100000, 72400, "$3,200", "2026-10-01", "2026-11-15"),
            ("Holiday Creator Giveaway", "Instagram & TikTok interactive campaign driving app downloads.", "active", 45, 80000, 36000, "$2,000", "2026-10-10", "2026-11-30"),
            ("Thought Leadership Series", "Weekly CEO interview highlights distributed across LinkedIn and X.", "planning", 20, 45000, 9000, "$1,100", "2026-10-20", "2026-12-15")
        ]
        cursor.executemany('''
        INSERT INTO campaigns (title, description, status, progress, target_reach, current_reach, budget, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', campaigns)

    # Check activity
    cursor.execute('SELECT COUNT(*) as count FROM activity')
    if cursor.fetchone()['count'] == 0:
        activities = [
            ("follower", "New Milestone Reached", "Instagram passed 140K followers with +12.4% weekly surge.", "Instagram"),
            ("post", "Post Published Automatically", "'5 Proven Tips to Boost Instagram Engagement' published to 2 platforms.", "Instagram"),
            ("like", "Surge in Engagements", "LinkedIn campaign reached 2,400+ reactions in under 4 hours.", "LinkedIn"),
            ("schedule", "Post Scheduled", "Live Q&A teaser scheduled for Thursday at 3:00 PM.", "X"),
            ("account", "Account Re-synced", "YouTube Studio analytics synchronized with zero errors.", "YouTube")
        ]
        cursor.executemany('''
        INSERT INTO activity (type, title, description, platform)
        VALUES (?, ?, ?, ?)
        ''', activities)

    conn.commit()

if __name__ == '__main__':
    init_db()
    print("Database initialized and demo data seeded successfully!")
