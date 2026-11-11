import React from 'react';
import {
  LayoutDashboard,
  PenTool,
  CalendarDays,
  Share2,
  BarChart3,
  Megaphone,
  Settings,
  LogOut,
  Sparkles,
  X
} from 'lucide-react';
import logoWhite from '../assets/logo-white.png';
import { isSafeHttpUrl } from '../services/api';

export default function Sidebar({
  currentTab,
  setCurrentTab,
  user,
  onLogout,
  isDark,
  isMobile,
  onCloseMobile,
  scheduledCount = 0,
  connectedCount = 0
}) {
  const navGroups = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    {
      label: 'Publishing',
      items: [
        { id: 'compose', label: 'Compose Post', icon: PenTool },
        {
          id: 'calendar',
          label: 'Calendar',
          icon: CalendarDays,
          badge: scheduledCount > 0 ? scheduledCount : null
        },
        { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
      ]
    },
    {
      label: 'Workspace',
      items: [
        {
          id: 'accounts',
          label: 'Connected Accounts',
          icon: Share2,
          badge: connectedCount > 0 ? connectedCount : null
        },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  const handleNavClick = (id) => {
    setCurrentTab(id);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const userInitial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <aside
      style={{
        width: '264px',
        height: '100vh',
        position: isMobile ? 'relative' : 'sticky',
        top: 0,
        backgroundColor: 'var(--bg-surface)',
        backgroundImage: isDark
          ? 'linear-gradient(180deg, rgba(99, 91, 255, 0.08) 0%, rgba(17, 24, 39, 0) 24%)'
          : 'linear-gradient(180deg, rgba(99, 91, 255, 0.05) 0%, rgba(255, 255, 255, 0) 22%)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem 0.95rem 1rem',
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'background-color 0.24s ease, border-color 0.24s ease',
        zIndex: 40
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25rem 0.4rem 1.25rem',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '1rem'
        }}
      >
        <div
          onClick={() => handleNavClick('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.7rem',
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(99, 91, 255, 0.34)',
              flexShrink: 0
            }}
          >
            <img
              src={logoWhite}
              alt="SocialSync"
              style={{ width: '21px', height: '21px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.14rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1
                }}
              >
                SocialSync
              </span>
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                marginTop: '2px'
              }}
            >
              Creator Studio
            </span>
          </div>
        </div>

        {isMobile && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Grouped Navigation Links */}
      <nav
        aria-label="Primary navigation"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
          overflowY: 'auto',
          paddingRight: '2px'
        }}
      >
        {navGroups.map((group) => (
          <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.69rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                padding: '0 0.75rem 0.25rem'
              }}
            >
              {group.label}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.62rem 0.78rem',
                    borderRadius: '11px',
                    border: isActive ? '1px solid var(--lavender-border)' : '1px solid transparent',
                    background: isActive ? 'var(--gradient-brand-soft)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.16s cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
                    {isActive && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: '3px',
                          borderRadius: '0 4px 4px 0',
                          background: 'var(--gradient-brand)'
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isActive ? 'var(--gradient-brand)' : 'transparent',
                        color: isActive ? '#FFFFFF' : 'inherit',
                        boxShadow: isActive ? '0 3px 10px rgba(99, 91, 255, 0.28)' : 'none',
                        transition: 'all 0.16s ease',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.25 : 1.9} />
                    </div>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.48rem',
                        borderRadius: '999px',
                        backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-muted)',
                        color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                        border: isActive ? 'none' : '1px solid var(--border-color)'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Workspace Tip + User Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.75rem' }}>
        <div
          style={{
            background: 'var(--gradient-brand-soft)',
            border: '1px solid var(--lavender-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.78rem 0.88rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem'
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '7px',
              background: 'var(--gradient-brand)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '1px'
            }}
          >
            <Sparkles size={13} />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Workflow Tip
            </div>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Switch between Sandbox testing and Live API inside Compose anytime.
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '0.68rem 0.72rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}
        >
          {isSafeHttpUrl(user?.avatar) ? (
            <img
              src={user.avatar}
              alt={user?.name || 'User'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '1.5px solid var(--lavender-border)',
                flexShrink: 0
              }}
            />
          ) : (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--gradient-brand)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {userInitial}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.83rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {user?.name || 'SocialSync User'}
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {user?.role || user?.email || 'Workspace Admin'}
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign Out"
            aria-label="Sign Out"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.16s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger-bg)';
              e.currentTarget.style.borderColor = 'var(--danger-border)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
