import React, { useEffect } from 'react';
import logoWhite from '../assets/logo-white.png';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Splash({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2400);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      onClick={onFinish}
      style={{
        height: '100vh',
        width: '100vw',
        background: 'radial-gradient(circle at 20% 20%, #4F46E5 0%, #1E1B4B 48%, #090D16 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        padding: '2rem',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}
    >
      {/* Subtle Ambient Glow Orbs */}
      <div
        style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%)',
          top: '-120px',
          right: '-80px',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '360px',
          height: '360px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 91, 255, 0.25) 0%, transparent 70%)',
          bottom: '-100px',
          left: '-80px',
          pointerEvents: 'none'
        }}
      />

      <div
        className="animate-fade-in"
        style={{
          maxWidth: '460px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.32rem 0.8rem',
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            fontSize: '0.74rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#E0E7FF',
            marginBottom: '1.5rem'
          }}
        >
          <Sparkles size={13} />
          <span>Social Media Command Center</span>
        </div>

        {/* Brand Emblem */}
        <div
          style={{
            width: '92px',
            height: '92px',
            borderRadius: '26px',
            background: 'linear-gradient(135deg, #635BFF 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 22px 45px rgba(99, 91, 255, 0.45), 0 0 0 8px rgba(255, 255, 255, 0.08)',
            marginBottom: '1.65rem'
          }}
        >
          <img src={logoWhite} alt="SocialSync Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.85rem',
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.04em',
            color: '#FFFFFF',
            lineHeight: 1.05
          }}
        >
          SocialSync
        </h1>

        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '1.02rem',
            color: '#C7D2FE',
            lineHeight: 1.55,
            maxWidth: '380px'
          }}
        >
          Plan campaigns, schedule content, and publish natively across your connected channels.
        </p>

        {/* Loading Bar */}
        <div
          style={{
            width: '180px',
            height: '4px',
            borderRadius: '99px',
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            overflow: 'hidden',
            marginTop: '2rem',
            marginBottom: '1.35rem'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #818CF8 0%, #C084FC 100%)',
              transformOrigin: 'left',
              animation: 'fadeIn 1.4s ease-out forwards'
            }}
          />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFinish();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            padding: '0.5rem 1.05rem',
            borderRadius: '999px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <span>Enter Workspace</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
