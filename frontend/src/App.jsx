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
import { api } from './services/api';
import './App.css';

export default function App() {
  // Navigation State: 'splash' | 'onboarding' | 'auth' | 'app'
  const [currentView, setCurrentView] = useState(() => {
    const savedUser = localStorage.getItem('socialsync_user');
    const hasSeenSplash = sessionStorage.getItem('socialsync_seen_splash');
    if (!hasSeenSplash) return 'splash';
    return savedUser ? 'app' : 'onboarding';
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
  const [loading, setLoading] = useState(true);

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

  // Load Initial Data from Backend & LocalStorage
  const loadData = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auth Handlers
  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    localStorage.setItem('socialsync_user', JSON.stringify(authenticatedUser));
    setCurrentView('app');
    loadData();
  };

  const handleLogout = () => {
    localStorage.removeItem('socialsync_user');
    setUser(null);
    setCurrentView('auth');
    setAuthMode('login');
  };

  const handleSplashFinish = () => {
    sessionStorage.setItem('socialsync_seen_splash', 'true');
    setCurrentView(user ? 'app' : 'onboarding');
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

  const handleCampaignCreated = (newCamp) => {
    setCampaigns(prev => [newCamp, ...prev]);
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
            />
          )}

          {currentTab === 'analytics' && (
            <Analytics
              analytics={analytics}
              posts={posts}
            />
          )}

          {currentTab === 'campaigns' && (
            <Campaigns
              campaigns={campaigns}
              onCampaignCreated={handleCampaignCreated}
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
