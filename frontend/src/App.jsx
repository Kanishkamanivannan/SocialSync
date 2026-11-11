import React, { useState, useEffect } from 'react';
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Compose from './pages/Compose';
import Calendar from './pages/Calendar';
import Accounts from './pages/Accounts';
import Analytics from './pages/Analytics';
import Campaigns from './pages/Campaigns';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { api, API_BASE, clearSessionStorageCaches, getAppMode, setAppMode } from './services/api';
import { FlaskConical, Server, AlertTriangle, X, RefreshCw } from 'lucide-react';
import './App.css';

const hasValidSessionToken = () => {
  const token = localStorage.getItem('socialsync_token');
  return Boolean(token && token !== 'local_offline_token');
};

const ALLOWED_OAUTH_ORIGINS = (() => {
  const origins = new Set();
  if (typeof window !== 'undefined') {
    origins.add(window.location.origin);
    try {
      origins.add(new URL(API_BASE, window.location.origin).origin);
    } catch {
      // Ignore invalid API_BASE
    }
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      origins.add('http://127.0.0.1:5000');
      origins.add('http://localhost:5000');
    }
  }
  return origins;
})();

export default function App() {
  // Navigation State: 'splash' | 'onboarding' | 'auth' | 'app'
  const [currentView, setCurrentView] = useState(() => {
    const savedUser = localStorage.getItem('socialsync_user');
    const hasSeenSplash = sessionStorage.getItem('socialsync_seen_splash');
    if (!hasSeenSplash) return 'splash';
    return savedUser && hasValidSessionToken() ? 'app' : 'onboarding';
  });

  const [authMode, setAuthMode] = useState('login');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [composePrefillDate, setComposePrefillDate] = useState(null);
  const [calendarFocus, setCalendarFocus] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('socialsync_theme') === 'dark';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Data State
  const [user, setUser] = useState(() => {
    try {
      if (!hasValidSessionToken()) return null;
      const saved = localStorage.getItem('socialsync_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [appMode, setAppModeState] = useState(() => getAppMode());
  const [modeSwitching, setModeSwitching] = useState(false);
  const [modeNotice, setModeNotice] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'connected' | 'offline'
  const [backendHealth, setBackendHealth] = useState(null);
  const [liveError, setLiveError] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [activity, setActivity] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Apply dark theme class to document root
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('socialsync_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('socialsync_theme', 'light');
    }
  }, [isDark]);

  const checkBackendHealth = async () => {
    setBackendStatus('checking');
    try {
      const data = await api.getHealth();
      setBackendHealth(data);
      setBackendStatus('connected');
      return true;
    } catch {
      setBackendHealth(null);
      setBackendStatus('offline');
      return false;
    }
  };

  // Load Initial Data from Backend for Active Workspace Mode
  const loadData = async (modeOverride) => {
    if (!hasValidSessionToken()) return;
    const activeMode =
      modeOverride === 'live' || modeOverride === 'demo' ? modeOverride : getAppMode();
    try {
      const [healthRes, u, accs, psts, camps, acts, anlt] = await Promise.allSettled([
        api.getHealth(),
        api.getMe(),
        api.getAccounts(activeMode),
        api.getPosts('all', '', '', activeMode),
        api.getCampaigns(activeMode),
        api.getActivity(activeMode),
        api.getAnalytics('7d', activeMode)
      ]);

      if (healthRes.status === 'fulfilled') {
        setBackendHealth(healthRes.value);
        setBackendStatus('connected');
      } else {
        setBackendHealth(null);
        setBackendStatus('offline');
      }

      if (u.status === 'fulfilled' && u.value) {
        setUser(u.value);
      }

      const dataRejects = [accs, psts, camps, acts, anlt].filter((r) => r.status === 'rejected');
      if (activeMode === 'live' && dataRejects.length > 0) {
        const firstErr = dataRejects[0].reason;
        setLiveError(firstErr?.message || 'Unable to fetch live workspace data from Flask backend.');
      } else {
        setLiveError(null);
      }

      setAccounts(accs.status === 'fulfilled' && Array.isArray(accs.value) ? accs.value : []);
      setPosts(psts.status === 'fulfilled' && Array.isArray(psts.value) ? psts.value : []);
      setCampaigns(camps.status === 'fulfilled' && Array.isArray(camps.value) ? camps.value : []);
      setActivity(acts.status === 'fulfilled' && Array.isArray(acts.value) ? acts.value : []);
      setAnalytics(anlt.status === 'fulfilled' ? (anlt.value || null) : null);
    } catch (err) {
      console.error('Error loading SocialSync data:', err);
      if (activeMode === 'live') {
        setLiveError(err?.message || 'Unable to load Live Server Mode workspace.');
      }
    }
  };

  const handleSwitchAppMode = async (nextMode) => {
    const targetMode = nextMode === 'live' ? 'live' : 'demo';
    setModeSwitching(true);
    setModeNotice(null);
    setLiveError(null);

    let serverSaved = false;
    let serverErr = null;
    try {
      const res = await api.updateAppModeSetting(targetMode);
      if (res && res.app_mode) {
        serverSaved = true;
      }
    } catch (err) {
      serverErr = err?.message || 'Backend unreachable while saving operating mode preference.';
    }

    setAppMode(targetMode);
    setAppModeState(targetMode);
    await loadData(targetMode);

    if (targetMode === 'live' && serverErr) {
      setModeNotice({
        type: 'error',
        text: `Switched to Live Server Mode, but backend check failed: ${serverErr}`
      });
    } else {
      setModeNotice({
        type: 'success',
        text:
          targetMode === 'demo'
            ? `Dummy Demo Mode is now active${serverSaved ? ' (saved to SQLite)' : ''}. Simulated data and "Demo Published" actions are ready.`
            : 'Live Server Mode is now active. Connected to Flask API & SQLite (no demo data).'
      });
    }
    setModeSwitching(false);
  };

  const [oauthNotice, setOauthNotice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('oauth_status');
    if (!status) return null;
    const provider = params.get('provider');
    const providerLabel = provider ? `${provider.charAt(0).toUpperCase()}${provider.slice(1)} ` : '';
    return {
      type: status === 'success' ? 'success' : 'error',
      text: status === 'success'
        ? `${providerLabel}social account connected successfully.`
        : `${providerLabel}OAuth authorization failed. Please try again.`
    };
  });

  useEffect(() => {
    if (hasValidSessionToken()) {
      Promise.resolve().then(() => {
        loadData();
      });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has('oauth_status')) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      Promise.resolve().then(() => {
        setCurrentTab('accounts');
      });
    }

    const handleOAuthMessage = (event) => {
      if (!ALLOWED_OAUTH_ORIGINS.has(event.origin)) return;
      const data = event?.data;
      if (!data || data.type !== 'socialsync-oauth') return;
      setOauthNotice({
        type: data.success ? 'success' : 'error',
        text: data.success
          ? (data.message || 'Social media account connected successfully!')
          : (data.error || data.message || 'OAuth authorization failed.')
      });
      setCurrentTab('accounts');
      loadData();
    };

    const handleAuthExpired = () => {
      clearSessionStorageCaches();
      setUser(null);
      setAccounts([]);
      setPosts([]);
      setCampaigns([]);
      setActivity([]);
      setAnalytics(null);
      setCurrentView('auth');
      setAuthMode('login');
    };

    window.addEventListener('message', handleOAuthMessage);
    window.addEventListener('socialsync-auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      window.removeEventListener('socialsync-auth-expired', handleAuthExpired);
    };
  }, []);

  // Auth Handlers
  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    localStorage.setItem('socialsync_user', JSON.stringify(authenticatedUser));
    const nextMode = setAppMode(authenticatedUser?.app_mode || 'demo');
    setAppModeState(nextMode);
    setCurrentView('app');
    loadData(nextMode);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setAccounts([]);
    setPosts([]);
    setCampaigns([]);
    setActivity([]);
    setAnalytics(null);
    setLiveError(null);
    setModeNotice(null);
    setCurrentView('auth');
    setAuthMode('login');
  };

  const handleSplashFinish = () => {
    sessionStorage.setItem('socialsync_seen_splash', 'true');
    setCurrentView(user && hasValidSessionToken() ? 'app' : 'onboarding');
  };

  // State Updates from Pages
  const handleUserUpdated = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('socialsync_user', JSON.stringify(updatedUser));
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
    loadData();
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    loadData();
  };

  const handlePostDeleted = (deletedId) => {
    setPosts(prev => prev.filter(p => p.id !== deletedId));
    loadData();
  };

  const handleAccountUpdated = (updatedAcc) => {
    setAccounts(prev => prev.map(a => a.id === updatedAcc.id ? updatedAcc : a));
    loadData();
  };

  const handleAccountsSynced = (syncResponse) => {
    const nextAccounts = Array.isArray(syncResponse)
      ? syncResponse
      : (Array.isArray(syncResponse?.accounts) ? syncResponse.accounts : null);
    if (nextAccounts) {
      setAccounts(nextAccounts);
    }
    loadData();
  };

  const handleCampaignCreated = (newCamp) => {
    setCampaigns(prev => [newCamp, ...prev]);
    loadData();
  };

  const handleCampaignUpdated = (updatedCamp) => {
    setCampaigns(prev => prev.map(c => c.id === updatedCamp.id ? updatedCamp : c));
    loadData();
  };

  const handleCampaignDeleted = (deletedId) => {
    setCampaigns(prev => prev.filter(c => c.id !== deletedId));
    loadData();
  };

  // Navigation helper supporting optional context (e.g. Calendar -> Compose date prefill)
  const handleNavigate = (tab, prefillDate = null) => {
    setComposePrefillDate(tab === 'compose' && typeof prefillDate === 'string' ? prefillDate : null);
    if (tab !== 'calendar') {
      setCalendarFocus(null);
    }
    setCurrentTab(tab);
  };

  // Quick navigation from Search
  const handleSearchSelect = (type, item) => {
    setComposePrefillDate(null);
    if (type === 'post') {
      setCalendarFocus(item ? { post: item, key: Date.now() } : null);
      setCurrentTab('calendar');
    } else if (type === 'account') {
      setCalendarFocus(null);
      setCurrentTab('accounts');
    } else if (type === 'campaign') {
      setCalendarFocus(null);
      setCurrentTab('campaigns');
    }
  };

  // 1. Splash Screen View
  if (currentView === 'splash') {
    return <Splash onFinish={handleSplashFinish} />;
  }

  // 2. Onboarding / Landing View
  if (currentView === 'onboarding') {
    return (
      <Onboarding
        onGetStarted={() => {
          setAuthMode('signup');
          setCurrentView('auth');
        }}
        onLogin={() => {
          setAuthMode('login');
          setCurrentView('auth');
        }}
      />
    );
  }

  // 3. Auth View (Login / Signup)
  if (currentView === 'auth') {
    return (
      <Auth
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
        onBack={() => setCurrentView('onboarding')}
      />
    );
  }

  // 4-10. Main Authenticated Application
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;
  const connectedCount = accounts.filter((a) => a.connected || a.oauth_connected).length;

  return (
    <div className="app-container">
      {/* Sidebar for Desktop */}
      <div className="sidebar-desktop">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={handleNavigate}
          user={user}
          onLogout={handleLogout}
          isDark={isDark}
          scheduledCount={scheduledCount}
          connectedCount={connectedCount}
        />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(9, 13, 22, 0.62)',
              backdropFilter: 'blur(4px)',
              zIndex: 45
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 55
            }}
          >
            <Sidebar
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
              user={user}
              onLogout={handleLogout}
              isDark={isDark}
              isMobile={true}
              onCloseMobile={() => setMobileMenuOpen(false)}
              scheduledCount={scheduledCount}
              connectedCount={connectedCount}
            />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={handleNavigate}
          isDark={isDark}
          setIsDark={setIsDark}
          user={user}
          activity={activity}
          posts={posts}
          accounts={accounts}
          campaigns={campaigns}
          onSearchSelect={handleSearchSelect}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="content-body">
          {/* Global Operating Mode Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.65rem',
              padding: '0.62rem 1rem',
              marginBottom: '1.15rem',
              borderRadius: '12px',
              backgroundColor:
                appMode === 'demo'
                  ? 'var(--lavender)'
                  : backendStatus === 'offline'
                  ? 'var(--danger-bg)'
                  : 'var(--success-bg)',
              border: `1px solid ${
                appMode === 'demo'
                  ? 'rgba(99, 91, 255, 0.28)'
                  : backendStatus === 'offline'
                  ? 'var(--danger-border)'
                  : 'var(--success-border)'
              }`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span
                className={`badge ${
                  appMode === 'demo'
                    ? 'badge-primary'
                    : backendStatus === 'offline'
                    ? 'badge-danger'
                    : 'badge-success'
                }`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
              >
                {appMode === 'demo' ? <FlaskConical size={12} /> : <Server size={12} />}
                <span>{appMode === 'demo' ? 'DEMO MODE' : 'LIVE SERVER MODE'}</span>
              </span>

              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color:
                    appMode === 'demo'
                      ? 'var(--text-primary)'
                      : backendStatus === 'offline'
                      ? 'var(--danger)'
                      : 'var(--success)'
                }}
              >
                {appMode === 'demo'
                  ? 'Simulated workspace active · No real external social posts sent · Publishing labeled "Demo Published".'
                  : backendStatus === 'offline'
                  ? `Flask Backend Offline (${API_BASE}) — Unable to connect to live SQLite workspace.`
                  : `Flask & SQLite Connected · Real API & database workspace · OAuth Setup Required for external publishing.`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleSwitchAppMode(appMode === 'demo' ? 'live' : 'demo')}
                disabled={modeSwitching}
                className="btn-secondary"
                style={{ padding: '0.34rem 0.72rem', fontSize: '0.76rem' }}
              >
                {modeSwitching && <RefreshCw size={12} />}
                <span>{appMode === 'demo' ? 'Switch to Live Server' : 'Switch to Demo Mode'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('settings')}
                className="btn-secondary"
                style={{ padding: '0.34rem 0.72rem', fontSize: '0.76rem' }}
              >
                Mode Settings
              </button>
            </div>
          </div>

          {appMode === 'live' && liveError && (
            <div className="alert-banner alert-banner-error" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} />
              <div style={{ flex: 1, fontSize: '0.82rem' }}>
                <strong>Live Server Sync Error:</strong> {liveError}
              </div>
              <button type="button" onClick={() => loadData('live')} className="btn-secondary" style={{ padding: '0.28rem 0.6rem', fontSize: '0.74rem' }}>
                Retry
              </button>
            </div>
          )}

          {modeNotice && (
            <div
              className={`alert-banner ${modeNotice.type === 'success' ? 'alert-banner-success' : 'alert-banner-error'}`}
              style={{ marginBottom: '1rem' }}
            >
              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500 }}>{modeNotice.text}</span>
              <button
                type="button"
                onClick={() => setModeNotice(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.15rem' }}
                aria-label="Dismiss mode notice"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {currentTab === 'dashboard' && (
            <Dashboard
              user={user}
              posts={posts}
              accounts={accounts}
              activity={activity}
              analytics={analytics}
              appMode={appMode}
              backendStatus={backendStatus}
              backendHealth={backendHealth}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'compose' && (
            <Compose
              key={composePrefillDate || 'default'}
              prefillDate={composePrefillDate}
              accounts={accounts}
              campaigns={campaigns}
              posts={posts}
              appMode={appMode}
              backendStatus={backendStatus}
              onPostCreated={handlePostCreated}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onSwitchAppMode={handleSwitchAppMode}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'calendar' && (
            <Calendar
              key={calendarFocus?.key || 'cal'}
              focusPost={calendarFocus?.post || null}
              posts={posts}
              appMode={appMode}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'accounts' && (
            <Accounts
              accounts={accounts}
              appMode={appMode}
              backendStatus={backendStatus}
              onAccountUpdated={handleAccountUpdated}
              onAccountsSynced={handleAccountsSynced}
              onRefreshData={loadData}
              oauthNotice={oauthNotice}
              onClearOAuthNotice={() => setOauthNotice(null)}
            />
          )}

          {currentTab === 'analytics' && (
            <Analytics
              analytics={analytics}
              posts={posts}
              appMode={appMode}
              backendStatus={backendStatus}
              onReloadAnalytics={loadData}
            />
          )}

          {currentTab === 'campaigns' && (
            <Campaigns
              campaigns={campaigns}
              posts={posts}
              appMode={appMode}
              backendStatus={backendStatus}
              onCampaignCreated={handleCampaignCreated}
              onCampaignUpdated={handleCampaignUpdated}
              onCampaignDeleted={handleCampaignDeleted}
            />
          )}

          {currentTab === 'settings' && (
            <Settings
              user={user}
              onUserUpdated={handleUserUpdated}
              isDark={isDark}
              setIsDark={setIsDark}
              appMode={appMode}
              modeSwitching={modeSwitching}
              modeNotice={modeNotice}
              onDismissModeNotice={() => setModeNotice(null)}
              onSwitchAppMode={handleSwitchAppMode}
              backendStatus={backendStatus}
              backendHealth={backendHealth}
              onRefreshBackendHealth={checkBackendHealth}
            />
          )}
        </main>
      </div>
    </div>
  );
}
