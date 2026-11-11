// SocialSync API Service with session cache cleanup, URL safety helpers, & full token handling
const RAW_API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:5000/api');

export const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

const TRUSTED_OAUTH_HOSTS = new Set([
  'www.facebook.com',
  'facebook.com',
  'api.instagram.com',
  'accounts.google.com',
]);

export function isSafeHttpUrl(value, allowRelativeUpload = false) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (allowRelativeUpload && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('//')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isTrustedOAuthUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && TRUSTED_OAUTH_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function clearSessionStorageCaches() {
  if (typeof window === 'undefined') return;
  [
    'socialsync_token',
    'socialsync_user',
    'socialsync_accounts',
    'socialsync_posts',
    'socialsync_campaigns',
    'socialsync_activity',
    'socialsync_initialized',
  ].forEach((key) => localStorage.removeItem(key));
}

export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Universal request helper with token header.
// Backend HTTP error responses (4xx/5xx) throw ApiError rather than falling back to fake offline data.
async function request(endpoint, options = {}, allowOfflineFallback = true) {
  let res;
  try {
    const token = localStorage.getItem('socialsync_token');
    const usableToken = token && token !== 'local_offline_token' ? token : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(usableToken ? { 'Authorization': `Bearer ${usableToken}` } : {}),
      ...(options.headers || {})
    };

    // If uploading FormData, delete Content-Type to let browser set boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch (networkErr) {
    if (allowOfflineFallback) {
      console.warn(`Backend unreachable (${endpoint}). Using offline fallback.`, networkErr.message);
      return null;
    }
    throw new ApiError(`Cannot reach SocialSync backend server (${API_BASE}).`, 0, null);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (
    res.status === 401 &&
    endpoint !== '/auth/login' &&
    endpoint !== '/auth/register' &&
    endpoint !== '/auth/logout'
  ) {
    clearSessionStorageCaches();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socialsync-auth-expired'));
    }
  }

  if (!res.ok) {
    const errMsg =
      payload?.error ||
      payload?.message ||
      `HTTP Error ${res.status}`;
    throw new ApiError(errMsg, res.status, payload);
  }

  return payload;
}

export const api = {
  // --- AUTH ---
  async login(email, password) {
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }, false);
      if (data && data.success && data.token) {
        localStorage.setItem('socialsync_token', data.token);
        localStorage.setItem('socialsync_user', JSON.stringify(data.user));
        return data;
      }
      return { success: false, message: data?.message || 'Authentication failed.' };
    } catch (err) {
      if (err instanceof ApiError && err.status > 0) {
        return { success: false, message: err.message };
      }
      throw err;
    }
  },

  async register(name, email, password) {
    try {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      }, false);
      if (data && data.success && data.token) {
        localStorage.setItem('socialsync_token', data.token);
        localStorage.setItem('socialsync_user', JSON.stringify(data.user));
        return data;
      }
      return { success: false, message: data?.message || 'Registration failed.' };
    } catch (err) {
      if (err instanceof ApiError && err.status > 0) {
        return { success: false, message: err.message };
      }
      throw err;
    }
  },

  async getMe() {
    const token = localStorage.getItem('socialsync_token');
    if (!token || token === 'local_offline_token') {
      return null;
    }
    const data = await request('/auth/me', {}, false);
    if (data && !data.error) {
      localStorage.setItem('socialsync_user', JSON.stringify(data));
      return data;
    }
    return null;
  },

  async updateProfile(userData) {
    const data = await request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData)
    }, false);
    if (data && data.success && data.user) {
      localStorage.setItem('socialsync_user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    }
    return data || { success: false, message: 'Failed to update profile.' };
  },

  async logout() {
    try {
      const token = localStorage.getItem('socialsync_token');
      if (token && token !== 'local_offline_token') {
        await request('/auth/logout', { method: 'POST' }, true);
      }
    } catch {
      // Best-effort revocation; local session caches are always cleared.
    } finally {
      clearSessionStorageCaches();
    }
  },

  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) {
      throw new ApiError(`Health check failed (HTTP ${res.status})`, res.status, null);
    }
    return await res.json();
  },

  // --- NOTIFICATION SETTINGS ---
  async getNotificationSettings() {
    return await request('/settings/notifications', {}, false);
  },

  async updateNotificationSettings(settings) {
    return await request('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }, false);
  },

  // --- OAUTH 2.0 INTEGRATIONS ---
  async getOAuthStatus() {
    return await request('/oauth/config-status', {}, false);
  },

  async startOAuth(provider, method = null) {
    const params = new URLSearchParams();
    if (method) params.set('method', method);
    if (typeof window !== 'undefined' && window.location?.origin) {
      params.set('origin', window.location.origin);
    }
    const qs = params.toString();
    const query = qs ? `?${qs}` : '';
    return await request(`/oauth/${provider.toLowerCase()}/start${query}`, {}, false);
  },

  async getMetaPages() {
    return await request('/oauth/meta/pages', {}, false);
  },

  async selectMetaPage(pageId) {
    return await request('/oauth/meta/select-page', {
      method: 'POST',
      body: JSON.stringify({ page_id: pageId })
    }, false);
  },

  async disconnectOAuth(platform) {
    return await request(`/oauth/${platform.toLowerCase()}/disconnect`, {
      method: 'POST'
    }, false);
  },

  // --- ACCOUNTS ---
  async getAccounts() {
    const data = await request('/accounts');
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_accounts', JSON.stringify(data));
      return data;
    }
    return JSON.parse(localStorage.getItem('socialsync_accounts') || '[]');
  },

  async toggleAccount(id) {
    const data = await request(`/accounts/${id}/toggle`, { method: 'POST' });
    if (data && data.id) {
      const accounts = JSON.parse(localStorage.getItem('socialsync_accounts') || '[]');
      const updated = accounts.map(a => a.id === id ? data : a);
      localStorage.setItem('socialsync_accounts', JSON.stringify(updated));
      return data;
    }
    // Fallback
    const accounts = JSON.parse(localStorage.getItem('socialsync_accounts') || '[]');
    const updated = accounts.map(a => a.id === id ? { ...a, connected: a.connected ? 0 : 1 } : a);
    localStorage.setItem('socialsync_accounts', JSON.stringify(updated));
    return updated.find(a => a.id === id);
  },

  async syncAccount(id) {
    return await request(`/accounts/${id}/sync`, { method: 'POST' }, false);
  },

  async syncAllAccounts() {
    const data = await request('/accounts/sync-all', { method: 'POST' }, false);
    if (data && data.accounts) {
      localStorage.setItem('socialsync_accounts', JSON.stringify(data.accounts));
      return data;
    }
    throw new ApiError('Sync failed: unexpected response from backend.', 500, data);
  },

  // --- MEDIA UPLOAD ---
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);
    const data = await request('/upload', {
      method: 'POST',
      body: formData
    }, false);
    return data;
  },

  // --- POSTS ---
  async getPosts(status = 'all', search = '', campaignId = '') {
    let query = '?';
    if (status && status !== 'all') query += `status=${status}&`;
    if (search) query += `search=${encodeURIComponent(search)}&`;
    if (campaignId) query += `campaign_id=${campaignId}&`;
    query = query.replace(/[?&]$/, '');

    const data = await request(`/posts${query}`);
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_posts', JSON.stringify(data));
      return data;
    }
    let posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
    if (status && status !== 'all') {
      posts = posts.filter(p => p.status === status);
    }
    if (campaignId) {
      posts = posts.filter(p => String(p.campaign_id) === String(campaignId));
    }
    if (search) {
      const s = search.toLowerCase();
      posts = posts.filter(p => p.content.toLowerCase().includes(s));
    }
    return posts;
  },

  async createPost(postData) {
    const isLive = postData?.publish_mode === 'live';
    const data = await request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    }, !isLive);
    if (data && data.id) {
      const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
      localStorage.setItem('socialsync_posts', JSON.stringify([data, ...posts]));
      return data;
    }
    // Offline fallback ONLY for non-live (Sandbox/Draft) mode when backend is unreachable
    const newPost = {
      id: Date.now(),
      campaign_id: postData.campaign_id || null,
      content: postData.content,
      platforms: postData.platforms || ['Instagram'],
      media_url: postData.media_url || null,
      media_type: postData.media_type || (postData.media_url ? 'image' : 'text'),
      publish_mode: 'sandbox',
      status: postData.status || 'draft',
      scheduled_for: postData.scheduled_for || null,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      likes: postData.status === 'published' ? Math.floor(Math.random() * 120 + 20) : 0,
      comments: postData.status === 'published' ? Math.floor(Math.random() * 25 + 5) : 0,
      shares: postData.status === 'published' ? Math.floor(Math.random() * 15 + 2) : 0,
      reach: postData.status === 'published' ? Math.floor(Math.random() * 2400 + 800) : 0
    };
    const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
    const updated = [newPost, ...posts];
    localStorage.setItem('socialsync_posts', JSON.stringify(updated));
    return newPost;
  },

  async updatePost(id, postData) {
    const isLive = postData?.publish_mode === 'live';
    const data = await request(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(postData)
    }, !isLive);
    if (data && data.id) {
      const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
      const updated = posts.map(p => p.id === id ? data : p);
      localStorage.setItem('socialsync_posts', JSON.stringify(updated));
      return data;
    }
    // Offline fallback only when backend is unreachable in non-live mode
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
    return JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');
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

  async updateCampaign(id, campData) {
    const data = await request(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(campData)
    });
    if (data && data.id) {
      const camps = JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');
      const updated = camps.map(c => c.id === id ? data : c);
      localStorage.setItem('socialsync_campaigns', JSON.stringify(updated));
      return data;
    }
    // Fallback
    const camps = JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');
    const updated = camps.map(c => c.id === id ? { ...c, ...campData } : c);
    localStorage.setItem('socialsync_campaigns', JSON.stringify(updated));
    return updated.find(c => c.id === id);
  },

  async deleteCampaign(id) {
    const data = await request(`/campaigns/${id}`, { method: 'DELETE' });
    const camps = JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');
    const updated = camps.filter(c => c.id !== id);
    localStorage.setItem('socialsync_campaigns', JSON.stringify(updated));
    return data || { success: true };
  },

  // --- ANALYTICS ---
  async getAnalytics(range = '7d') {
    const data = await request(`/analytics?range=${range}`);
    if (data && data.summary) return data;

    return {
      summary: {
        total_followers: 0,
        total_following: 0,
        weekly_growth: '0%',
        total_posts: 0,
        total_likes: 0,
        total_reach: 0,
        total_interactions: 0,
        engagement_rate: '0%',
        range
      },
      history: [],
      platforms: []
    };
  },

  // --- GLOBAL SEARCH ---
  async search(query) {
    if (!query) return { posts: [], accounts: [], campaigns: [] };
    const data = await request(`/search?q=${encodeURIComponent(query)}`);
    if (data && data.posts) return data;

    // Fallback search
    const q = query.toLowerCase();
    const posts = JSON.parse(localStorage.getItem('socialsync_posts') || '[]');
    const accounts = JSON.parse(localStorage.getItem('socialsync_accounts') || '[]');
    const campaigns = JSON.parse(localStorage.getItem('socialsync_campaigns') || '[]');

    return {
      posts: posts.filter(p => p.content.toLowerCase().includes(q)).slice(0, 6),
      accounts: accounts.filter(a => a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q) || a.platform.toLowerCase().includes(q)).slice(0, 6),
      campaigns: campaigns.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)).slice(0, 6)
    };
  },

  // --- ACTIVITY ---
  async getActivity() {
    const data = await request('/activity');
    if (data && Array.isArray(data)) {
      localStorage.setItem('socialsync_activity', JSON.stringify(data));
      return data;
    }
    return JSON.parse(localStorage.getItem('socialsync_activity') || '[]');
  }
};
