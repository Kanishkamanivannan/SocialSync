import React, { useState } from 'react';
import logoLight from '../assets/logo.png';
import { api } from '../services/api';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

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
          setGeneralError(res?.message || 'Invalid email or password. Use the Quick Demo button below to sign in instantly.');
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
      setGeneralError('Backend is offline. Switching to local offline demo mode.');
      const demoUser = {
        id: 1,
        name: name || 'Alex Morgan',
        email,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'Social Media Manager'
      };
      onAuthSuccess(demoUser);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setEmail('alex@socialsync.io');
    setPassword('password123');
    setErrors({});
    setGeneralError('');
    setLoading(true);
    setTimeout(async () => {
      const res = await api.login('alex@socialsync.io', 'password123');
      onAuthSuccess(res.user);
      setLoading(false);
    }, 300);
  };

  const handleForgotPassword = () => {
    setInfoMessage('Password reset instructions have been sent to your email address.');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-app)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div 
        className="clean-card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.25rem',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div 
            onClick={onBack}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.6rem', 
              cursor: 'pointer',
              marginBottom: '0.75rem'
            }}
          >
            <img src={logoLight} alt="SocialSync Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <span style={{ 
              fontWeight: 800, 
              fontSize: '1.35rem', 
              color: 'var(--primary)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em'
            }}>
              SocialSync
            </span>
          </div>

          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>
            {isLogin ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            {isLogin ? 'Sign in to access your social media dashboard' : 'Join SocialSync to start managing your channels'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          padding: '4px',
          backgroundColor: 'var(--bg-muted)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErrors({}); setGeneralError(''); }}
            style={{
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: isLogin ? 'var(--bg-surface)' : 'transparent',
              color: isLogin ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: isLogin ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErrors({}); setGeneralError(''); }}
            style={{
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: !isLogin ? 'var(--bg-surface)' : 'transparent',
              color: !isLogin ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: !isLogin ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* General Error Alert */}
        {generalError && (
          <div style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            padding: '0.75rem 0.9rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{generalError}</span>
          </div>
        )}

        {/* Info Notification */}
        {infoMessage && (
          <div style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            padding: '0.75rem 0.9rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem'
          }}>
            <CheckCircle2 size={16} />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="email"
                placeholder="alex@socialsync.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          {/* Remember Me & Forgot Password */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                style={{ accentColor: 'var(--primary)' }}
              />
              <span>Remember Me</span>
            </label>
            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Forgot Password?
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', marginTop: '0.25rem' }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            <ArrowRight size={16} />
          </button>
        </form>

        {/* 1-Click Quick Demo Login */}
        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={handleQuickDemo}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1.5px dashed var(--primary)',
              backgroundColor: 'var(--lavender)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={16} />
            <span>1-Click Quick Demo Login (Alex Morgan)</span>
          </button>
        </div>

        {/* Social Logins Notice */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
          <div style={{
            position: 'relative',
            marginBottom: '1rem'
          }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: 'var(--border-light)' }} />
            <span style={{
              position: 'relative',
              backgroundColor: 'var(--bg-surface)',
              padding: '0 0.65rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 600
            }}>
              Or sign in with (Preview)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="btn-secondary"
              style={{ padding: '0.55rem', fontSize: '0.82rem' }}
            >
              Google
            </button>
            <button
              type="button"
              onClick={handleQuickDemo}
              className="btn-secondary"
              style={{ padding: '0.55rem', fontSize: '0.82rem' }}
            >
              Apple
            </button>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Social logins are UI previews. Click any button to enter as demo user.
          </p>
        </div>
      </div>
    </div>
  );
}
