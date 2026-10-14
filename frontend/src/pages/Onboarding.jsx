import React from 'react';
import logoLight from '../assets/logo.png';
import onboardingHero from '../assets/onboarding-hero.png';
import { ArrowRight, Layers, Calendar, BarChart2, CheckCircle2 } from 'lucide-react';

export default function Onboarding({ onGetStarted, onLogin }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-app)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '2rem 1.5rem',
      color: 'var(--text-primary)'
    }}>
      {/* Top Header */}
      <header style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={logoLight} alt="SocialSync Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
          <div>
            <div style={{ 
              fontWeight: 800, 
              fontSize: '1.35rem', 
              color: 'var(--primary)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em'
            }}>
              SocialSync
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button 
            onClick={onLogin}
            className="btn-secondary"
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
          >
            Sign In
          </button>
          <button 
            onClick={onGetStarted}
            className="btn-primary"
            style={{ padding: '0.55rem 1.35rem', fontSize: '0.88rem' }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '3rem auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '3rem',
        alignItems: 'center'
      }}>
        {/* Left Column: Clear Text & Call to Action */}
        <div className="animate-fade-in">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--lavender)',
            color: 'var(--primary)',
            padding: '0.4rem 0.9rem',
            borderRadius: 'var(--radius-full)',
            fontWeight: 700,
            fontSize: '0.8rem',
            marginBottom: '1.25rem'
          }}>
            <span>EASY SOCIAL MEDIA MANAGEMENT</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
            lineHeight: 1.15,
            marginBottom: '1.25rem',
            color: 'var(--text-primary)'
          }}>
            Simplify Your <br />
            <span style={{ color: 'var(--primary)' }}>Social Media</span> <br />
            Management
          </h1>

          <p style={{
            fontSize: '1.05rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            lineHeight: 1.6,
            maxWidth: '500px'
          }}>
            Manage Instagram, TikTok, Facebook, X, LinkedIn, and YouTube in one single place. Create posts once, schedule them for the best times, and grow your audience with ease.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '2rem' }}>
            <button 
              onClick={onGetStarted}
              className="btn-primary"
              style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}
            >
              <span>Get Started</span>
              <ArrowRight size={17} />
            </button>
            <button 
              onClick={onLogin}
              className="btn-secondary"
              style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
            >
              <span>Sign In with Demo</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={17} color="var(--success)" />
              <span>Free to get started — no credit card needed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={17} color="var(--success)" />
              <span>Easy 3-step post creator with live preview</span>
            </div>
          </div>
        </div>

        {/* Right Column: Existing Hero Image */}
        <div style={{ display: 'flex', justifyContent: 'center' }} className="animate-fade-in">
          <div style={{
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-surface)',
            maxWidth: '520px',
            width: '100%'
          }}>
            <img 
              src={onboardingHero} 
              alt="SocialSync Dashboard Preview" 
              style={{ width: '100%', height: 'auto', display: 'block' }} 
            />
          </div>
        </div>
      </main>

      {/* 3 Core Benefits Pillars */}
      <footer style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        paddingTop: '2rem',
        borderTop: '1px solid var(--border-light)'
      }}>
        {/* Benefit 1 */}
        <div className="clean-card">
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--lavender)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.85rem'
          }}>
            <Layers size={22} />
          </div>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>1. Unified Publishing</h3>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>
            Write your message once and publish directly to Instagram, Facebook, X, and LinkedIn without having to switch between apps.
          </p>
        </div>

        {/* Benefit 2 */}
        <div className="clean-card">
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.85rem'
          }}>
            <Calendar size={22} />
          </div>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>2. Smart Scheduling</h3>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>
            Choose the exact date and time you want your content to go live. SocialSync publishes automatically so your accounts stay active.
          </p>
        </div>

        {/* Benefit 3 */}
        <div className="clean-card">
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--lavender)',
            color: 'var(--secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.85rem'
          }}>
            <BarChart2 size={22} />
          </div>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>3. Unified Analytics</h3>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>
            Understand how your posts are doing. Check follower growth and total views in simple charts without complicated numbers.
          </p>
        </div>
      </footer>
    </div>
  );
}
