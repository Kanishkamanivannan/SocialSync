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
      style={{
        height: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #6C5CE7 0%, #8E44AD 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        position: 'relative',
        cursor: 'pointer',
        padding: '2rem',
        textAlign: 'center'
      }} 
      onClick={onFinish}
    >
      <div style={{ maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="animate-fade-in">
        {/* Logo Container */}
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.75rem',
          padding: '0.75rem',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.2)'
        }}>
          <img 
            src={logoWhite} 
            alt="SocialSync Logo" 
            style={{ width: '75px', height: '75px', objectFit: 'contain' }}
          />
        </div>

        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          color: '#FFFFFF',
          marginBottom: '0.4rem',
          letterSpacing: '-0.02em'
        }}>
          SocialSync
        </h1>

        <div style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.9)',
          marginBottom: '2rem'
        }}>
          Manage • Create • Grow
        </div>

        {/* Progress Line */}
        <div style={{
          width: '180px',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '1.25rem'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: '#FFFFFF',
            animation: 'splashLoad 2.2s ease-in-out forwards'
          }} />
        </div>

        <p style={{
          fontSize: '0.82rem',
          color: 'rgba(255, 255, 255, 0.75)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          Click anywhere or wait to enter <ArrowRight size={14} />
        </p>
      </div>

      <style>{`
        @keyframes splashLoad {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
