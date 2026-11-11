import React from 'react';
import logoWhite from '../assets/logo-white.png';
import onboardingHero from '../assets/onboarding-hero.png';
import {
  ArrowRight,
  Layers,
  Calendar,
  BarChart2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';

export default function Onboarding({ onGetStarted, onLogin }) {
  const pillars = [
    {
      icon: Layers,
      accent: 'linear-gradient(135deg, #635BFF 0%, #8B5CF6 100%)',
      title: 'Unified Publishing Studio',
      desc: 'Craft tailored copy, attach media, preview platform cards live, and publish or schedule to Instagram, Facebook Pages, and YouTube.'
    },
    {
      icon: Calendar,
      accent: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
      title: 'Visual Content Calendar',
      desc: 'Map every campaign date clearly, monitor automated publishing queues, and track live API vs sandbox deliveries without clutter.'
    },
    {
      icon: BarChart2,
      accent: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
      title: 'Real Channel Insights',
      desc: 'Review verified channel statistics alongside clearly separated historical sandbox visualizations and CSV campaign exports.'
    }
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        backgroundImage:
          'radial-gradient(at 15% 5%, rgba(99, 91, 255, 0.1) 0px, transparent 50%), radial-gradient(at 85% 15%, rgba(139, 92, 246, 0.08) 0px, transparent 48%)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0.9rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-purple)'
              }}
            >
              <img src={logoWhite} alt="SocialSync Logo" style={{ width: '21px', height: '21px', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                SocialSync
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Creator &amp; Campaign Suite
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button onClick={onLogin} className="btn-secondary btn-sm">
              Sign In
            </button>
            <button onClick={onGetStarted} className="btn-primary btn-sm">
              <span>Get Started</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero + Features */}
      <main style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '3.25rem 1.5rem 2.5rem' }}>
        <div
          className="ss-grid-2 animate-fade-in"
          style={{ alignItems: 'center', gap: '2.5rem', marginBottom: '3.5rem' }}
        >
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '1.15rem', padding: '0.35rem 0.78rem' }}>
              <Sparkles size={13} />
              <span>Official Meta &amp; YouTube API Ready</span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.1rem, 4vw, 3.15rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.035em',
                marginBottom: '1.15rem'
              }}
            >
              Orchestrate Your{' '}
              <span
                style={{
                  background: 'var(--gradient-brand)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Social Presence
              </span>{' '}
              Without the Chaos
            </h1>

            <p style={{ fontSize: '1.02rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: '520px', marginBottom: '1.75rem' }}>
              Draft multi-network posts, schedule launches on an intuitive visual calendar, and separate safe Sandbox testing from encrypted OAuth 2.0 publishing.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
              <button onClick={onGetStarted} className="btn-primary" style={{ padding: '0.78rem 1.45rem', fontSize: '0.94rem' }}>
                <span>Launch Workspace</span>
                <ArrowRight size={17} />
              </button>
              <button onClick={onLogin} className="btn-secondary" style={{ padding: '0.78rem 1.35rem', fontSize: '0.94rem' }}>
                <span>Sign In to Account</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={15} color="var(--success)" />
                <span>Encrypted OAuth 2.0 Tokens</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={15} color="var(--primary)" />
                <span>Isolated Sandbox &amp; Live Modes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={15} color="var(--warning)" />
                <span>Background Auto-Scheduler</span>
              </div>
            </div>
          </div>

          {/* Showcase Preview Frame */}
          <div
            className="clean-card"
            style={{
              padding: '0.85rem',
              background: 'linear-gradient(145deg, rgba(99, 91, 255, 0.1) 0%, var(--bg-surface) 45%, rgba(139, 92, 246, 0.08) 100%)',
              borderRadius: '22px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 0.85rem',
                  borderBottom: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-muted)'
                }}
              >
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#F87171' }} />
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#FBBF24' }} />
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#34D399' }} />
                <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  SocialSync Studio Preview
                </span>
              </div>
              <img
                src={onboardingHero}
                alt="SocialSync Dashboard Preview"
                style={{ width: '100%', display: 'block', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>

        {/* 3 Feature Pillars */}
        <div className="ss-grid-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="clean-card ss-card-interactive" style={{ padding: '1.5rem' }}>
                <div
                  className="ss-icon-badge"
                  style={{
                    background: pillar.accent,
                    color: '#FFFFFF',
                    marginBottom: '1rem',
                    boxShadow: '0 6px 16px rgba(99, 91, 255, 0.22)'
                  }}
                >
                  <Icon size={20} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.45rem' }}>
                  {pillar.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {pillar.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '1.1rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}
      >
        SocialSync • Unified Multi-Channel Social Media Management Platform
      </footer>
    </div>
  );
}
