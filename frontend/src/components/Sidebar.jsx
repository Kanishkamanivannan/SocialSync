import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Calendar, 
  Share2, 
  BarChart3, 
  Target, 
  Settings, 
  LogOut,
  HelpCircle,
  X
} from 'lucide-react';
import logoLight from '../assets/logo.png';
import logoWhite from '../assets/logo-white.png';

export default function Sidebar({ currentTab, setCurrentTab, user, onLogout, isDark, isMobile, onCloseMobile }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'compose', label: 'Create Post', icon: PlusCircle },
    { id: 'calendar', label: 'Content Calendar', icon: Calendar },
    { id: 'accounts', label: 'Connected Accounts', icon: Share2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'campaigns', label: 'Campaigns', icon: Target },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside 
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.25rem 1rem',
        height: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        zIndex: 50,
        boxShadow: isMobile ? '0 10px 25px rgba(0,0,0,0.2)' : 'none',
        transition: 'background-color 0.2s ease, transform 0.25s ease'
      }} 
      className={isMobile ? '' : 'sidebar-desktop'}
    >
      <div>
        {/* Brand Logo and Close button on mobile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.5rem 1.75rem 0.5rem'
        }}>
          <div 
            onClick={() => {
              setCurrentTab('dashboard');
              if (onCloseMobile) onCloseMobile();
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              cursor: 'pointer' 
            }}
          >
            <img 
              src={isDark ? logoWhite : logoLight} 
              alt="SocialSync Logo" 
              style={{ width: '36px', height: '36px', objectFit: 'contain' }} 
            />
            <div>
              <div style={{ 
                fontWeight: 800, 
                fontSize: '1.2rem', 
                color: 'var(--primary)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1
              }}>
                SocialSync
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Manage • Create • Grow
              </div>
            </div>
          </div>

          {isMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  padding: '0.7rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--lavender)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? '4px solid var(--primary)' : '4px solid transparent'
                }}
              >
                <Icon size={18} color={isActive ? 'var(--primary)' : 'currentColor'} />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span style={{
                    marginLeft: 'auto',
                    backgroundColor: 'var(--lavender)',
                    color: 'var(--primary)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}>
                    + New
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Beginner Help Card & User Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Beginner Help Callout */}
        <div style={{
          backgroundColor: 'var(--lavender)',
          border: '1px solid var(--lavender-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
            <HelpCircle size={15} />
            <span>Beginner Tip</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Need help? Click <strong>Create Post</strong> to schedule content to Instagram, X, Facebook, and more in 3 easy steps!
          </p>
        </div>

        {/* User Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 0.5rem 0 0.5rem',
          borderTop: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
            <img 
              src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"} 
              alt={user?.name || "User Avatar"} 
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: '0.88rem', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {user?.name || 'User'}
              </div>
              <div style={{ 
                fontSize: '0.72rem', 
                color: 'var(--text-muted)', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {user?.role || 'Member'}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Log Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
