import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_db_connection, init_db

app = Flask(__name__)
# Enable CORS for all routes (Vite runs on localhost:5173 / localhost:5174 etc)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Ensure database exists on startup
init_db()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "SocialSync API",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

# --- AUTH ENDPOINTS ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE LOWER(email) = ?', (email,)).fetchone()
    conn.close()

    if user and user['password'] == password:
        return jsonify({
            "success": True,
            "user": {
                "id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "avatar": user['avatar'],
                "role": user['role']
            },
            "token": f"jwt_mock_token_{user['id']}"
        })

    # Demo fallback: allow any demo login if credentials match standard test
    if not user and email == 'alex@socialsync.io':
        return jsonify({
            "success": True,
            "user": {
                "id": 1,
                "name": "Alex Morgan",
                "email": "alex@socialsync.io",
                "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                "role": "Lead Brand Strategist"
            },
            "token": "jwt_mock_token_1"
        })

    return jsonify({"success": False, "message": "Invalid email or password"}), 401

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not name or not email or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400

    conn = get_db_connection()
    existing = conn.execute('SELECT id FROM users WHERE LOWER(email) = ?', (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"success": False, "message": "Email already registered"}), 400

    avatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO users (name, email, password, avatar, role)
    VALUES (?, ?, ?, ?, ?)
    ''', (name, email, password, avatar, 'Social Media Manager'))
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "avatar": avatar,
            "role": "Social Media Manager"
        },
        "token": f"jwt_mock_token_{user_id}"
    }), 201

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    conn = get_db_connection()
    user = conn.execute('SELECT id, name, username, email, avatar, role FROM users LIMIT 1').fetchone()
    conn.close()
    if user:
        data = dict(user)
        if not data.get('username'):
            data['username'] = '@' + data['name'].lower().replace(' ', '')
        return jsonify(data)
    return jsonify({"error": "No user found"}), 404

@app.route('/api/auth/profile', methods=['PUT', 'POST'])
@app.route('/api/auth/me', methods=['PUT'])
def update_profile():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    role = data.get('role', '').strip()
    avatar = data.get('avatar', '').strip()

    if not name or not email:
        return jsonify({"success": False, "message": "Name and email cannot be empty"}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users LIMIT 1').fetchone()
    if user:
        target_id = user['id']
        current_username = user['username'] if 'username' in user.keys() else '@' + user['name'].lower().replace(' ', '')
        conn.execute('''
        UPDATE users
        SET name = ?, username = ?, email = ?, role = ?, avatar = COALESCE(NULLIF(?, ''), avatar)
        WHERE id = ?
        ''', (name, username or current_username, email, role or user['role'], avatar, target_id))
        conn.commit()
        updated = conn.execute('SELECT id, name, username, email, avatar, role FROM users WHERE id = ?', (target_id,)).fetchone()
        conn.close()
        return jsonify({"success": True, "user": dict(updated)})
    else:
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO users (name, username, email, password, avatar, role)
        VALUES (?, ?, ?, 'password123', ?, ?)
        ''', (name, username or '@' + name.lower().replace(' ', ''), email, avatar or 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', role or 'Social Media Manager'))
        conn.commit()
        new_id = cursor.lastrowid
        updated = conn.execute('SELECT id, name, username, email, avatar, role FROM users WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify({"success": True, "user": dict(updated)})

# --- SOCIAL ACCOUNTS ENDPOINTS ---
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    conn = get_db_connection()
    accounts = conn.execute('SELECT * FROM social_accounts').fetchall()
    conn.close()
    return jsonify([dict(acc) for acc in accounts])

@app.route('/api/accounts/<int:acc_id>/toggle', methods=['POST'])
def toggle_account_connection(acc_id):
    conn = get_db_connection()
    account = conn.execute('SELECT * FROM social_accounts WHERE id = ?', (acc_id,)).fetchone()
    if not account:
        conn.close()
        return jsonify({"error": "Account not found"}), 404

    new_status = 0 if account['connected'] else 1
    conn.execute('UPDATE social_accounts SET connected = ?, last_synced = CURRENT_TIMESTAMP WHERE id = ?', (new_status, acc_id))
    conn.commit()
    updated = conn.execute('SELECT * FROM social_accounts WHERE id = ?', (acc_id,)).fetchone()
    conn.close()
    return jsonify(dict(updated))

# --- POSTS CRUD & SCHEDULING ---
@app.route('/api/posts', methods=['GET'])
def get_posts():
    status = request.args.get('status')
    conn = get_db_connection()
    query = 'SELECT * FROM posts'
    params = []
    if status and status != 'all':
        query += ' WHERE status = ?'
        params.append(status)
    query += ' ORDER BY created_at DESC'

    posts = conn.execute(query, params).fetchall()
    conn.close()

    result = []
    for p in posts:
        item = dict(p)
        try:
            item['platforms'] = json.loads(item['platforms'])
        except Exception:
            item['platforms'] = [item['platforms']] if item['platforms'] else []
        result.append(item)

    return jsonify(result)

@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.get_json() or {}
    content = data.get('content', '').strip()
    platforms = data.get('platforms', [])
    media_url = data.get('media_url')
    status = data.get('status', 'draft') # 'draft', 'scheduled', 'published'
    scheduled_for = data.get('scheduled_for')

    if not content:
        return jsonify({"error": "Post content is required"}), 400

    if status not in ['draft', 'scheduled', 'published']:
        status = 'draft'

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO posts (content, platforms, media_url, status, scheduled_for, likes, comments, shares, reach)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)
    ''', (content, json.dumps(platforms), media_url, status, scheduled_for))
    conn.commit()
    post_id = cursor.lastrowid

    # Add activity entry
    activity_title = "Post Published" if status == 'published' else ("Post Scheduled" if status == 'scheduled' else "Draft Saved")
    activity_desc = f"New {status} post created for {', '.join(platforms) if platforms else 'all channels'}."
    cursor.execute('''
    INSERT INTO activity (type, title, description, platform)
    VALUES (?, ?, ?, ?)
    ''', ('post', activity_title, activity_desc, platforms[0] if platforms else 'Multi-channel'))
    conn.commit()

    new_post = conn.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    conn.close()

    item = dict(new_post)
    item['platforms'] = json.loads(item['platforms'])
    return jsonify(item), 201

@app.route('/api/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    data = request.get_json() or {}
    conn = get_db_connection()
    existing = conn.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Post not found"}), 404

    content = data.get('content', existing['content'])
    platforms = json.dumps(data.get('platforms', json.loads(existing['platforms'])))
    media_url = data.get('media_url', existing['media_url'])
    status = data.get('status', existing['status'])
    scheduled_for = data.get('scheduled_for', existing['scheduled_for'])

    conn.execute('''
    UPDATE posts
    SET content = ?, platforms = ?, media_url = ?, status = ?, scheduled_for = ?
    WHERE id = ?
    ''', (content, platforms, media_url, status, scheduled_for, post_id))
    conn.commit()
    updated = conn.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    conn.close()

    item = dict(updated)
    item['platforms'] = json.loads(item['platforms'])
    return jsonify(item)

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM posts WHERE id = ?', (post_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()

    if deleted:
        return jsonify({"success": True, "message": "Post deleted successfully"})
    return jsonify({"error": "Post not found"}), 404

# --- CAMPAIGNS ENDPOINTS ---
@app.route('/api/campaigns', methods=['GET'])
def get_campaigns():
    conn = get_db_connection()
    campaigns = conn.execute('SELECT * FROM campaigns ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(c) for c in campaigns])

@app.route('/api/campaigns', methods=['POST'])
def create_campaign():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '')
    budget = data.get('budget', '$1,000')
    target_reach = data.get('target_reach', 50000)
    start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
    end_date = data.get('end_date')

    if not title:
        return jsonify({"error": "Campaign title is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO campaigns (title, description, status, progress, target_reach, current_reach, budget, start_date, end_date)
    VALUES (?, ?, 'active', 0, ?, 0, ?, ?, ?)
    ''', (title, description, target_reach, budget, start_date, end_date))
    conn.commit()
    camp_id = cursor.lastrowid
    new_camp = conn.execute('SELECT * FROM campaigns WHERE id = ?', (camp_id,)).fetchone()
    conn.close()
    return jsonify(dict(new_camp)), 201

# --- ANALYTICS ENDPOINTS ---
@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    conn = get_db_connection()
    accounts = conn.execute('SELECT * FROM social_accounts').fetchall()
    total_followers = sum(a['followers'] for a in accounts)
    total_following = sum(a['following'] for a in accounts)

    posts_stats = conn.execute('''
    SELECT 
        COUNT(*) as total_posts,
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(shares) as total_shares,
        SUM(reach) as total_reach
    FROM posts
    ''').fetchone()
    conn.close()

    # Time series simulation for clean dashboard charts
    growth_history = [
        {"day": "Mon", "followers": 482000, "impressions": 125000, "engagement": 4.8},
        {"day": "Tue", "followers": 486500, "impressions": 142000, "engagement": 5.2},
        {"day": "Wed", "followers": 492000, "impressions": 158000, "engagement": 5.6},
        {"day": "Thu", "followers": 498400, "impressions": 169000, "engagement": 6.1},
        {"day": "Fri", "followers": 504200, "impressions": 185000, "engagement": 6.4},
        {"day": "Sat", "followers": 509800, "impressions": 198000, "engagement": 6.8},
        {"day": "Sun", "followers": 514500, "impressions": 215000, "engagement": 7.3}
    ]

    platform_distribution = [
        {"platform": "Instagram", "percentage": 28, "color": "#E1306C"},
        {"platform": "TikTok", "percentage": 42, "color": "#000000"},
        {"platform": "Facebook", "percentage": 17, "color": "#1877F2"},
        {"platform": "YouTube", "percentage": 10, "color": "#FF0000"},
        {"platform": "LinkedIn", "percentage": 7, "color": "#0A66C2"},
        {"platform": "X", "percentage": 13, "color": "#1DA1F2"}
    ]

    return jsonify({
        "summary": {
            "total_followers": total_followers or 514500,
            "total_following": total_following or 1865,
            "weekly_growth": "+14.8%",
            "total_posts": posts_stats['total_posts'] or 48,
            "total_likes": posts_stats['total_likes'] or 24600,
            "total_reach": posts_stats['total_reach'] or 854000,
            "engagement_rate": "6.4%"
        },
        "history": growth_history,
        "platforms": platform_distribution
    })

# --- RECENT ACTIVITY ---
@app.route('/api/activity', methods=['GET'])
def get_activity():
    conn = get_db_connection()
    activities = conn.execute('SELECT * FROM activity ORDER BY id DESC LIMIT 10').fetchall()
    conn.close()
    return jsonify([dict(a) for a in activities])

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"SocialSync Flask Backend starting on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
