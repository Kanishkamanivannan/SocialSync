import React, { useState } from 'react';
import logoWhite from '../assets/logo-white.png';
import { api } from '../services/api';
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  Share2
} from 'lucide-react';

const DEMO_EMAIL = import.meta.env.DEV ? (import.meta.env.VITE_DEMO_EMAIL || '') : '';
const DEMO_PASSWORD = import.meta.env.DEV ? (import.meta.env.VITE_DEMO_PASSWORD || '') : '';
const DEMO_LOGIN_ENABLED = import.meta.env.DEV && Boolean(DEMO_EMAIL && DEMO_PASSWORD);

export default function Auth({ onAuthSuccess, initialMode = 'login', onBack }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!email) {
      newErrors.email = 'Please enter your email address.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address (example: name@domain.com).';
    }

    if (!password) {
      newErrors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!isLogin && !name.trim()) {
      newErrors.name = 'Please enter your full name.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setInfoMessage('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        const res = await api.login(email, password);
        if (res && res.success) {
          onAuthSuccess(res.user);
        } else {
          setGeneralError(res?.message || 'Invalid email or password.');
        }
      } else {
        const res = await api.register(name, email, password);
        if (res && res.success) {
          onAuthSuccess(res.user);
        } else {
          setGeneralError(res?.message || 'Could not create account with this email.');
        }
      }
    } catch (err) {
      setGeneralError(err?.message || 'Unable to reach SocialSync backend server. Start the Flask backend and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    if (!DEMO_LOGIN_ENABLED) return;
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    setGeneralError('');
    setLoading(true);
    setTimeout(async () => {
      try {
        const res = await api.login(DEMO_EMAIL, DEMO_PASSWORD);
        if (res && res.success) {
          onAuthSuccess(res.user);
        } else {
          setGeneralError(res?.message || 'Demo login failed.');
        }
      } catch (err) {
        setGeneralError(err?.message || 'Unable to reach SocialSync backend server.');
      } finally {
        setLoading(false);
      }
    }, 200);
  };

  const handleForgotPassword = () => {
    setInfoMessage('Password reset instructions have been sent to your email address.');
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setErrors({});
    setGeneralError('');
    setInfoMessage('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        backgroundImage:
          'radial-gradient(at 10% 10%, rgba(99, 91, 255, 0.12) 0px, transparent 48%), radial-gradient(at 90% 85%, rgba(139, 92, 246, 0.1) 0px, transparent 50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div
        className="clean-card ss-grid-2 animate-fade-in"
        style={{
          maxWidth: '980px',
          width: '100%',
          overflow: 'hidden',
          padding: 0,
          gap: 0,
          borderRadius: '22px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Left Visual Identity Panel */}
        <div
          style={{
            background: 'linear-gradient(155deg, #1E1B4B 0%, #3730A3 52%, #6D28D9 100%)',
            color: '#FFFFFF',
            padding: '2.5rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '260px',
              height: '260px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(167, 139, 250, 0.35) 0%, transparent 70%)',
              bottom: '-80px',
              right: '-60px',
              pointerEvents: 'none'
            }}
          />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '2rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '11px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img src={logoWhite} alt="SocialSync" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                SocialSync
              </span>
            </div>

            <h2 style={{ color: '#FFFFFF', fontSize: '1.85rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.9rem' }}>
              Publish Smarter Across Every Channel
            </h2>
            <p style={{ color: '#C7D2FE', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Connect Instagram, Facebook Pages, and YouTube with encrypted token storage and safe sandbox workflows.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              {[
                { icon: Share2, title: 'Multi-Channel Publishing', sub: 'Native posts, reels & videos from one composer' },
                { icon: CalendarDays, title: 'Precision Scheduling', sub: 'Automated background queue & live status tracking' },
                { icon: ShieldCheck, title: 'AES-256-GCM Security', sub: 'Server-side encrypted OAuth token management' }
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div key={feat.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        backgroundColor: 'rgba(255, 255, 255, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={16} color="#E0E7FF" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>{feat.title}</div>
                      <div style={{ fontSize: '0.77rem', color: '#C7D2FE' }}>{feat.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: '2.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.14)',
              fontSize: '0.76rem',
              color: '#C7D2FE',
              position: 'relative',
              zIndex: 2
            }}
          >
            Sandbox &amp; Official Live API modes stay completely separated.
          </div>
        </div>

        {/* Right Form Panel */}
        <div style={{ padding: '2.25rem 2.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.35rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="btn-secondary btn-sm"
                style={{ borderRadius: '999px' }}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}

            <div className="ss-tab-group">
              <button
                type="button"
                className={`ss-tab ${isLogin ? 'active' : ''}`}
                onClick={() => switchMode(true)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`ss-tab ${!isLogin ? 'active' : ''}`}
                onClick={() => switchMode(false)}
              >
                Create Account
              </button>
            </div>
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.3rem' }}>
            {isLogin ? 'Welcome back' : 'Create your workspace'}
          </h1>
          <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', margin: '0 0 1.4rem 0' }}>
            {isLogin
              ? 'Sign in to access your scheduler, campaigns, and connected accounts.'
              : 'Set up your SocialSync account in seconds.'}
          </p>

          {generalError && (
            <div className="ss-alert ss-alert-danger" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{generalError}</span>
            </div>
          )}

          {infoMessage && (
            <div className="ss-alert ss-alert-success" style={{ marginBottom: '1rem' }}>
              <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="auth-name"
                    type="text"
                    className="form-input"
                    placeholder="Alex Rivera"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ paddingLeft: '2.35rem' }}
                  />
                </div>
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="auth-email"
                  type="email"
                  className="form-input"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.35rem' }}
                />
              </div>
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="auth-password">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '2.35rem', paddingRight: '2.45rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            {isLogin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Keep me signed in on this browser</span>
              </label>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.76rem 1.25rem', marginTop: '0.25rem' }}>
              <span>{loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Workspace'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {DEMO_LOGIN_ENABLED && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--gradient-brand-soft)',
                border: '1px solid var(--lavender-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <Sparkles size={16} color="var(--primary)" />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Dev Quick Access</strong> available
                </div>
              </div>
              <button type="button" onClick={handleQuickDemo} disabled={loading} className="btn-outline btn-sm">
                Demo Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
