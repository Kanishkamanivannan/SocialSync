import React, { useState, useEffect } from 'react';
import {
  User,
  Moon,
  Sun,
  Bell,
  Database,
  Check,
  AlertCircle,
  AtSign,
  Mail,
  Briefcase,
  Image as ImageIcon,
  Save,
  RefreshCw,
  Clock,
  LogOut,
  Palette,
  FlaskConical,
  Server,
  Sliders,
  X as CloseIcon
} from 'lucide-react';
import { api, API_BASE, isSafeHttpUrl } from '../services/api';

const AVATAR_PRESETS = [
  { label: 'Default', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { label: 'Corporate', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { label: 'Creative', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { label: 'Modern', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80' }
];

export default function Settings({
  user,
  onUserUpdated,
  isDark,
  setIsDark,
  appMode = 'demo',
  modeSwitching = false,
  modeNotice = null,
  onDismissModeNotice,
  onSwitchAppMode,
  backendStatus: parentBackendStatus,
  backendHealth: parentBackendHealth,
  onRefreshBackendHealth
}) {
  const [activeSection, setActiveSection] = useState('all'); // 'all', 'mode', 'profile', 'appearance', 'notifications', 'system'
  const [draft, setDraft] = useState(null);

  const name = draft?.name ?? user?.name ?? '';
  const username = draft?.username ?? user?.username ?? '';
  const email = draft?.email ?? user?.email ?? '';
  const role = draft?.role ?? user?.role ?? 'Social Media Specialist';
  const avatar = draft?.avatar ?? user?.avatar ?? AVATAR_PRESETS[0].url;

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [notifyPublish, setNotifyPublish] = useState(true);
  const [notifyEngage, setNotifyEngage] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  const [localBackendHealth, setLocalBackendHealth] = useState(null);
  const [localBackendStatus, setLocalBackendStatus] = useState('checking');
  const [checkingHealth, setCheckingHealth] = useState(false);

  const backendStatus = parentBackendStatus || localBackendStatus;
  const backendHealth = parentBackendHealth || localBackendHealth;

  const handleRecheckBackend = async () => {
    setCheckingHealth(true);
    try {
      if (onRefreshBackendHealth) {
        await onRefreshBackendHealth();
      } else {
        const data = await api.getHealth();
        if (data?.status === 'healthy') {
          setLocalBackendStatus('connected');
          setLocalBackendHealth(data);
        } else {
          setLocalBackendStatus('offline');
        }
      }
    } catch {
      setLocalBackendStatus('offline');
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    let active = true;
    api
      .getNotificationSettings()
      .then((prefs) => {
        if (active && prefs) {
          setNotifyPublish(Boolean(prefs.notify_publish));
          setNotifyEngage(Boolean(prefs.notify_engage));
          setNotifyEmail(Boolean(prefs.notify_email));
        }
      })
      .catch(() => {});

    api
      .getHealth()
      .then((data) => {
        if (!active) return;
        if (data?.status === 'healthy') {
          setLocalBackendStatus('connected');
          setLocalBackendHealth(data);
        } else {
          setLocalBackendStatus('offline');
        }
      })
      .catch(() => {
        if (active) setLocalBackendStatus('offline');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleNotificationToggle = async (key, value) => {
    const updated = {
      notify_publish: key === 'publish' ? value : notifyPublish,
      notify_engage: key === 'engage' ? value : notifyEngage,
      notify_email: key === 'email' ? value : notifyEmail
    };

    if (key === 'publish') setNotifyPublish(value);
    if (key === 'engage') setNotifyEngage(value);
    if (key === 'email') setNotifyEmail(value);

    setNotifSaving(true);
    try {
      await api.updateNotificationSettings(updated);
      setSuccessMessage('Notification preferences saved to your database profile.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update notification settings:', err);
    } finally {
      setNotifSaving(false);
    }
  };

  const validateInputs = () => {
    if (!name || name.trim().length < 2) {
      return 'Please enter a valid full name (at least 2 characters).';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return 'Please enter a valid email address (e.g., user@example.com).';
    }
    return null;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    const validationError = validateInputs();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const trimmedAvatar = avatar.trim();
    if (trimmedAvatar && !isSafeHttpUrl(trimmedAvatar)) {
      setErrorMessage('Avatar URL must use a valid http:// or https:// web address.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanUsername = username ? username.trim().replace(/^@/, '') : name.trim().toLowerCase().replace(/\s+/g, '_');
      const profilePayload = {
        name: name.trim(),
        username: cleanUsername,
        email: email.trim(),
        role: role.trim() || 'Member',
        avatar: trimmedAvatar || AVATAR_PRESETS[0].url
      };

      const result = await api.updateProfile(profilePayload);
      const savedUser = result.user || profilePayload;

      if (onUserUpdated) {
        onUserUpdated(savedUser);
      }
      setDraft(null);
      setSuccessMessage('Profile saved successfully across your workspace.');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err) {
      console.error('Error saving profile:', err);
      setErrorMessage(err?.message || 'Failed to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Clear cached browser session data and sign out cleanly?')) {
      await api.logout();
      window.location.reload();
    }
  };

  const sectionItems = [
    { id: 'all', label: 'All Settings', icon: Database },
    { id: 'mode', label: 'Operating Mode', icon: Sliders },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System Health', icon: Clock }
  ];

  const showMode = activeSection === 'all' || activeSection === 'mode';
  const showProfile = activeSection === 'all' || activeSection === 'profile';
  const showAppearance = activeSection === 'all' || activeSection === 'appearance';
  const showNotifications = activeSection === 'all' || activeSection === 'notifications';
  const showSystem = activeSection === 'all' || activeSection === 'system';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      <div className="ss-page-header">
        <div>
          <h2 className="ss-page-title">Workspace Settings</h2>
          <p className="ss-page-subtitle">
            Manage operating mode, creator identity, theme mode, notification rules, and Flask diagnostics.
          </p>
        </div>
        <span className={`badge ${appMode === 'demo' ? 'badge-primary' : 'badge-success'}`}>
          {appMode === 'demo' ? 'DEMO MODE' : 'LIVE SERVER MODE'}
        </span>
      </div>

      {errorMessage && (
        <div className="ss-alert ss-alert-danger" style={{ fontWeight: 600 }}>
          <AlertCircle size={17} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="ss-alert ss-alert-success" style={{ fontWeight: 600 }}>
          <Check size={17} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="ss-settings-grid">
        {/* Left Navigation Index */}
        <div className="clean-card" style={{ padding: '0.75rem', position: 'sticky', top: '94px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sectionItems.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.62rem 0.85rem',
                    borderRadius: '10px',
                    border: isActive ? '1px solid var(--lavender-border)' : '1px solid transparent',
                    background: isActive ? 'var(--gradient-brand-soft)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={15} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 0. Operating Mode Switch Section */}
          {showMode && (
            <div className="clean-card" style={{ padding: '1.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.15rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.3rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sliders size={19} color="var(--primary)" />
                    <span>Operating Mode</span>
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Switch between Dummy Demo Mode (default) and Live Server Mode immediately without restarting. Each mode keeps its own isolated SQLite data.
                  </p>
                </div>
                <span className={`badge ${appMode === 'demo' ? 'badge-primary' : 'badge-success'}`}>
                  {appMode === 'demo' ? 'Active: DEMO MODE' : 'Active: LIVE SERVER MODE'}
                </span>
              </div>

              {modeNotice && (
                <div
                  className={`ss-alert ${modeNotice.type === 'success' ? 'ss-alert-success' : 'ss-alert-danger'}`}
                  style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{modeNotice.text}</span>
                  {onDismissModeNotice && (
                    <button
                      type="button"
                      onClick={onDismissModeNotice}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.15rem' }}
                      aria-label="Dismiss"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </div>
              )}

              <div className="ss-grid-2" style={{ gap: '1rem' }}>
                <button
                  type="button"
                  disabled={modeSwitching}
                  onClick={() => onSwitchAppMode && onSwitchAppMode('demo')}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: appMode === 'demo' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: appMode === 'demo' ? 'var(--lavender)' : 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    cursor: modeSwitching ? 'wait' : 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: appMode === 'demo' ? 'var(--shadow-purple)' : 'none',
                    transition: 'all 0.16s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.94rem' }}>
                      <FlaskConical size={18} />
                      <span>Dummy Demo Mode</span>
                    </span>
                    <span className={`badge ${appMode === 'demo' ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {appMode === 'demo' ? 'Active (Default)' : 'Default'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Realistic SQLite demo workspace: connected Instagram, Facebook &amp; YouTube accounts, analytics charts, campaigns, calendar scheduling &amp; simulated "Demo Published" workflow.
                  </span>
                </button>

                <button
                  type="button"
                  disabled={modeSwitching}
                  onClick={() => onSwitchAppMode && onSwitchAppMode('live')}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: appMode === 'live' ? '2px solid var(--success)' : '1px solid var(--border-color)',
                    backgroundColor: appMode === 'live' ? 'var(--success-bg)' : 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    cursor: modeSwitching ? 'wait' : 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'all 0.16s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: appMode === 'live' ? 'var(--success)' : 'var(--text-primary)', fontWeight: 700, fontSize: '0.94rem' }}>
                      <Server size={18} />
                      <span>Live Server Mode</span>
                    </span>
                    <span className={`badge ${appMode === 'live' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {appMode === 'live' ? 'Active' : 'Flask + SQLite'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Connects directly to the Flask backend &amp; SQLite database without demo data. Features needing external APIs honestly show "OAuth Setup Required".
                  </span>
                </button>
              </div>

              {modeSwitching && (
                <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                  <RefreshCw size={14} />
                  <span>Switching operating mode and syncing workspace data...</span>
                </div>
              )}
            </div>
          )}

          {/* 1. Profile Section */}
          {showProfile && (
            <div className="clean-card" style={{ padding: '1.6rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={19} color="var(--primary)" />
                <span>Profile Information</span>
              </h3>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '1.25rem',
                    padding: '1.15rem',
                    backgroundColor: 'var(--bg-muted)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px'
                  }}
                >
                  <img
                    src={isSafeHttpUrl(avatar) ? avatar : AVATAR_PRESETS[0].url}
                    alt="Avatar Preview"
                    onError={(e) => {
                      e.target.src = AVATAR_PRESETS[0].url;
                    }}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '18px',
                      objectFit: 'cover',
                      border: '2.5px solid var(--primary)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  />
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{name || 'Your Name'}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.55rem' }}>
                      {username ? `@${username}` : '@username'} · {role || 'Team Member'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Avatars:</span>
                      {AVATAR_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => updateField('avatar', preset.url)}
                          style={{
                            border: avatar === preset.url ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            borderRadius: '999px',
                            padding: '2px 9px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: avatar === preset.url ? 'var(--lavender)' : 'var(--bg-surface)',
                            color: avatar === preset.url ? 'var(--primary)' : 'var(--text-secondary)'
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ss-grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={14} color="var(--primary)" />
                      <span>Full Name *</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AtSign size={14} color="var(--primary)" />
                      <span>Username</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => updateField('username', e.target.value.replace(/^@/, ''))}
                      placeholder="e.g. alexmorgan"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={14} color="var(--primary)" />
                      <span>Email Address *</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="e.g. you@example.com"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Briefcase size={14} color="var(--primary)" />
                      <span>Job Role / Title</span>
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => updateField('role', e.target.value)}
                      placeholder="e.g. Senior Social Strategist"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ImageIcon size={14} color="var(--primary)" />
                    <span>Profile Photo URL</span>
                  </label>
                  <input
                    type="url"
                    value={avatar}
                    onChange={(e) => updateField('avatar', e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="form-input"
                  />
                  <span className="form-helper">Provide any valid http/https image link or select a preset above.</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={isSaving} className="btn-primary">
                    {isSaving ? <RefreshCw size={15} /> : <Save size={15} />}
                    <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. Appearance Section */}
          {showAppearance && (
            <div className="clean-card" style={{ padding: '1.6rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isDark ? <Moon size={19} color="var(--primary)" /> : <Sun size={19} color="#F59E0B" />}
                <span>Appearance Theme</span>
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Switch between light studio surfaces and dark slate-indigo contrast.
              </p>

              <div className="ss-grid-2" style={{ gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsDark(false)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: !isDark ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    boxShadow: !isDark ? 'var(--shadow-purple)' : 'none',
                    transition: 'all 0.16s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Sun size={20} color="#F59E0B" />
                    {!isDark && <Check size={17} color="#635BFF" />}
                  </div>
                  <strong style={{ fontSize: '0.94rem' }}>Light Studio</strong>
                  <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Crisp slate ink on bright surfaces with soft indigo accents.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDark(true)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    border: isDark ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: '#0F172A',
                    color: '#F8FAFC',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    boxShadow: isDark ? 'var(--shadow-purple)' : 'none',
                    transition: 'all 0.16s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Moon size={20} color="#A78BFA" />
                    {isDark && <Check size={17} color="#A78BFA" />}
                  </div>
                  <strong style={{ fontSize: '0.94rem' }}>Midnight Dark</strong>
                  <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                    Deep obsidian slate tailored for low-light focus sessions.
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Notification Settings */}
          {showNotifications && (
            <div className="clean-card" style={{ padding: '1.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={19} color="var(--primary)" />
                  <span>Notification Rules</span>
                </h3>
                {notifSaving && <span className="badge badge-primary">Saving...</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  {
                    key: 'publish',
                    checked: notifyPublish,
                    title: 'Post Published Alerts',
                    desc: 'Receive notifications when scheduled content executes or completes.'
                  },
                  {
                    key: 'engage',
                    checked: notifyEngage,
                    title: 'Engagement Spike Alerts',
                    desc: 'Highlight unusually strong reach and interaction milestones.'
                  },
                  {
                    key: 'email',
                    checked: notifyEmail,
                    title: 'Daily Morning Digest',
                    desc: 'Receive a concise 8:00 AM summary of upcoming scheduled queues.'
                  }
                ].map((item, idx) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      cursor: 'pointer',
                      paddingBottom: idx < 2 ? '0.95rem' : 0,
                      borderBottom: idx < 2 ? '1px solid var(--border-light)' : 'none'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</div>
                      <div style={{ fontSize: '0.79rem', color: 'var(--text-secondary)' }}>{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => handleNotificationToggle(item.key, e.target.checked)}
                      style={{ width: '19px', height: '19px', accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 4. Backend Health & Session */}
          {showSystem && (
            <div className="clean-card" style={{ padding: '1.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.15rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={19} color="var(--primary)" />
                    <span>Backend Health &amp; Background Scheduler</span>
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Live diagnostics for the Python Flask backend, SQLite persistence, and automated publishing worker.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRecheckBackend}
                  disabled={checkingHealth}
                  className="btn-secondary btn-sm"
                >
                  <RefreshCw size={13} />
                  <span>{checkingHealth ? 'Checking...' : 'Re-check Backend'}</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-color)',
                  padding: '1.15rem',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.95rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Flask API &amp; SQLite Database</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Endpoint: {`${API_BASE}/health`}</div>
                  </div>

                  {backendStatus === 'connected' ? (
                    <span className="badge badge-success" style={{ padding: '0.35rem 0.8rem' }}>
                      <Check size={14} />
                      <span>Healthy &amp; Connected</span>
                    </span>
                  ) : backendStatus === 'checking' || checkingHealth ? (
                    <span className="badge badge-neutral">Checking...</span>
                  ) : (
                    <span className="badge badge-danger" style={{ padding: '0.35rem 0.8rem' }}>
                      <AlertCircle size={14} />
                      <span>Backend Offline</span>
                    </span>
                  )}
                </div>

                {backendHealth && (
                  <div className="ss-grid-3" style={{ paddingTop: '0.8rem', borderTop: '1px solid var(--border-light)', fontSize: '0.8rem', gap: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>API Version</span>
                      <strong>{backendHealth.version}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Storage Engine</span>
                      <strong>{backendHealth.database}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Post Scheduler</span>
                      <strong style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        Active Background Daemon
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1.1rem',
                  borderTop: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Session Sign-Out</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Clear cached browser session data and revoke your local token safely.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="btn-secondary btn-sm"
                  style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}
                >
                  <LogOut size={14} />
                  <span>Clear Session &amp; Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
