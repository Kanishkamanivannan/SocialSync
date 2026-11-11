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

export const APP_MODE_KEY = 'socialsync_app_mode';

export function getAppMode() {
  if (typeof window === 'undefined') return 'demo';
  const saved = localStorage.getItem(APP_MODE_KEY);
  return saved === 'live' ? 'live' : 'demo';
}

export function setAppMode(mode) {
  const normalized = mode === 'live' ? 'live' : 'demo';
  if (typeof window !== 'undefined') {
    localStorage.setItem(APP_MODE_KEY, normalized);
  }
  return normalized;
}

function cacheKey(resource, mode = getAppMode()) {
  const normalized = mode === 'live' ? 'live' : 'demo';
  return `socialsync_${normalized}_${resource}`;
}

function readCache(resource, mode = getAppMode(), fallback = []) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(cacheKey(resource, mode));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeCache(resource, value, mode = getAppMode()) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(cacheKey(resource, mode), JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
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
    'socialsync_demo_accounts',
    'socialsync_demo_posts',
    'socialsync_demo_campaigns',
    'socialsync_demo_activity',
    'socialsync_live_accounts',
    'socialsync_live_posts',
    'socialsync_live_campaigns',
    'socialsync_live_activity',
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
        setAppMode(data.user?.app_mode || 'demo');
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
        setAppMode(data.user?.app_mode || 'demo');
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

  // --- OPERATING MODE SETTINGS ---
  async getAppModeSetting() {
    return await request('/settings/mode', {}, false);
  },

  async updateAppModeSetting(appMode) {
    return await request('/settings/mode', {
      method: 'PUT',
      body: JSON.stringify({ app_mode: appMode === 'live' ? 'live' : 'demo' })
    }, false);
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
  async getAccounts(mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/accounts?workspace_mode=${encodeURIComponent(activeMode)}`,
      {},
      activeMode === 'demo'
    );
    if (data && Array.isArray(data)) {
      writeCache('accounts', data, activeMode);
      return data;
    }
    return readCache('accounts', activeMode, []);
  },

  async toggleAccount(id, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/accounts/${id}/toggle?workspace_mode=${encodeURIComponent(activeMode)}`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace_mode: activeMode })
      },
      activeMode === 'demo'
    );
    if (data && data.id) {
      const accounts = readCache('accounts', activeMode, []);
      const updated = accounts.map(a => a.id === id ? data : a);
      writeCache('accounts', updated, activeMode);
      return data;
    }
    // Offline fallback ONLY in demo mode
    const accounts = readCache('accounts', activeMode, []);
    const updated = accounts.map(a => a.id === id ? { ...a, connected: a.connected ? 0 : 1 } : a);
    writeCache('accounts', updated, activeMode);
    return updated.find(a => a.id === id);
  },

  async syncAccount(id, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    return await request(
      `/accounts/${id}/sync?workspace_mode=${encodeURIComponent(activeMode)}`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace_mode: activeMode })
      },
      false
    );
  },

  async syncAllAccounts(mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/accounts/sync-all?workspace_mode=${encodeURIComponent(activeMode)}`,
      {
        method: 'POST',
        body: JSON.stringify({ workspace_mode: activeMode })
      },
      false
    );
    if (data && data.accounts) {
      writeCache('accounts', data.accounts, activeMode);
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
  async getPosts(status = 'all', search = '', campaignId = '', mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const params = new URLSearchParams();
    params.set('workspace_mode', activeMode);
    if (status && status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    if (campaignId) params.set('campaign_id', campaignId);

    const data = await request(`/posts?${params.toString()}`, {}, activeMode === 'demo');
    if (data && Array.isArray(data)) {
      if (status === 'all' && !search && !campaignId) {
        writeCache('posts', data, activeMode);
      }
      return data;
    }
    let posts = readCache('posts', activeMode, []);
    if (status && status !== 'all') {
      posts = posts.filter(p => p.status === status);
    }
    if (campaignId) {
      posts = posts.filter(p => String(p.campaign_id) === String(campaignId));
    }
    if (search) {
      const s = search.toLowerCase();
      posts = posts.filter(p => (p.content || '').toLowerCase().includes(s));
    }
    return posts;
  },

  async createPost(postData, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const allowFallback = activeMode === 'demo' && postData?.publish_mode !== 'live';
    const payload = {
      ...postData,
      workspace_mode: activeMode,
      publish_mode: activeMode === 'demo' ? 'demo' : (postData?.publish_mode || 'sandbox')
    };
    const data = await request('/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, allowFallback);
    if (data && data.id) {
      const posts = readCache('posts', activeMode, []);
      writeCache('posts', [data, ...posts], activeMode);
      return data;
    }
    // Offline fallback ONLY for Demo Mode when backend is temporarily unreachable
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const platformsList = postData.platforms || ['Instagram'];
    const isPublished = postData.status === 'published';
    const newPost = {
      id: Date.now(),
      campaign_id: postData.campaign_id || null,
      content: postData.content,
      platforms: platformsList,
      media_url: postData.media_url || null,
      media_type: postData.media_type || (postData.media_url ? 'image' : 'text'),
      workspace_mode: 'demo',
      publish_mode: 'demo',
      status: postData.status || 'draft',
      scheduled_for: postData.scheduled_for || null,
      created_at: nowStr,
      published_at: isPublished ? nowStr : null,
      publish_results: isPublished
        ? platformsList.map(pl => ({ platform: pl, success: true, simulated: true, mode: 'demo', label: 'Demo Published' }))
        : [],
      likes: isPublished ? Math.floor(Math.random() * 120 + 20) : 0,
      comments: isPublished ? Math.floor(Math.random() * 25 + 5) : 0,
      shares: isPublished ? Math.floor(Math.random() * 15 + 2) : 0,
      reach: isPublished ? Math.floor(Math.random() * 2400 + 800) : 0
    };
    const posts = readCache('posts', activeMode, []);
    writeCache('posts', [newPost, ...posts], activeMode);
    return newPost;
  },

  async updatePost(id, postData, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const allowFallback = activeMode === 'demo' && postData?.publish_mode !== 'live';
    const payload = {
      ...postData,
      workspace_mode: activeMode,
      ...(activeMode === 'demo' ? { publish_mode: 'demo' } : {})
    };
    const data = await request(
      `/posts/${id}?workspace_mode=${encodeURIComponent(activeMode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      },
      allowFallback
    );
    if (data && data.id) {
      const posts = readCache('posts', activeMode, []);
      writeCache('posts', posts.map(p => p.id === id ? data : p), activeMode);
      return data;
    }
    const posts = readCache('posts', activeMode, []);
    const updated = posts.map(p => p.id === id ? { ...p, ...payload } : p);
    writeCache('posts', updated, activeMode);
    return updated.find(p => p.id === id);
  },

  async deletePost(id, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/posts/${id}?workspace_mode=${encodeURIComponent(activeMode)}`,
      { method: 'DELETE' },
      activeMode === 'demo'
    );
    const posts = readCache('posts', activeMode, []);
    writeCache('posts', posts.filter(p => p.id !== id), activeMode);
    return data || { success: true };
  },

  // --- CAMPAIGNS ---
  async getCampaigns(mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/campaigns?workspace_mode=${encodeURIComponent(activeMode)}`,
      {},
      activeMode === 'demo'
    );
    if (data && Array.isArray(data)) {
      writeCache('campaigns', data, activeMode);
      return data;
    }
    return readCache('campaigns', activeMode, []);
  },

  async createCampaign(campData, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      '/campaigns',
      {
        method: 'POST',
        body: JSON.stringify({ ...campData, workspace_mode: activeMode })
      },
      activeMode === 'demo'
    );
    if (data && data.id) {
      const camps = readCache('campaigns', activeMode, []);
      writeCache('campaigns', [data, ...camps], activeMode);
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
      end_date: campData.end_date || null,
      workspace_mode: activeMode
    };
    const camps = readCache('campaigns', activeMode, []);
    writeCache('campaigns', [newCamp, ...camps], activeMode);
    return newCamp;
  },

  async updateCampaign(id, campData, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/campaigns/${id}?workspace_mode=${encodeURIComponent(activeMode)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ ...campData, workspace_mode: activeMode })
      },
      activeMode === 'demo'
    );
    if (data && data.id) {
      const camps = readCache('campaigns', activeMode, []);
      writeCache('campaigns', camps.map(c => c.id === id ? data : c), activeMode);
      return data;
    }
    const camps = readCache('campaigns', activeMode, []);
    const updated = camps.map(c => c.id === id ? { ...c, ...campData } : c);
    writeCache('campaigns', updated, activeMode);
    return updated.find(c => c.id === id);
  },

  async deleteCampaign(id, mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/campaigns/${id}?workspace_mode=${encodeURIComponent(activeMode)}`,
      { method: 'DELETE' },
      activeMode === 'demo'
    );
    const camps = readCache('campaigns', activeMode, []);
    writeCache('campaigns', camps.filter(c => c.id !== id), activeMode);
    return data || { success: true };
  },

  // --- ANALYTICS ---
  async getAnalytics(range = '7d', mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/analytics?range=${encodeURIComponent(range)}&workspace_mode=${encodeURIComponent(activeMode)}`,
      {},
      activeMode === 'demo'
    );
    if (data && data.summary) return data;

    return {
      workspace_mode: activeMode,
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
      platforms: [],
      live_analytics: {
        connected_live_accounts: [],
        snapshots: [],
        oauth_required: activeMode === 'live',
        demo_mode: activeMode === 'demo',
        live_posts_count: 0,
        sandbox_posts_count: 0,
        demo_posts_count: 0,
        failed_posts_count: 0,
      }
    };
  },

  // --- GLOBAL SEARCH ---
  async search(query, mode = getAppMode()) {
    if (!query) return { posts: [], accounts: [], campaigns: [] };
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/search?q=${encodeURIComponent(query)}&workspace_mode=${encodeURIComponent(activeMode)}`,
      {},
      activeMode === 'demo'
    );
    if (data && data.posts) return data;

    const q = query.toLowerCase();
    const posts = readCache('posts', activeMode, []);
    const accounts = readCache('accounts', activeMode, []);
    const campaigns = readCache('campaigns', activeMode, []);

    return {
      posts: posts.filter(p => (p.content || '').toLowerCase().includes(q)).slice(0, 6),
      accounts: accounts.filter(a => (a.name || '').toLowerCase().includes(q) || (a.handle || '').toLowerCase().includes(q) || (a.platform || '').toLowerCase().includes(q)).slice(0, 6),
      campaigns: campaigns.filter(c => (c.title || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)).slice(0, 6)
    };
  },

  // --- ACTIVITY ---
  async getActivity(mode = getAppMode()) {
    const activeMode = mode === 'live' ? 'live' : 'demo';
    const data = await request(
      `/activity?workspace_mode=${encodeURIComponent(activeMode)}`,
      {},
      activeMode === 'demo'
    );
    if (data && Array.isArray(data)) {
      writeCache('activity', data, activeMode);
      return data;
    }
    return readCache('activity', activeMode, []);
  }
};
