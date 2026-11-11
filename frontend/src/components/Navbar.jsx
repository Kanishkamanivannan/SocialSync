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
  ChevronDown,
  Target,
  Share2,
  FileText
} from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef(null);

  const pageHeaders = {
    dashboard: { 
      title: 'Dashboard', 
      desc: "Here's what's happening with your social media today." 
    },
    compose: { 
      title: 'Create Post', 
      desc: 'Follow the 3 simple steps below to publish or schedule content.' 
    },
    calendar: { 
      title: 'Content Calendar', 
      desc: 'View all your scheduled and published posts by date.' 
    },
    accounts: { 
      title: 'Connected Accounts', 
      desc: 'Manage your connected social networks and verify sync status.' 
    },
    analytics: { 
      title: 'Analytics', 
      desc: 'Track your audience growth, impressions, and engagement in simple terms.' 
    },
    campaigns: { 
      title: 'Campaigns', 
      desc: 'Organize your marketing efforts and track progress toward your goals.' 
    },
    settings: { 
      title: 'Settings', 
      desc: 'Customize your profile, notifications, appearance, and backend connection.' 
    },
  };

  const currentHeader = pageHeaders[currentTab] || { 
    title: 'SocialSync', 
    desc: 'Manage • Create • Grow' 
  };

  // Close search popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchResults(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.search(searchQuery.trim());
        setSearchResults(res);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = (type, item) => {
    setSearchResults(null);
    setSearchQuery('');
    if (onSearchSelect) {
      onSearchSelect(type, item);
    }
  };

  const hasResults = searchResults && (
    (searchResults.posts?.length > 0) || 
    (searchResults.accounts?.length > 0) || 
    (searchResults.campaigns?.length > 0)
  );

  return (
    <header style={{
      height: '70px',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      transition: 'background-color 0.2s ease'
    }}>
      {/* Left: Mobile trigger & Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onOpenMobileMenu}
          className="mobile-nav-toggle"
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '6px'
          }}
          title="Open Menu"
        >
          <Menu size={22} />
        </button>

        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            {currentHeader.title}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            {currentHeader.desc}
          </p>
        </div>
      </div>

      {/* Right: Search, Create Post Button, Theme Toggle, Notifications, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Search Input with Live Dropdown */}
        <div 
          ref={searchContainerRef} 
          style={{ position: 'relative', display: 'flex', alignItems: 'center' }} 
          className="nav-search-bar"
        >
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
          <input
            type="text"
            placeholder="Search posts, accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '0.5rem 2rem 0.5rem 2.2rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              width: '230px',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          )}

          {/* Search Results Dropdown */}
          {searchResults && (
            <div
              className="clean-card"
              style={{
                position: 'absolute',
                top: '46px',
                left: 0,
                width: '340px',
                maxHeight: '380px',
                overflowY: 'auto',
                zIndex: 60,
                padding: '0.85rem',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              {isSearching ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                  Searching...
                </div>
              ) : !hasResults ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem', textAlign: 'center' }}>
                  No matching posts, accounts, or campaigns found for "{searchQuery}".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Posts Results */}
                  {searchResults.posts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Posts ({searchResults.posts.length})
                      </div>
                      {searchResults.posts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectResult('post', p)}
                          style={{
                            padding: '0.45rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.82rem',
                            backgroundColor: 'var(--bg-surface)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-muted)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        >
                          <FileText size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Accounts Results */}
                  {searchResults.accounts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Social Accounts ({searchResults.accounts.length})
                      </div>
                      {searchResults.accounts.map(a => (
                        <div
                          key={a.id}
                          onClick={() => handleSelectResult('account', a)}
                          style={{
                            padding: '0.45rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.82rem',
                            backgroundColor: 'var(--bg-surface)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-muted)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        >
                          <Share2 size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                          <span><strong>{a.platform}</strong> ({a.handle})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Campaigns Results */}
                  {searchResults.campaigns?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Campaigns ({searchResults.campaigns.length})
                      </div>
                      {searchResults.campaigns.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectResult('campaign', c)}
                          style={{
                            padding: '0.45rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.82rem',
                            backgroundColor: 'var(--bg-surface)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-muted)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        >
                          <Target size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
                          <span>{c.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Primary Create Post Button */}
        {currentTab !== 'compose' && (
          <button
            onClick={() => setCurrentTab('compose')}
            className="btn-primary"
            style={{ padding: '0.52rem 1.15rem', fontSize: '0.88rem' }}
          >
            <PlusCircle size={16} />
            <span>Create Post</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={() => setIsDark(!isDark)}
          title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          style={{
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isDark ? <Sun size={18} color="#F59E0B" /> : <Moon size={18} color="var(--primary)" />}
        </button>

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <Bell size={18} />
            <span style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)'
            }} />
          </button>

          {showNotifications && (
            <div 
              className="clean-card"
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                width: '320px',
                zIndex: 60,
                padding: '1.25rem',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Notifications</span>
                <button 
                  onClick={() => setShowNotifications(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {activity.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No new notifications.</p>
                ) : (
                  activity.slice(0, 4).map((act, i) => (
                    <div 
                      key={act.id || i}
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-muted)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}
                    >
                      <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{act.description}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div 
          onClick={() => setCurrentTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            backgroundColor: 'var(--bg-muted)'
          }}
          title="Account Settings"
        >
          <img 
            src={isSafeHttpUrl(user?.avatar) ? user.avatar : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"} 
            alt="Avatar" 
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {user?.name?.split(' ')[0] || 'User'}
          </span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </div>
      </div>
    </header>
  );
}
