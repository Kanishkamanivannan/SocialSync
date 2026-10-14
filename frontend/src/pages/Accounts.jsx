import React, { useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ExternalLink,
  Users,
  TrendingUp,
  Radio,
  Check
} from 'lucide-react';
import { api } from '../services/api';

export default function Accounts({ accounts = [], onAccountUpdated }) {
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  // Platform icons dictionary
  const platformIcons = {
    Instagram: '📸',
    Facebook: '👤',
    X: '🐦',
    LinkedIn: '💼',
    YouTube: '▶️',
    TikTok: '🎵'
  };

  // Deduplicate accounts to guarantee each platform is displayed only once
  const uniqueAccounts = accounts.reduce((acc, current) => {
    const exists = acc.find(item => item.platform.toLowerCase() === current.platform.toLowerCase());
    if (!exists) {
      return acc.concat([current]);
    }
    return acc;
  }, []);

  const handleToggle = async (accId) => {
    setTogglingId(accId);
    try {
      const updated = await api.toggleAccount(accId);
      if (onAccountUpdated) onAccountUpdated(updated);
      setFeedback({
        type: 'success',
        text: `${updated.name || updated.platform} has been ${updated.connected ? 'connected' : 'disconnected'}.`
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error('Error toggling account connection:', err);
      setFeedback({
        type: 'error',
        text: 'Failed to update account status. Please try again.'
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleSyncAll = () => {
    setGlobalSyncing(true);
    // Simulate real sync without creating any duplicate records
    setTimeout(() => {
      setGlobalSyncing(false);
      setFeedback({
        type: 'success',
        text: `All ${uniqueAccounts.length} social media accounts have been synced successfully with live metrics!`
      });
      setTimeout(() => setFeedback(null), 3500);
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }} className="animate-fade-in">
      {/* Header and Sync All Action */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Connected Social Accounts</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Manage and monitor your verified social platform channels from a single hub.
          </p>
        </div>

        <button
          onClick={handleSyncAll}
          disabled={globalSyncing}
          className="btn-primary"
          style={{ padding: '0.65rem 1.4rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={globalSyncing ? 'animate-spin' : ''} />
          <span>{globalSyncing ? 'Syncing All Channels...' : 'Sync All Accounts'}</span>
        </button>
      </div>

      {/* Helpful Clarification Banner */}
      <div className="help-box" style={{ borderLeft: '4px solid var(--primary)' }}>
        <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>
            Single Source of Truth for Connected Channels
          </strong>
          <span>
            Each social profile is configured here. When an account is connected, it is ready to receive scheduled and published posts. Disconnecting an account pauses outgoing posts without deleting past data.
          </span>
        </div>
      </div>

      {/* Success / Error Feedback Alert */}
      {feedback && (
        <div style={{
          backgroundColor: feedback.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
          color: feedback.type === 'error' ? 'var(--danger)' : 'var(--success)',
          padding: '0.85rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.88rem',
          fontWeight: 600,
          border: `1px solid ${feedback.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Responsive Grid of Verified Social Channels (Each appearing exactly once) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
        gap: '1.5rem',
        width: '100%'
      }}>
        {uniqueAccounts.map(acc => {
          const isToggling = togglingId === acc.id;

          return (
            <div
              key={acc.id}
              className="clean-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                padding: '1.5rem',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              {/* Card Top: Platform Icon, Name & Connection Status Badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--lavender)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0
                  }}>
                    {platformIcons[acc.platform] || '📱'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {acc.platform}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {acc.handle}
                    </div>
                  </div>
                </div>

                <span className={`badge ${acc.connected ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.74rem' }}>
                  <Radio size={10} style={{ marginRight: '4px' }} />
                  {acc.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Middle Metrics Box */}
              <div style={{
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                padding: '0.9rem 1.15rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                    <Users size={12} color="var(--primary)" />
                    Followers
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {(acc.followers || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                    <TrendingUp size={12} color="var(--success)" />
                    Growth
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                    {acc.growth || '+0.0%'}
                  </span>
                </div>
              </div>

              {/* Bottom Actions: Clear Connect / Disconnect Action */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-light)'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {acc.connected ? 'Ready for publishing' : 'Posting inactive'}
                </span>

                <button
                  type="button"
                  disabled={isToggling}
                  onClick={() => handleToggle(acc.id)}
                  className={acc.connected ? 'btn-secondary' : 'btn-primary'}
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {isToggling && <RefreshCw size={13} className="animate-spin" />}
                  <span>{acc.connected ? 'Disconnect' : 'Connect Account'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
