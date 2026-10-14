import React, { useState, useEffect } from 'react';
import { 
  User, 
  Moon, 
  Sun, 
  Bell, 
  ShieldCheck, 
  Database, 
  Check, 
  AlertCircle,
  AtSign,
  Mail,
  Briefcase,
  Image as ImageIcon,
  Save,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

const AVATAR_PRESETS = [
  { label: 'Default', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { label: 'Corporate', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { label: 'Creative', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { label: 'Modern', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80' }
];

export default function Settings({ user, onUserUpdated, isDark, setIsDark }) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'Social Media Specialist');
  const [avatar, setAvatar] = useState(user?.avatar || AVATAR_PRESETS[0].url);

  // Sync state if user prop changes externally
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.username) setUsername(user.username);
      if (user.email) setEmail(user.email);
      if (user.role) setRole(user.role);
      if (user.avatar) setAvatar(user.avatar);
    }
  }, [user]);

  // Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Notification toggles
  const [notifyPublish, setNotifyPublish] = useState(true);
  const [notifyEngage, setNotifyEngage] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);

  // Diagnostics state
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected' | 'error' | 'checking'

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      })
      .catch(() => setBackendStatus('error'));
  }, []);

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

    setIsSaving(true);
    try {
      const cleanUsername = username ? username.trim().replace(/^@/, '') : name.trim().toLowerCase().replace(/\s+/g, '_');
      const profilePayload = {
        name: name.trim(),
        username: cleanUsername,
        email: email.trim(),
        role: role.trim() || 'Member',
        avatar: avatar.trim() || AVATAR_PRESETS[0].url
      };

      const result = await api.updateProfile(profilePayload);
      const savedUser = result.user || profilePayload;

      // Propagate immediately across top-level shared state
      if (onUserUpdated) {
        onUserUpdated(savedUser);
      }

      setSuccessMessage('Profile saved successfully! Changes are updated across the dashboard and navigation.');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err) {
      console.error('Error saving profile:', err);
      setErrorMessage('Failed to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo posts and accounts back to factory defaults?')) {
      localStorage.removeItem('socialsync_initialized');
      localStorage.removeItem('socialsync_user');
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '880px', width: '100%' }} className="animate-fade-in">
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Application Settings</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
          Manage your personal profile, notification alerts, theme appearance, and connection health.
        </p>
      </div>

      {/* Validation or Error Message */}
      {errorMessage && (
        <div style={{
          backgroundColor: 'var(--danger-bg)',
          color: 'var(--danger)',
          padding: '0.85rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontWeight: 600,
          fontSize: '0.88rem',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Feedback Message */}
      {successMessage && (
        <div style={{
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success)',
          padding: '0.85rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontWeight: 600,
          fontSize: '0.88rem',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <Check size={18} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* SECTION 1: Profile Information */}
      <div className="clean-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <User size={20} color="var(--primary)" />
          <span>1. Profile Information</span>
        </h3>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Avatar Preview & Quick Presets */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '1.25rem',
            backgroundColor: 'var(--bg-muted)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <img 
              src={avatar || AVATAR_PRESETS[0].url} 
              alt="Avatar Preview" 
              onError={(e) => { e.target.src = AVATAR_PRESETS[0].url; }}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--primary)',
                boxShadow: 'var(--shadow-sm)'
              }}
            />
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                {name || 'Your Name'}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                {username ? `@${username}` : '@username'} • {role || 'Team Member'}
              </div>

              {/* Avatar quick presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Avatars:</span>
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(preset.url)}
                    style={{
                      border: avatar === preset.url ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 8px',
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

          {/* Form Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={14} color="var(--primary)" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Taylor Swift"
                className="form-input"
                required
              />
              <span className="form-helper">This name is shown in the dashboard greeting and navigation.</span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AtSign size={14} color="var(--primary)" />
                <span>Username</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                placeholder="e.g. taylorswift"
                className="form-input"
              />
              <span className="form-helper">Unique handle used for mention tags and system identity.</span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={14} color="var(--primary)" />
                <span>Email Address *</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. taylor@socialsync.io"
                className="form-input"
                required
              />
              <span className="form-helper">Used for account notifications and digest emails.</span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Briefcase size={14} color="var(--primary)" />
                <span>Job Role / Title</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Social Strategist"
                className="form-input"
              />
              <span className="form-helper">Your title displayed in your user card.</span>
            </div>
          </div>

          {/* Profile Photo URL Field */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ImageIcon size={14} color="var(--primary)" />
              <span>Profile Photo URL</span>
            </label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="form-input"
            />
            <span className="form-helper">Provide any direct image link or pick from the presets above.</span>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
              style={{
                padding: '0.65rem 1.6rem',
                fontSize: '0.92rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isSaving ? 'Saving Profile...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Appearance & Theme */}
      <div className="clean-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          {isDark ? <Moon size={20} color="var(--primary)" /> : <Sun size={20} color="#F59E0B" />}
          <span>2. Appearance (Light / Dark Theme)</span>
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Select the interface color mode that is most comfortable for your workflow.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {/* Light Theme Card */}
          <button
            type="button"
            onClick={() => setIsDark(false)}
            style={{
              padding: '1.35rem',
              borderRadius: 'var(--radius-lg)',
              border: !isDark ? '2px solid var(--primary)' : '1px solid var(--border-light)',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: !isDark ? 'var(--shadow-purple)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Sun size={22} color="#F59E0B" />
              {!isDark && <Check size={18} color="var(--primary)" />}
            </div>
            <strong style={{ fontSize: '0.96rem' }}>Light Theme</strong>
            <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Clean white cards with soft purple highlights and maximum clarity</span>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            onClick={() => setIsDark(true)}
            style={{
              padding: '1.35rem',
              borderRadius: 'var(--radius-lg)',
              border: isDark ? '2px solid var(--primary)' : '1px solid var(--border-light)',
              backgroundColor: '#1E293B',
              color: '#F8FAFC',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: isDark ? 'var(--shadow-purple)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Moon size={22} color="#A29BFE" />
              {isDark && <Check size={18} color="#A29BFE" />}
            </div>
            <strong style={{ fontSize: '0.96rem' }}>Dark Theme</strong>
            <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Deep navy background engineered for low-light environments</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: Notifications */}
      <div className="clean-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Bell size={20} color="var(--primary)" />
          <span>3. Notifications & Activity Alerts</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Post Published Alerts</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Get notified immediately when scheduled content successfully goes live.</div>
            </div>
            <input 
              type="checkbox" 
              checked={notifyPublish} 
              onChange={(e) => setNotifyPublish(e.target.checked)} 
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Engagement Spike Alerts</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive a notification when a post receives higher-than-average viral interaction.</div>
            </div>
            <input 
              type="checkbox" 
              checked={notifyEngage} 
              onChange={(e) => setNotifyEngage(e.target.checked)} 
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Daily Morning Digest Email</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive a summary email at 8:00 AM detailing upcoming scheduled posts.</div>
            </div>
            <input 
              type="checkbox" 
              checked={notifyEmail} 
              onChange={(e) => setNotifyEmail(e.target.checked)} 
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>

      {/* SECTION 4: Backend Connection Status */}
      <div className="clean-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Database size={20} color="var(--primary)" />
          <span>4. Backend Health & Data Persistence</span>
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          SocialSync checks the health of the Python Flask backend server and SQLite database.
        </p>

        <div style={{
          backgroundColor: 'var(--bg-muted)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Python Flask API Server</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Endpoint: http://127.0.0.1:5000/api/health</div>
          </div>

          {backendStatus === 'connected' ? (
            <span className="badge badge-success" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}>
              <Check size={14} />
              <span>Connected & Persisting to SQLite</span>
            </span>
          ) : backendStatus === 'checking' ? (
            <span className="badge badge-neutral" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}>Checking...</span>
          ) : (
            <span className="badge badge-danger" style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}>
              <AlertCircle size={14} />
              <span>Offline (Using LocalStorage Fallback)</span>
            </span>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reset Demo Data</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Restore default sample posts, accounts, and campaigns.</div>
          </div>
          <button
            onClick={handleResetData}
            style={{
              backgroundColor: 'var(--danger-bg)',
              border: 'none',
              color: 'var(--danger)',
              padding: '0.55rem 1.15rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer'
            }}
          >
            Reset Demo Data to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
