// SocialSync API Service with transparent localStorage fallback
const API_BASE = 'http://127.0.0.1:5000/api';

// Initial fallback mock data stored in localStorage if backend is offline
const INITIAL_STORAGE = {
  user: {
    id: 1,
    name: 'Alex Morgan',
    email: 'alex@socialsync.io',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Lead Brand Strategist'
  },
  accounts: [
    { id: 1, platform: 'Instagram', name: 'SocialSync Official', handle: '@socialsync_app', avatar: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=120&auto=format&fit=crop&q=80', followers: 142500, following: 480, growth: '+12.4%', connected: 1 },
    { id: 2, platform: 'Facebook', name: 'SocialSync Page', handle: '@socialsynchq', avatar: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop&q=80', followers: 88400, following: 120, growth: '+5.8%', connected: 1 },
    { id: 3, platform: 'X', name: 'SocialSync Tech', handle: '@socialsync_live', avatar: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=120&auto=format&fit=crop&q=80', followers: 65200, following: 890, growth: '+18.2%', connected: 1 },
    { id: 4, platform: 'LinkedIn', name: 'SocialSync Inc.', handle: 'company/socialsync', avatar: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=120&auto=format&fit=crop&q=80', followers: 34100, following: 50, growth: '+8.7%', connected: 1 },
    { id: 5, platform: 'YouTube', name: 'SocialSync Studio', handle: '@SocialSyncStudio', avatar: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=120&auto=format&fit=crop&q=80', followers: 52900, following: 15, growth: '+14.1%', connected: 1 },
    { id: 6, platform: 'TikTok', name: 'SocialSync Viral', handle: '@socialsync_now', avatar: 'https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?w=120&auto=format&fit=crop&q=80', followers: 215400, following: 310, growth: '+24.6%', connected: 1 }
  ],
  posts: [
    {
      id: 1,
      content: '🚀 Unveiling our next-gen social intelligence suite! Schedule, analyze, and automate cross-platform growth seamlessly. #SocialMediaMarketing #AI #ProductLaunch',
      platforms: ['Instagram', 'LinkedIn', 'X'],
      media_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
      status: 'published',
      scheduled_for: '2026-10-13 14:30:00',
      created_at: '2026-10-13 10:00:00',
      likes: 1420,
      comments: 184,
      shares: 96,
      reach: 28400
    },
    {
      id: 2,
      content: '✨ 5 Proven Tips to Boost Instagram Engagement in 2026: 1. Authentic Reels 2. Interactive Polls 3. Consistent Timing 4. Direct DMs 5. Micro-influencer collabs! Save this for later 📌',
      platforms: ['Instagram', 'TikTok'],
      media_url: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80',
      status: 'published',
      scheduled_for: '2026-10-14 09:15:00',
      created_at: '2026-10-14 08:00:00',
      likes: 3890,
      comments: 420,
      shares: 312,
      reach: 64200
    },
    {
      id: 3,
      content: '🎙️ Live Q&A this Thursday at 3 PM EST: How Top Brands 10x Their Social Reach with Unified Scheduling. RSVP link in bio!',
      platforms: ['LinkedIn', 'X', 'Facebook'],
      media_url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80',
      status: 'scheduled',
      scheduled_for: '2026-10-16 15:00:00',
      created_at: '2026-10-14 11:20:00',
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0
    },
    {
      id: 4,
      content: 'Behind the scenes at SocialSync HQ! Building the features you asked for. What tool would you love to see next? Drop a comment! 👇',
      platforms: ['Instagram', 'YouTube'],
      media_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80',
      status: 'scheduled',
      scheduled_for: '2026-10-17 12:00:00',
      created_at: '2026-10-14 12:00:00',
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0
    },
    {
      id: 5,
      content: 'Drafting our Q4 Creator Growth Playbook: key benchmarks across TikTok vs YouTube Shorts. Looking for beta readers!',
      platforms: ['X', 'LinkedIn'],
      media_url: null,
      status: 'draft',
      scheduled_for: null,
      created_at: '2026-10-14 14:00:00',
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0
    }
  ],
  campaigns: [
    { id: 1, title: 'Q4 Product Launch Blitz', description: 'Cross-platform blitz to introduce SocialSync 2.0 to enterprise creators.', status: 'active', progress: 72, target_reach: 100000, current_reach: 72400, budget: '$3,200', start_date: '2026-10-01', end_date: '2026-11-15' },
    { id: 2, title: 'Holiday Creator Giveaway', description: 'Instagram & TikTok interactive campaign driving app downloads.', status: 'active', progress: 45, target_reach: 80000, current_reach: 36000, budget: '$2,000', start_date: '2026-10-10', end_date: '2026-11-30' },
    { id: 3, title: 'Thought Leadership Series', description: 'Weekly CEO interview highlights distributed across LinkedIn and X.', status: 'planning', progress: 20, target_reach: 45000, current_reach: 9000, budget: '$1,100', start_date: '2026-10-20', end_date: '2026-12-15' }
  ],
  activity: [
    { id: 1, type: 'follower', title: 'New Milestone Reached', description: 'Instagram passed 140K followers with +12.4% weekly surge.', platform: 'Instagram', created_at: '10m ago' },
    { id: 2, type: 'post', title: 'Post Published Automatically', description: "'5 Proven Tips to Boost Instagram Engagement' published to 2 platforms.", platform: 'Instagram', created_at: '45m ago' },
    { id: 3, type: 'like', title: 'Surge in Engagements', description: 'LinkedIn campaign reached 2,400+ reactions in under 4 hours.', platform: 'LinkedIn', created_at: '2h ago' },
    { id: 4, type: 'schedule', title: 'Post Scheduled', description: 'Live Q&A teaser scheduled for Thursday at 3:00 PM.', platform: 'X', created_at: '3h ago' },
    { id: 5, type: 'account', title: 'Account Re-synced', description: 'YouTube Studio analytics synchronized with zero errors.', platform: 'YouTube', created_at: '5h ago' }
  ]
};

// Initialize localStorage fallback if missing
function initLocalStorage() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem('socialsync_initialized')) {
    localStorage.setItem('socialsync_user', JSON.stringify(INITIAL_STORAGE.user));
    localStorage.setItem('socialsync_accounts', JSON.stringify(INITIAL_STORAGE.accounts));
    localStorage.setItem('socialsync_posts', JSON.stringify(INITIAL_STORAGE.posts));
    localStorage.setItem('socialsync_campaigns', JSON.stringify(INITIAL_STORAGE.campaigns));
    localStorage.setItem('socialsync_activity', JSON.stringify(INITIAL_STORAGE.activity));
    localStorage.setItem('socialsync_initialized', 'true');
  }
}
initLocalStorage();

// Universal request helper
async function request(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Backend connection failed (${endpoint}). Using offline fallback.`, err.message);
    return null; // Signals to use fallback
  }
}

export const api = {
  // --- AUTH ---
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data && data.success) {
      localStorage.setItem('socialsync_user', JSON.stringify(data.user));
      return data;
    }
    // Fallback: Check local storage or match default
    const stored = JSON.parse(localStorage.getItem('socialsync_user') || 'null');
    if (stored && (email === stored.email || email === 'alex@socialsync.io')) {
      return { success: true, user: stored, token: 'local_token' };
    }
    // Allow demo entry
    const demoUser = {
      id: 1,
      name: email.split('@')[0] || 'SocialSync User',
      email,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'Brand Manager'
    };
    localStorage.setItem('socialsync_user', JSON.stringify(demoUser));
    return { success: true, user: demoUser, token: 'local_token' };
  },

  async register(name, email, password) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (data && data.success) {
      localStorage.setItem('socialsync_user', JSON.stringify(data.user));
      return data;
    }
    // Fallback
    const newUser = {
      id: Date.now(),
      name,
      email,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role: 'Social Media Manager'
    };
    localStorage.setItem('socialsync_user', JSON.stringify(newUser));
    return { success: true, user: newUser, token: 'local_token' };
  },

  async getMe() {
    const data = await request('/auth/me');
    if (data && !data.error) {
      localStorage.setItem('socialsync_user', JSON.stringify(data));
      return data;
    }
    return JSON.parse(localStorage.getItem('socialsync_user') || JSON.stringify(INITIAL_STORAGE.user));
  },

  async updateProfile(userData) {
    const data = await request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
    if (data && data.success && data.user) {
      localStorage.setItem('socialsync_user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    }
    // Local fallback if offline
    const currentUser = JSON.parse(localStorage.getItem('socialsync_user') || JSON.stringify(INITIAL_STORAGE.user));
    const updated = {
      ...currentUser,
      ...userData,
      name: userData.name || currentUser.name,
      username: userData.username || currentUser.username || '@' + (userData.name || currentUser.name).toLowerCase().replace(' ', ''),
      email: userData.email || currentUser.email,
      role: userData.role || currentUser.role,
      avatar: userData.avatar || currentUser.avatar
    };
    localStorage.setItem('socialsync_user', JSON.stringify(updated));
    return { success: true, user: updated };
  },

  // --- ACCOUNTS ---
  async getAccounts() {
    const data = await request('/accounts');
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_accounts', JSON.stringify(data));
      return data;
    }
    return JSON.parse(localStorage.getItem('socialsync_accounts') || JSON.stringify(INITIAL_STORAGE.accounts));
  },

  async toggleAccount(id) {
    const data = await request(`/accounts/${id}/toggle`, { method: 'POST' });
    if (data && data.id) return data;
    // Fallback
    const accounts = JSON.parse(localStorage.getItem('socialsync_accounts') || '[]');
    const updated = accounts.map(a => a.id === id ? { ...a, connected: a.connected ? 0 : 1 } : a);
    localStorage.setItem('socialsync_accounts', JSON.stringify(updated));
    return updated.find(a => a.id === id);
  },

  // --- POSTS ---
  async getPosts(status = 'all') {
    const query = status && status !== 'all' ? `?status=${status}` : '';
    const data = await request(`/posts${query}`);
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_posts', JSON.stringify(data));
      return data;
    }
    const posts = JSON.parse(localStorage.getItem('socialsync_posts') || JSON.stringify(INITIAL_STORAGE.posts));
    if (status && status !== 'all') {
      return posts.filter(p => p.status === status);
    }
    return posts;
  },

  async createPost(postData) {
    const data = await request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
    if (data && data.id) {
      // update local
      const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
      localStorage.setItem('socialsync_posts', JSON.stringify([data, ...posts]));
      return data;
    }
    // Fallback
    const newPost = {
      id: Date.now(),
      content: postData.content,
      platforms: postData.platforms || ['Instagram'],
      media_url: postData.media_url || null,
      status: postData.status || 'draft',
      scheduled_for: postData.scheduled_for || null,
      created_at: new Date().toISOString(),
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0
    };
    const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
    const updated = [newPost, ...posts];
    localStorage.setItem('socialsync_posts', JSON.stringify(updated));
    return newPost;
  },

  async updatePost(id, postData) {
    const data = await request(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(postData)
    });
    if (data && data.id) {
      const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
      const updated = posts.map(p => p.id === id ? data : p);
      localStorage.setItem('socialsync_posts', JSON.stringify(updated));
      return data;
    }
    // Fallback
    const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
    const updated = posts.map(p => p.id === id ? { ...p, ...postData } : p);
    localStorage.setItem('socialsync_posts', JSON.stringify(updated));
    return updated.find(p => p.id === id);
  },

  async deletePost(id) {
    const data = await request(`/posts/${id}`, { method: 'DELETE' });
    const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
    const updated = posts.filter(p => p.id !== id);
    localStorage.setItem('socialsync_posts', JSON.stringify(updated));
    return data || { success: true };
  },

  // --- CAMPAIGNS ---
  async getCampaigns() {
    const data = await request('/campaigns');
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_campaigns', JSON.stringify(data));
      return data;
    }
    return JSON.parse(localStorage.getItem('socialsync_campaigns') || JSON.stringify(INITIAL_STORAGE.campaigns));
  },

  async createCampaign(campData) {
    const data = await request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campData)
    });
    if (data && data.id) {
      const camps = JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');
      localStorage.setItem('socialsync_campaigns', JSON.stringify([data, ...camps]));
      return data;
    }
    const newCamp = {
      id: Date.now(),
      title: campData.title,
      description: campData.description,
      status: 'active',
      progress: 0,
      target_reach: campData.target_reach || 50000,
      current_reach: 0,
      budget: campData.budget || '$1,000',
      start_date: campData.start_date || new Date().toISOString().split('T')[0],
      end_date: campData.end_date || null
    };
    const camps = JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');
    localStorage.setItem('socialsync_campaigns', JSON.stringify([newCamp, ...camps]));
    return newCamp;
  },

  // --- ANALYTICS ---
  async getAnalytics() {
    const data = await request('/analytics');
    if (data && data.summary) return data;
    return {
      summary: {
        total_followers: 514500,
        total_following: 1865,
        weekly_growth: '+14.8%',
        total_posts: 48,
        total_likes: 24600,
        total_reach: 854000,
        engagement_rate: '6.4%'
      },
      history: [
        { day: 'Mon', followers: 482000, impressions: 125000, engagement: 4.8 },
        { day: 'Tue', followers: 486500, impressions: 142000, engagement: 5.2 },
        { day: 'Wed', followers: 492000, impressions: 158000, engagement: 5.6 },
        { day: 'Thu', followers: 498400, impressions: 169000, engagement: 6.1 },
        { day: 'Fri', followers: 504200, impressions: 185000, engagement: 6.4 },
        { day: 'Sat', followers: 509800, impressions: 198000, engagement: 6.8 },
        { day: 'Sun', followers: 514500, impressions: 215000, engagement: 7.3 }
      ],
      platforms: [
        { platform: 'Instagram', percentage: 28, color: '#E1306C' },
        { platform: 'TikTok', percentage: 42, color: '#000000' },
        { platform: 'Facebook', percentage: 17, color: '#1877F2' },
        { platform: 'YouTube', percentage: 10, color: '#FF0000' },
        { platform: 'LinkedIn', percentage: 7, color: '#0A66C2' },
        { platform: 'X', percentage: 13, color: '#1DA1F2' }
      ]
    };
  },

  // --- ACTIVITY ---
  async getActivity() {
    const data = await request('/activity');
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_activity', JSON.stringify(data));
      return data;
    }
    return JSON.parse(localStorage.getItem('socialsync_activity') || JSON.stringify(INITIAL_STORAGE.activity));
  }
};
