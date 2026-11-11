import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  Bell,
  PlusCircle,
  Search,
  CheckCircle2,
  X,
  Menu,
  ChevronRight,
  ChevronDown,
  Target,
  Share2,
  FileText,
  Sparkles,
  LayoutDashboard,
  PenTool,
  CalendarDays,
  BarChart3,
  Megaphone,
  Settings,
  User
} from 'lucide-react';
import logoWhite from '../assets/logo-white.png';
import { api, isSafeHttpUrl } from '../services/api';

export default function Navbar({
  currentTab,
  setCurrentTab,
  isDark,
  setIsDark,
  user,
  activity = [],
  onSearchSelect,
  onOpenMobileMenu
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const pageHeaders = {
    dashboard: {
      group: 'Overview',
      title: 'Dashboard',
      desc: 'Overview of your scheduled posts, connected channels, and momentum.',
      icon: LayoutDashboard
    },
    compose: {
      group: 'Publishing',
      title: 'Compose Studio',
      desc: 'Create, preview, and publish or schedule content across channels.',
      icon: PenTool
    },
    calendar: {
      group: 'Publishing',
      title: 'Content Calendar',
      desc: 'Plan your publishing pipeline and review scheduled dates.',
      icon: CalendarDays
    },
    accounts: {
      group: 'Workspace',
      title: 'Connected Accounts',
      desc: 'Manage OAuth 2.0 integrations, pages, and sandbox channels.',
      icon: Share2
    },
    analytics: {
      group: 'Overview',
      title: 'Analytics & Insights',
      desc: 'Compare live API metrics with historical demo benchmarks.',
      icon: BarChart3
    },
    campaigns: {
      group: 'Publishing',
      title: 'Campaigns',
      desc: 'Organize coordinated launches and monitor milestone progress.',
      icon: Megaphone
    },
    settings: {
      group: 'Workspace',
      title: 'Workspace Settings',
      desc: 'Manage profile preferences, theme appearance, and system health.',
      icon: Settings
    }
  };

  const currentHeader = pageHeaders[currentTab] || {
    group: 'Studio',
    title: 'SocialSync',
    desc: 'Manage • Create • Grow',
    icon: Sparkles
  };
  const HeaderIcon = currentHeader.icon;

  // Close popovers on outside click and support Ctrl/Cmd+K shortcut
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchResults(null);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }

    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === 'Escape') {
        setSearchResults(null);
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Debounced live search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.search(trimmed);
        setSearchResults(res);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults(null);
      setIsSearching(false);
    }
  };

  const handleSelectResult = (type, item) => {
    setSearchResults(null);
    setSearchQuery('');
    if (onSearchSelect) {
      onSearchSelect(type, item);
    }
  };

  const hasResults =
    searchResults &&
    (searchResults.posts?.length > 0 ||
      searchResults.accounts?.length > 0 ||
      searchResults.campaigns?.length > 0);

  const userInitial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();
  const displayName = user?.name?.split(' ')[0] || 'Account';
  const roleLabel = user?.role || (user?.username ? `@${user.username}` : 'Creator Studio');

  return (
    <>
      <style>{`
        .ss-header-title {
          flex-shrink: 0;
        }
        @media (max-width: 1220px) {
          .ss-header-desc {
            display: none !important;
          }
          .ss-header-title {
            flex-shrink: 1 !important;
          }
        }
        @media (max-width: 1060px) and (min-width: 901px) {
          .ss-header-cta {
            padding: 0 0.68rem !important;
          }
          .ss-header-cta-label {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .ss-app-header {
            padding: 0 1rem !important;
            gap: 0.65rem !important;
          }
          .ss-header-cta {
            padding: 0 0.65rem !important;
          }
          .ss-header-cta-label,
          .ss-header-divider,
          .ss-header-profile-text {
            display: none !important;
          }
          .ss-header-profile-pill {
            padding: 4px 7px 4px 4px !important;
            gap: 0.35rem !important;
          }
        }
      `}</style>
      <header
        className="ss-app-header"
        style={{
        height: '74px',
        backgroundColor: 'var(--bg-glass)',
        backgroundImage: isDark
          ? 'linear-gradient(90deg, rgba(124, 115, 255, 0.09) 0%, rgba(17, 24, 39, 0) 45%, rgba(167, 139, 250, 0.06) 100%)'
          : 'linear-gradient(90deg, rgba(99, 91, 255, 0.05) 0%, rgba(255, 255, 255, 0) 45%, rgba(139, 92, 246, 0.04) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: isDark
          ? '0 4px 20px -10px rgba(0, 0, 0, 0.45)'
          : '0 4px 20px -12px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        padding: '0 1.85rem',
        position: 'sticky',
        top: 0,
        zIndex: 35,
        transition: 'background-color 0.24s ease, border-color 0.24s ease'
      }}
    >
      {/* Left: Mobile Drawer Button, Section Icon & Refined Brand Breadcrumb + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
        <button
          onClick={onOpenMobileMenu}
          className="mobile-nav-toggle"
          aria-label="Open menu"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Menu size={18} />
        </button>

        {/* Active Section Emblem */}
        <button
          type="button"
          onClick={() => setCurrentTab('dashboard')}
          title="Go to Dashboard"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'var(--gradient-brand-soft)',
            border: '1px solid var(--lavender-border)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'transform 0.16s ease, box-shadow 0.16s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 91, 255, 0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <HeaderIcon size={18} strokeWidth={2.1} />
        </button>

        {/* Breadcrumb + Title Stack */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.32rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--primary)'
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '5px',
                  background: 'var(--gradient-brand)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(99, 91, 255, 0.28)'
                }}
              >
                <img src={logoWhite} alt="" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
              </span>
              SocialSync
            </span>
            <ChevronRight size={11} color="var(--text-muted)" />
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)'
              }}
            >
              {currentHeader.group}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', minWidth: 0 }}>
            <h1
              className="ss-header-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.14rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                margin: 0,
                lineHeight: 1.15,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0
              }}
            >
              {currentHeader.title}
            </h1>
            <span
              className="ss-header-desc"
              style={{
                fontSize: '0.77rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: '1 1 0',
                minWidth: 0
              }}
            >
              — {currentHeader.desc}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Search & Action Group | Utility Dock | Profile Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
        {/* Live Search Command Box */}
        <div
          ref={searchContainerRef}
          className="nav-search-bar"
          style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        >
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search posts, channels..."
            value={searchQuery}
            onChange={handleSearchChange}
            style={{
              height: '38px',
              padding: '0 3.5rem 0 2.25rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.83rem',
              width: 'clamp(160px, 16vw, 240px)',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
              transition: 'border-color 0.16s ease, box-shadow 0.16s ease, width 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.boxShadow = '0 0 0 3px rgba(99, 91, 255, 0.14)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.boxShadow = 'var(--shadow-sm)';
            }}
          />

          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '9px',
                background: 'var(--bg-muted)',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                width: '20px',
                height: '20px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={12} />
            </button>
          ) : (
            <kbd
              style={{
                position: 'absolute',
                right: '9px',
                fontSize: '0.67rem',
                fontWeight: 600,
                padding: '0.14rem 0.44rem',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-muted)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            >
              Ctrl K
            </kbd>
          )}

          {/* Search Results Dropdown */}
          {searchResults && (
            <div
              className="clean-card"
              style={{
                position: 'absolute',
                top: '46px',
                right: 0,
                width: '360px',
                maxHeight: '400px',
                overflowY: 'auto',
                zIndex: 70,
                padding: '0.9rem',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              {isSearching ? (
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', padding: '0.6rem', textAlign: 'center' }}>
                  Searching workspace...
                </div>
              ) : !hasResults ? (
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', padding: '0.85rem', textAlign: 'center' }}>
                  No results matching <strong>"{searchQuery}"</strong>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {searchResults.posts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', paddingLeft: '0.35rem' }}>
                        Posts ({searchResults.posts.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {searchResults.posts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectResult('post', p)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.52rem 0.65rem',
                              borderRadius: '9px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              backgroundColor: 'transparent',
                              transition: 'background-color 0.14s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-muted)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <FileText size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.content}
                            </span>
                            <ChevronRight size={13} color="var(--text-muted)" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.accounts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', paddingLeft: '0.35rem' }}>
                        Connected Channels ({searchResults.accounts.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {searchResults.accounts.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => handleSelectResult('account', a)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.52rem 0.65rem',
                              borderRadius: '9px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              backgroundColor: 'transparent',
                              transition: 'background-color 0.14s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-muted)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Share2 size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>
                              <strong>{a.platform}</strong> <span style={{ color: 'var(--text-secondary)' }}>({a.handle})</span>
                            </span>
                            <ChevronRight size={13} color="var(--text-muted)" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.campaigns?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', paddingLeft: '0.35rem' }}>
                        Campaigns ({searchResults.campaigns.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {searchResults.campaigns.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectResult('campaign', c)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '0.52rem 0.65rem',
                              borderRadius: '9px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              backgroundColor: 'transparent',
                              transition: 'background-color 0.14s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-muted)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Target size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{c.title}</span>
                            <ChevronRight size={13} color="var(--text-muted)" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Create CTA */}
        {currentTab !== 'compose' && (
          <button
            onClick={() => setCurrentTab('compose')}
            className="btn-primary ss-header-cta"
            title="Create Post"
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.83rem',
              borderRadius: '10px',
              gap: '0.45rem'
            }}
          >
            <PlusCircle size={15} />
            <span className="ss-header-cta-label">Create Post</span>
          </button>
        )}

        {/* Hairline Divider */}
        <div
          aria-hidden="true"
          className="ss-header-divider"
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--border-color)',
            opacity: 0.85
          }}
        />

        {/* Compact Utility Dock: Theme + Notifications */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '3px',
            borderRadius: '11px',
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border-color)'
          }}
        >
          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.16s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {isDark ? <Sun size={16} color="#FBBF24" /> : <Moon size={16} color="var(--primary)" />}
          </button>

          <div ref={notificationRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowProfileMenu(false);
                setShowNotifications(!showNotifications);
              }}
              title="Activity notifications"
              aria-label="Toggle notifications"
              style={{
                background: showNotifications ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: showNotifications ? 'var(--primary)' : 'var(--text-primary)',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: showNotifications ? 'var(--shadow-sm)' : 'none',
                transition: 'background-color 0.16s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; }}
              onMouseLeave={(e) => {
                if (!showNotifications) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Bell size={16} />
              {activity.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    boxShadow: '0 0 0 2px var(--bg-surface)'
                  }}
                />
              )}
            </button>

            {showNotifications && (
              <div
                className="clean-card"
                style={{
                  position: 'absolute',
                  top: '44px',
                  right: 0,
                  width: '340px',
                  zIndex: 70,
                  padding: '1.1rem',
                  boxShadow: 'var(--shadow-lg)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.85rem',
                    paddingBottom: '0.6rem',
                    borderBottom: '1px solid var(--border-light)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Sparkles size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Activity Feed</span>
                    {activity.length > 0 && (
                      <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                        {activity.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    aria-label="Close notifications"
                    style={{
                      background: 'var(--bg-muted)',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {activity.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0.5rem' }}>
                      You're all caught up. Recent activity will appear here.
                    </div>
                  ) : (
                    activity.slice(0, 6).map((act, i) => (
                      <div
                        key={act.id || i}
                        style={{
                          padding: '0.65rem 0.75rem',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-muted)',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.55rem'
                        }}
                      >
                        <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px', lineHeight: 1.4 }}>
                            {act.description}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profile Pill Area */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(false);
              setShowProfileMenu(!showProfileMenu);
            }}
            className="ss-header-profile-pill"
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
            title="Account & Workspace Menu"
            style={{
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '4px 10px 4px 5px',
              borderRadius: '12px',
              border: `1px solid ${showProfileMenu ? 'var(--lavender-border)' : 'var(--border-color)'}`,
              cursor: 'pointer',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: showProfileMenu ? '0 0 0 3px rgba(99, 91, 255, 0.1)' : 'var(--shadow-sm)',
              transition: 'all 0.16s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--lavender-border)'; }}
            onMouseLeave={(e) => {
              if (!showProfileMenu) e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {isSafeHttpUrl(user?.avatar) ? (
                <img
                  src={user.avatar}
                  alt={user?.name || 'Profile'}
                  style={{ width: '30px', height: '30px', borderRadius: '9px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '9px',
                    background: 'var(--gradient-brand)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {userInitial}
                </div>
              )}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  boxShadow: '0 0 0 2px var(--bg-surface)'
                }}
              />
            </div>

            <div
              className="ss-header-profile-text"
              style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', minWidth: 0 }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.15,
                  maxWidth: '108px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  fontSize: '0.67rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.15,
                  maxWidth: '108px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {roleLabel}
              </span>
            </div>

            <ChevronDown
              size={14}
              color="var(--text-muted)"
              style={{
                flexShrink: 0,
                transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.16s ease'
              }}
            />
          </button>

          {showProfileMenu && (
            <div
              role="menu"
              className="clean-card"
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                width: '235px',
                zIndex: 70,
                padding: '0.65rem',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div
                style={{
                  padding: '0.55rem 0.65rem 0.7rem',
                  borderBottom: '1px solid var(--border-light)',
                  marginBottom: '0.45rem'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  {user?.name || displayName}
                </div>
                {user?.email && (
                  <div
                    style={{
                      fontSize: '0.73rem',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {user.email}
                  </div>
                )}
              </div>

              {[
                { id: 'settings', label: 'Profile & Settings', icon: User },
                { id: 'accounts', label: 'Connected Channels', icon: Share2 },
                { id: 'analytics', label: 'Performance Insights', icon: BarChart3 }
              ].map((item) => {
                const ItemIcon = item.icon;
                const active = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    role="menuitem"
                    onClick={() => {
                      setCurrentTab(item.id);
                      setShowProfileMenu(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.54rem 0.65rem',
                      borderRadius: '9px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--primary)' : 'var(--text-primary)',
                      backgroundColor: active ? 'var(--lavender)' : 'transparent',
                      transition: 'background-color 0.14s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <ItemIcon size={14} color={active ? 'var(--primary)' : 'var(--text-secondary)'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </header>
    </>
  );
}
