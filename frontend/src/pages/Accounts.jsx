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
  Link2,
  Unlink,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  X as CloseIcon
} from 'lucide-react';
import { api, isSafeHttpUrl, isTrustedOAuthUrl } from '../services/api';

const OFFICIAL_PLATFORMS = ['Instagram', 'Facebook', 'YouTube'];

export default function Accounts({
  accounts = [],
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
  const [oauthConfig, setOauthConfig] = useState(null);
  const [metaPages, setMetaPages] = useState([]);
  const [setupGuidePlatform, setSetupGuidePlatform] = useState(null);

  const platformIcons = {
    Instagram: '📸',
    Facebook: '👤',
    X: '🐦',
    LinkedIn: '💼',
    YouTube: '▶️',
    TikTok: '🎵'
  };

  const loadOAuthDetails = useCallback(async () => {
    try {
      const statusRes = await api.getOAuthStatus();
      if (statusRes?.providers) {
        setOauthConfig(statusRes);
      }
    } catch {
      // Non-fatal: OAuth status endpoint optional if offline
    }

    try {
      const pagesRes = await api.getMetaPages();
      if (Array.isArray(pagesRes?.pages)) {
        setMetaPages(pagesRes.pages);
      }
    } catch {
      setMetaPages([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const statusRes = await api.getOAuthStatus();
        if (active && statusRes?.providers) {
          setOauthConfig(statusRes);
        }
      } catch {
        // Ignore network error here
      }
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
  }, [accounts.length, oauthNotice]);

  // Deduplicate accounts to guarantee each platform is displayed only once
  const uniqueAccounts = accounts.reduce((acc, current) => {
    const exists = acc.find(item => item.platform.toLowerCase() === current.platform.toLowerCase());
    if (!exists) {
      return acc.concat([current]);
    }
    return acc;
  }, []);

  const officialAccounts = uniqueAccounts.filter(a => OFFICIAL_PLATFORMS.includes(a.platform));
  const sandboxOnlyAccounts = uniqueAccounts.filter(a => !OFFICIAL_PLATFORMS.includes(a.platform));

  const showTempFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleToggle = async (accId) => {
    setTogglingId(accId);
    try {
      const updated = await api.toggleAccount(accId);
      if (onAccountUpdated) onAccountUpdated(updated);
      showTempFeedback(
        'success',
        `${updated.name || updated.platform} has been ${updated.connected ? 'enabled' : 'paused'} for publishing.`
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
      const res = await api.syncAccount(acc.id);
      if (res?.account && onAccountUpdated) {
        onAccountUpdated(res.account);
      }
      if (onRefreshData) onRefreshData();
      showTempFeedback('success', res.message || `${acc.platform} synchronized successfully.`);
    } catch (err) {
      if (err.data?.account && onAccountUpdated) {
        onAccountUpdated(err.data.account);
      }
      showTempFeedback('error', err.message || `Failed to sync ${acc.platform}.`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setGlobalSyncing(true);
    try {
      const res = await api.syncAllAccounts();
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

  const handleOAuthConnect = async (platform, method = null) => {
    const providerKey = platform.toLowerCase();
    setOauthBusyPlatform(platform);
    setSetupGuidePlatform(null);
    try {
      const res = await api.startOAuth(providerKey, method);
      if (!res?.auth_url || !isTrustedOAuthUrl(res.auth_url)) {
        throw new Error('Untrusted or missing OAuth authorization URL returned by backend.');
      }

      const width = 640;
      const height = 740;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
      const popup = window.open(
        res.auth_url,
        `socialsync_oauth_${providerKey}`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        // Fallback when popups are blocked: full-page OAuth redirect
        window.location.assign(res.auth_url);
        return;
      }

      showTempFeedback(
        'success',
        `Opened official ${platform} OAuth authorization window. Complete sign-in in the popup to connect your real account.`
      );
    } catch (err) {
      const missing = err.data?.missing_env || [];
      if (missing.length > 0) {
        setSetupGuidePlatform({
          platform,
          missingEnv: missing,
          error: err.message,
          providerConfig: oauthConfig?.providers?.[platform]
        });
      }
      showTempFeedback('error', err.message || `Could not start ${platform} OAuth flow.`);
    } finally {
      setOauthBusyPlatform(null);
    }
  };

  const handleDisconnectOAuth = async (platform) => {
    setOauthBusyPlatform(platform);
    try {
      const res = await api.disconnectOAuth(platform.toLowerCase());
      if (onRefreshData) await onRefreshData();
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
      if (onRefreshData) await onRefreshData();
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
    const isLiveOAuth = Boolean(acc.oauth_connected);
    const providerCfg = oauthConfig?.providers?.[acc.platform];
    const oauthReadyOnServer = Boolean(providerCfg?.configured);
    const missingEnv = acc.missing_env?.length ? acc.missing_env : (providerCfg?.missing_env || []);
    const activeMetaPage = metaPages.find(p => p.active);

    return (
      <div
        key={acc.id}
        className="clean-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1.1rem',
          padding: '1.45rem',
          border: isLiveOAuth ? '1px solid rgba(16, 185, 129, 0.35)' : undefined
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--lavender)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              flexShrink: 0,
              overflow: 'hidden'
            }}>
              {isSafeHttpUrl(acc.avatar) ? (
                <img src={acc.avatar} alt={acc.name || acc.platform} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                platformIcons[acc.platform] || '📱'
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {acc.platform}
              </h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {acc.name && acc.name !== acc.platform ? `${acc.name} (${acc.handle})` : acc.handle}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <span className={`badge ${acc.connected ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.72rem' }}>
              <Radio size={10} style={{ marginRight: '4px' }} />
              {acc.connected ? 'Enabled' : 'Paused'}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                color: isLiveOAuth ? 'var(--success)' : (isOfficialPlatform ? 'var(--warning)' : 'var(--text-muted)'),
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isLiveOAuth ? (
                <>
                  <ShieldCheck size={12} />
                  Live OAuth API
                </>
              ) : isOfficialPlatform ? (
                <>
                  <ShieldAlert size={12} />
                  {oauthReadyOnServer ? 'OAuth Not Linked' : 'Sandbox (Creds Missing)'}
                </>
              ) : (
                '○ Sandbox Only'
              )}
            </span>
          </div>
        </div>

        {/* Metrics Box */}
        <div style={{
          backgroundColor: 'var(--bg-muted)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1.05rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
              <Users size={12} color="var(--primary)" />
              {acc.platform === 'YouTube' ? 'Subscribers' : 'Followers'}
            </span>
            <span style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {(acc.followers || 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
              <TrendingUp size={12} color="var(--success)" />
              {isLiveOAuth ? 'Live Growth / Delta' : 'Demo Growth'}
            </span>
            <span style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--success)' }}>
              {acc.growth || '+0.0%'}
            </span>
          </div>
        </div>

        {/* Capabilities & Official API Details */}
        {isOfficialPlatform && acc.capabilities && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {acc.capabilities.supports_text_only && (
                <span className="badge badge-neutral" style={{ fontSize: '0.67rem' }}>Text</span>
              )}
              {(acc.capabilities.supported_media || []).map(media => (
                <span key={media} className="badge badge-neutral" style={{ fontSize: '0.67rem', textTransform: 'capitalize' }}>
                  {media}
                </span>
              ))}
              {acc.capabilities.requires_public_media_url && (
                <span className="badge badge-warning" style={{ fontSize: '0.67rem' }}>Requires HTTPS URL</span>
              )}
            </div>
            <span style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {acc.capabilities.official_api}: {acc.capabilities.notes}
            </span>
          </div>
        )}

        {/* Meta Page Switcher when multiple pages available */}
        {isLiveOAuth && (acc.platform === 'Facebook' || acc.platform === 'Instagram') && metaPages.length > 0 && (
          <div style={{
            padding: '0.6rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Active Facebook Page ({metaPages.length} available)
            </label>
            <select
              className="input-field"
              value={activeMetaPage?.page_id || metaPages[0]?.page_id || ''}
              disabled={switchingPage}
              onChange={(e) => handleSelectMetaPage(e.target.value)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
            >
              {metaPages.map(page => (
                <option key={page.page_id} value={page.page_id}>
                  {page.name} {page.has_instagram ? `(IG: @${page.instagram_username || 'linked'})` : '(No IG linked)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Last API Error if any */}
        {acc.last_error && (
          <div style={{
            fontSize: '0.74rem',
            color: 'var(--danger)',
            backgroundColor: 'var(--danger-bg)',
            padding: '0.5rem 0.7rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.4rem',
            lineHeight: 1.35
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{acc.last_error}</span>
          </div>
        )}

        {/* Status Message */}
        {acc.status_message && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={12} style={{ flexShrink: 0 }} />
            <span>{acc.status_message}</span>
          </div>
        )}

        {/* Missing Credentials Notice for Official Platforms */}
        {isOfficialPlatform && !isLiveOAuth && !oauthReadyOnServer && missingEnv.length > 0 && (
          <div style={{
            fontSize: '0.73rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-muted)',
            padding: '0.5rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--border-color)'
          }}>
            <strong>Missing Backend Env:</strong> <code>{missingEnv.join(', ')}</code>
          </div>
        )}

        {/* Bottom Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light)'
        }}>
          {isOfficialPlatform && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              {!isLiveOAuth ? (
                <>
                  <button
                    type="button"
                    disabled={isOAuthBusy}
                    onClick={() => handleOAuthConnect(acc.platform)}
                    className="btn-primary"
                    style={{
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      flex: 1,
                      justifyContent: 'center'
                    }}
                  >
                    {isOAuthBusy ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={14} />}
                    <span>Connect {acc.platform} via OAuth</span>
                  </button>
                  {acc.platform === 'Instagram' && oauthConfig?.providers?.Instagram?.instagram_login_configured && (
                    <button
                      type="button"
                      disabled={isOAuthBusy}
                      onClick={() => handleOAuthConnect('Instagram', 'instagram_login')}
                      className="btn-secondary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.76rem' }}
                      title="Use Instagram Login for Business instead of Facebook Login"
                    >
                      IG Login
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => handleSyncSingle(acc)}
                    className="btn-secondary"
                    style={{
                      padding: '0.42rem 0.8rem',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    <span>Sync Live</span>
                  </button>
                  <button
                    type="button"
                    disabled={isOAuthBusy}
                    onClick={() => handleDisconnectOAuth(acc.platform)}
                    className="btn-secondary"
                    style={{
                      padding: '0.42rem 0.8rem',
                      fontSize: '0.78rem',
                      color: 'var(--danger)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Unlink size={13} />
                    <span>Disconnect OAuth</span>
                  </button>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
              {isOfficialPlatform
                ? (isLiveOAuth ? 'Live + Sandbox allowed' : 'Sandbox simulation enabled')
                : (acc.connected ? 'Sandbox simulation active' : 'Sandbox paused')}
            </span>

            <button
              type="button"
              disabled={isToggling}
              onClick={() => handleToggle(acc.id)}
              className="btn-secondary"
              style={{
                padding: '0.38rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              {isToggling && <RefreshCw size={12} className="animate-spin" />}
              <span>{acc.connected ? 'Pause Channel' : 'Enable Channel'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }} className="animate-fade-in">
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
            Connect official OAuth 2.0 accounts for real publishing (Instagram, Facebook Pages, YouTube) or keep Sandbox Mode channels separate.
          </p>
        </div>

        <button
          onClick={handleSyncAll}
          disabled={globalSyncing}
          className="btn-primary"
          style={{ padding: '0.65rem 1.4rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} className={globalSyncing ? 'animate-spin' : ''} />
          <span>{globalSyncing ? 'Syncing Channels...' : 'Sync All Accounts'}</span>
        </button>
      </div>

      {/* Mode Separation Help Banner */}
      <div className="help-box" style={{ borderLeft: '4px solid var(--primary)' }}>
        <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>
            Live API Mode vs Sandbox Simulation Mode
          </strong>
          <span>
            Official OAuth integrations (Instagram Graph API, Facebook Pages Graph API, YouTube Data API v3) store encrypted tokens on the Flask backend only. Unconnected platforms remain in <strong>Sandbox Mode</strong> and are never reported as real social publishes.
          </span>
        </div>
      </div>

      {/* OAuth Callback Result Banner */}
      {oauthNotice && (
        <div style={{
          backgroundColor: oauthNotice.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
          color: oauthNotice.type === 'error' ? 'var(--danger)' : 'var(--success)',
          padding: '0.85rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          fontSize: '0.88rem',
          fontWeight: 600,
          border: `1px solid ${oauthNotice.type === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {oauthNotice.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{oauthNotice.text}</span>
          </div>
          {onClearOAuthNotice && (
            <button
              type="button"
              onClick={onClearOAuthNotice}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
              aria-label="Dismiss notification"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>
      )}

      {/* Action Feedback Alert */}
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

      {/* Backend OAuth Configuration Helper Box (shown when user clicks Connect without env configured) */}
      {setupGuidePlatform && (
        <div className="clean-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--warning)', backgroundColor: 'var(--bg-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.96rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ExternalLink size={16} color="var(--warning)" />
                <span>{setupGuidePlatform.platform} OAuth Credentials Required in Backend</span>
              </h4>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {setupGuidePlatform.error}
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div><strong>1.</strong> Copy <code>backend/.env.example</code> to <code>backend/.env</code> and set: <code>{setupGuidePlatform.missingEnv.join(', ')}</code></div>
                {setupGuidePlatform.providerConfig?.redirect_uri && (
                  <div><strong>2.</strong> Register Redirect URI in developer console: <code>{setupGuidePlatform.providerConfig.redirect_uri}</code></div>
                )}
                {setupGuidePlatform.providerConfig?.required_scopes && (
                  <div><strong>3.</strong> Enable Scopes: <code>{setupGuidePlatform.providerConfig.required_scopes.join(', ')}</code></div>
                )}
                <div><strong>4.</strong> Restart Flask backend and click <strong>Connect {setupGuidePlatform.platform} via OAuth</strong> again.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSetupGuidePlatform(null)}
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Official Live API Platforms */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Official Live Integrations (Instagram, Facebook Pages, YouTube)
          </h3>
          <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>OAuth 2.0 Ready</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
          gap: '1.5rem',
          width: '100%'
        }}>
          {officialAccounts.map(acc => renderAccountCard(acc, true))}
        </div>
      </div>

      {/* Legacy Sandbox-Only Platforms */}
      {sandboxOnlyAccounts.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Sandbox-Only Channels (Demo Simulation)
            </h3>
            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Sandbox Mode Only</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: '1.5rem',
            width: '100%'
          }}>
            {sandboxOnlyAccounts.map(acc => renderAccountCard(acc, false))}
          </div>
        </div>
      )}
    </div>
  );
}
