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
import { api, API_BASE, clearSessionStorageCaches } from './services/api';
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

  // Load Initial Data from Backend
  const loadData = async () => {
    if (!hasValidSessionToken()) return;
    try {
      const [u, accs, psts, camps, acts, anlt] = await Promise.all([
        api.getMe(),
        api.getAccounts(),
        api.getPosts(),
        api.getCampaigns(),
        api.getActivity(),
        api.getAnalytics()
      ]);
      if (u) setUser(u);
      setAccounts(accs || []);
      setPosts(psts || []);
      setCampaigns(camps || []);
      setActivity(acts || []);
      setAnalytics(anlt || null);
    } catch (err) {
      console.error('Error loading SocialSync data:', err);
    }
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
      loadData();
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
    setCurrentView('app');
    loadData();
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setAccounts([]);
    setPosts([]);
    setCampaigns([]);
    setActivity([]);
    setAnalytics(null);
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
  };

  const handlePostDeleted = (deletedId) => {
    setPosts(prev => prev.filter(p => p.id !== deletedId));
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

  // Quick navigation from Search
  const handleSearchSelect = (type) => {
    if (type === 'post') setCurrentTab('calendar');
    else if (type === 'account') setCurrentTab('accounts');
    else if (type === 'campaign') setCurrentTab('campaigns');
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
  return (
    <div className="app-container">
      {/* Sidebar for Desktop */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onLogout={handleLogout}
        isDark={isDark}
      />

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <>
          <div 
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(3px)',
              zIndex: 45
            }}
          />
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            user={user}
            onLogout={handleLogout}
            isDark={isDark}
            isMobile={true}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
        </>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
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
          {currentTab === 'dashboard' && (
            <Dashboard
              user={user}
              posts={posts}
              activity={activity}
              analytics={analytics}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'compose' && (
            <Compose
              accounts={accounts}
              campaigns={campaigns}
              onPostCreated={handlePostCreated}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'calendar' && (
            <Calendar
              posts={posts}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'accounts' && (
            <Accounts
              accounts={accounts}
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
              onReloadAnalytics={loadData}
            />
          )}

          {currentTab === 'campaigns' && (
            <Campaigns
              campaigns={campaigns}
              posts={posts}
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
            />
          )}
        </main>
      </div>
    </div>
  );
}
