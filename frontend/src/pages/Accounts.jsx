import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  Users,
  TrendingUp,
  Radio,
  Activity,
  Unlink,
  ShieldCheck,
  ShieldAlert,
  FlaskConical,
  KeyRound,
  X as CloseIcon
} from 'lucide-react';
import { api, isSafeHttpUrl } from '../services/api';

const OFFICIAL_PLATFORMS = ['Instagram', 'Facebook', 'YouTube'];

export default function Accounts({
  accounts = [],
  appMode = 'demo',
  backendStatus = 'connected',
  onAccountUpdated,
  onAccountsSynced,
  onRefreshData,
  oauthNotice,
  onClearOAuthNotice
}) {
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState(null);
  const [switchingPage, setSwitchingPage] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [metaPages, setMetaPages] = useState([]);

  const isDemoMode = appMode === 'demo';

  const platformIcons = {
    Instagram: '📸',
    Facebook: '👤',
    X: '🐦',
    LinkedIn: '💼',
    YouTube: '▶️',
    TikTok: '🎵'
  };

  const loadOAuthDetails = useCallback(async () => {
    if (isDemoMode) {
      setMetaPages([]);
      return;
    }
    try {
      const pagesRes = await api.getMetaPages();
      if (Array.isArray(pagesRes?.pages)) {
        setMetaPages(pagesRes.pages);
      }
    } catch {
      setMetaPages([]);
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return undefined;
    let active = true;
    const init = async () => {
      try {
        const pagesRes = await api.getMetaPages();
        if (active && Array.isArray(pagesRes?.pages)) {
          setMetaPages(pagesRes.pages);
        }
      } catch {
        if (active) setMetaPages([]);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [accounts.length, oauthNotice, isDemoMode]);

  const uniqueAccounts = accounts.reduce((acc, current) => {
    const exists = acc.find((item) => item.platform.toLowerCase() === current.platform.toLowerCase());
    if (!exists) {
      return acc.concat([current]);
    }
    return acc;
  }, []);

  const officialAccounts = uniqueAccounts.filter((a) => OFFICIAL_PLATFORMS.includes(a.platform));
  const sandboxOnlyAccounts = uniqueAccounts.filter((a) => !OFFICIAL_PLATFORMS.includes(a.platform));

  const showTempFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleToggle = async (accId) => {
    setTogglingId(accId);
    try {
      const updated = await api.toggleAccount(accId, appMode);
      if (onAccountUpdated) onAccountUpdated(updated);
      showTempFeedback(
        'success',
        `${updated.name || updated.platform} has been ${updated.connected ? 'enabled' : 'paused'} (${isDemoMode ? 'Demo Mode' : 'Live Server Mode'}).`
      );
    } catch (err) {
      console.error('Error toggling account connection:', err);
      showTempFeedback('error', err.message || 'Failed to update account status. Please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSyncSingle = async (acc) => {
    setSyncingId(acc.id);
    try {
      const res = await api.syncAccount(acc.id, appMode);
      if (res?.account && onAccountUpdated) {
        onAccountUpdated(res.account);
      }
      if (onRefreshData) onRefreshData(appMode);
      showTempFeedback('success', res.message || `${acc.platform} synchronized successfully.`);
    } catch (err) {
      if (err.data?.account && onAccountUpdated) {
        onAccountUpdated(err.data.account);
      }
      showTempFeedback('error', err.message || `OAuth Setup Required — failed to sync ${acc.platform}.`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setGlobalSyncing(true);
    try {
      const res = await api.syncAllAccounts(appMode);
      if (onAccountsSynced) onAccountsSynced(res);
      await loadOAuthDetails();
      if (res.errors && res.errors.length > 0) {
        showTempFeedback('error', `${res.message} ${res.errors.join(' | ')}`);
      } else {
        const extra = res.notes && res.notes.length > 0 ? ` (${res.notes.join('; ')})` : '';
        showTempFeedback('success', `${res.message || 'Accounts synchronized!'}${extra}`);
      }
    } catch (err) {
      console.error('Error syncing accounts:', err);
      showTempFeedback('error', err.message || 'Failed to sync accounts. Please check backend connection.');
    } finally {
      setGlobalSyncing(false);
    }
  };

  const handleOAuthNotConfigured = (platform) => {
    showTempFeedback(
      'error',
      `OAuth Setup Required — Official ${platform} OAuth app credentials are not configured in this release.`
    );
  };

  const handleDisconnectOAuth = async (platform) => {
    setOauthBusyPlatform(platform);
    try {
      const res = await api.disconnectOAuth(platform.toLowerCase());
      if (onRefreshData) await onRefreshData(appMode);
      await loadOAuthDetails();
      showTempFeedback('success', res.message || `Disconnected ${platform} OAuth session.`);
    } catch (err) {
      showTempFeedback('error', err.message || `Failed to disconnect ${platform} OAuth.`);
    } finally {
      setOauthBusyPlatform(null);
    }
  };

  const handleSelectMetaPage = async (pageId) => {
    if (!pageId) return;
    setSwitchingPage(true);
    try {
      const res = await api.selectMetaPage(pageId);
      if (onRefreshData) await onRefreshData(appMode);
      await loadOAuthDetails();
      showTempFeedback('success', res.message || 'Active Facebook Page updated.');
    } catch (err) {
      showTempFeedback('error', err.message || 'Failed to switch Facebook Page.');
    } finally {
      setSwitchingPage(false);
    }
  };

  const renderAccountCard = (acc, isOfficialPlatform) => {
    const isToggling = togglingId === acc.id;
    const isSyncing = syncingId === acc.id;
    const isOAuthBusy = oauthBusyPlatform === acc.platform;
    const isLiveOAuth = !isDemoMode && Boolean(acc.oauth_connected);
    const activeMetaPage = metaPages.find((p) => p.active);

    return (
      <div
        key={acc.id}
        className="clean-card ss-card-interactive"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1.05rem',
          padding: '1.45rem',
          borderColor: isLiveOAuth ? 'var(--success-border)' : isDemoMode && acc.connected ? 'var(--lavender-border)' : undefined
        }}
      >
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
            <div
              className="ss-icon-badge"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: 'var(--lavender)',
                border: '1px solid var(--lavender-border)',
                fontSize: '1.45rem',
                overflow: 'hidden'
              }}
            >
              {isSafeHttpUrl(acc.avatar) ? (
                <img src={acc.avatar} alt={acc.name || acc.platform} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                platformIcons[acc.platform] || '📱'
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '1.06rem', fontWeight: 700, margin: 0 }}>{acc.platform}</h3>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}
              >
                {acc.name && acc.name !== acc.platform ? `${acc.name} (${acc.handle})` : acc.handle}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <span className={`badge ${acc.connected ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
              <Radio size={10} />
              <span>{isDemoMode ? (acc.connected ? 'Demo Connected' : 'Paused') : acc.connected ? 'Enabled' : 'Paused'}</span>
            </span>
            <span
              style={{
                fontSize: '0.69rem',
                color: isDemoMode
                  ? 'var(--primary)'
                  : isLiveOAuth
                  ? 'var(--success)'
                  : isOfficialPlatform
                  ? 'var(--warning)'
                  : 'var(--text-muted)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isDemoMode ? (
                <>
                  <FlaskConical size={12} />
                  Demo (Simulated)
                </>
              ) : isLiveOAuth ? (
                <>
                  <ShieldCheck size={12} />
                  Live OAuth API
                </>
              ) : isOfficialPlatform ? (
                <>
                  <ShieldAlert size={12} />
                  OAuth Setup Required
                </>
              ) : (
                'Not Connected (No OAuth)'
              )}
            </span>
          </div>
        </div>

        {/* Channel Metrics */}
        <div
          style={{
            backgroundColor: 'var(--bg-muted)',
            borderRadius: '12px',
            border: '1px solid var(--border-light)',
            padding: '0.85rem 1rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem'
          }}
        >
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <Users size={12} color="var(--primary)" />
              {acc.platform === 'YouTube' ? 'Subscribers' : 'Followers'}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.22rem', fontWeight: 800 }}>
              {(acc.followers || 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <TrendingUp size={12} color="var(--success)" />
              {isDemoMode ? 'Demo Growth' : isLiveOAuth ? 'Live Growth' : 'Server Growth'}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.22rem', fontWeight: 800, color: 'var(--success)' }}>
              {acc.growth || '+0.0%'}
            </span>
          </div>
        </div>

        {/* Official API Capabilities */}
        {isOfficialPlatform && acc.capabilities && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {acc.capabilities.supports_text_only && <span className="badge badge-neutral">Text</span>}
              {(acc.capabilities.supported_media || []).map((media) => (
                <span key={media} className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                  {media}
                </span>
              ))}
              {!isDemoMode && acc.capabilities.requires_public_media_url && (
                <span className="badge badge-warning">Requires HTTPS URL</span>
              )}
            </div>
            <span style={{ color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {isDemoMode
                ? `Demo channel ready for simulated posting & analytics.`
                : `${acc.capabilities.official_api}: ${acc.capabilities.notes}`}
            </span>
          </div>
        )}

        {/* Meta Page Selector (Live OAuth only) */}
        {isLiveOAuth && (acc.platform === 'Facebook' || acc.platform === 'Instagram') && metaPages.length > 0 && (
          <div
            style={{
              padding: '0.68rem 0.8rem',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}
          >
            <label className="form-label" style={{ fontSize: '0.74rem' }}>
              Active Facebook Page ({metaPages.length} available)
            </label>
            <select
              className="form-input"
              value={activeMetaPage?.page_id || metaPages[0]?.page_id || ''}
              disabled={switchingPage}
              onChange={(e) => handleSelectMetaPage(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.38rem 0.55rem' }}
            >
              {metaPages.map((page) => (
                <option key={page.page_id} value={page.page_id}>
                  {page.name} {page.has_instagram ? `(IG: @${page.instagram_username || 'linked'})` : '(No IG linked)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* API Error (Live Mode) */}
        {!isDemoMode && acc.last_error && (
          <div className="ss-alert ss-alert-danger" style={{ padding: '0.58rem 0.75rem', fontSize: '0.75rem' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{acc.last_error}</span>
          </div>
        )}

        {/* Status Note */}
        {acc.status_message && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={12} style={{ flexShrink: 0 }} />
            <span>{acc.status_message}</span>
          </div>
        )}

        {/* Bottom Actions */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-light)'
          }}
        >
          {isDemoMode ? (
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => handleSyncSingle(acc)}
              className="btn-secondary btn-sm"
            >
              <RefreshCw size={13} />
              <span>{isSyncing ? 'Syncing Demo...' : 'Sync Demo Metrics'}</span>
            </button>
          ) : (
            isOfficialPlatform && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {!isLiveOAuth ? (
                  <button
                    type="button"
                    onClick={() => handleOAuthNotConfigured(acc.platform)}
                    className="btn-secondary btn-sm"
                    style={{ flex: 1, borderColor: 'var(--warning-border)', color: 'var(--warning)' }}
                  >
                    <KeyRound size={13} />
                    <span>OAuth Setup Required</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => handleSyncSingle(acc)}
                      className="btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <RefreshCw size={13} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Live'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isOAuthBusy}
                      onClick={() => handleDisconnectOAuth(acc.platform)}
                      className="btn-secondary btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                    >
                      <Unlink size={13} />
                      <span>Disconnect</span>
                    </button>
                  </>
                )}
              </div>
            )
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {isDemoMode
                ? acc.connected
                  ? 'Demo channel active'
                  : 'Demo channel paused'
                : isOfficialPlatform
                  ? isLiveOAuth
                    ? 'Live OAuth active'
                    : 'Local SQLite record only'
                  : 'No official OAuth integration'}
            </span>

            <button
              type="button"
              disabled={isToggling}
              onClick={() => handleToggle(acc.id)}
              className="btn-outline btn-sm"
            >
              {isToggling ? 'Updating...' : acc.connected ? 'Pause Channel' : 'Enable Channel'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }} className="animate-fade-in">
      {/* Page Header */}
      <div className="ss-page-header">
        <div>
          <h2 className="ss-page-title">Connected Social Accounts</h2>
          <p className="ss-page-subtitle">
            {isDemoMode
              ? 'Demo workspace accounts (Instagram, Facebook Pages, YouTube, X, LinkedIn, TikTok) with simulated followers & status toggles.'
              : 'Live Flask & SQLite channel status. Real external publishing and sync for Instagram, Facebook Pages, and YouTube require OAuth configuration.'}
          </p>
        </div>

        <button onClick={handleSyncAll} disabled={globalSyncing} className="btn-primary">
          <RefreshCw size={15} />
          <span>
            {globalSyncing
              ? 'Syncing Channels...'
              : isDemoMode
              ? 'Sync Demo Accounts'
              : 'Check Live Sync'}
          </span>
        </button>
      </div>

      {/* Mode Separation Callout */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          {isDemoMode ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Dummy Demo Mode Active:</strong> These accounts use realistic SQLite demo metrics so you can test toggling, syncing, composing, and scheduling without OAuth keys. Simulated posts never leave the app.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Live Server Mode Active:</strong> Connected directly to Flask &amp; SQLite (<code>{backendStatus}</code>). Unconfigured social networks clearly indicate <strong>OAuth Setup Required</strong> instead of simulating fake live connections.
            </>
          )}
        </div>
      </div>

      {/* OAuth Notice Banner */}
      {!isDemoMode && oauthNotice && (
        <div className={`ss-alert ${oauthNotice.type === 'error' ? 'ss-alert-danger' : 'ss-alert-success'}`} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
            {oauthNotice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{oauthNotice.text}</span>
          </div>
          {onClearOAuthNotice && (
            <button
              type="button"
              onClick={onClearOAuthNotice}
              aria-label="Dismiss notification"
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div className={`ss-alert ${feedback.type === 'error' ? 'ss-alert-danger' : 'ss-alert-success'}`} style={{ fontWeight: 600 }}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Core Platforms */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>
            {isDemoMode
              ? 'Primary Demo Channels (Instagram, Facebook Pages, YouTube)'
              : 'Official Live Integrations (Instagram, Facebook Pages, YouTube)'}
          </h3>
          <span className={`badge ${isDemoMode ? 'badge-primary' : 'badge-warning'}`}>
            {isDemoMode ? 'Demo Connected' : 'OAuth Setup Required'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.35rem' }}>
          {officialAccounts.map((acc) => renderAccountCard(acc, true))}
        </div>
      </div>

      {/* Additional Channels */}
      {sandboxOnlyAccounts.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>
              {isDemoMode ? 'Extended Demo Channels (Simulated)' : 'Additional Channels (OAuth Not Implemented)'}
            </h3>
            <span className="badge badge-neutral">
              {isDemoMode ? 'Demo Workspace' : 'Local Profile Only'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.35rem' }}>
            {sandboxOnlyAccounts.map((acc) => renderAccountCard(acc, false))}
          </div>
        </div>
      )}
    </div>
  );
}
