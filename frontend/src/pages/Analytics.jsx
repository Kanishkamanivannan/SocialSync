import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Eye,
  TrendingUp,
  Heart,
  MessageSquare,
  Info,
  Download,
  CheckCircle2,
  RefreshCw,
  Radio,
  BarChart3,
  FlaskConical,
  KeyRound
} from 'lucide-react';
import { api } from '../services/api';

export default function Analytics({
  analytics: initialAnalytics,
  posts = [],
  appMode = 'demo',
  backendStatus = 'connected',
  onReloadAnalytics
}) {
  const isDemoMode = appMode === 'demo';
  const [rangeSelection, setRangeSelection] = useState({ mode: appMode, range: '7d', data: null });
  const [loading, setLoading] = useState(false);
  const [exportNotice, setExportNotice] = useState(false);

  const activeRange = rangeSelection.mode === appMode ? rangeSelection.range : '7d';
  const analyticsData =
    rangeSelection.mode === appMode && rangeSelection.data ? rangeSelection.data : initialAnalytics;

  const handleFilterChange = async (range) => {
    setRangeSelection((prev) => ({
      mode: appMode,
      range,
      data: prev.mode === appMode ? prev.data : null
    }));
    setLoading(true);
    try {
      const data = await api.getAnalytics(range, appMode);
      if (data) {
        setRangeSelection({ mode: appMode, range, data });
      }
    } catch (err) {
      console.error('Error fetching analytics for range:', range, err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRangeSelection({ mode: appMode, range: activeRange, data: null });
    if (onReloadAnalytics) {
      await onReloadAnalytics(appMode);
    }
    if (activeRange !== '7d') {
      await handleFilterChange(activeRange);
    }
  };

  const handleExport = () => {
    const summary = analyticsData?.summary || {};
    const history = analyticsData?.history || [];

    let csv = 'SocialSync Analytics Performance Report\n';
    csv += `Workspace Mode,${isDemoMode ? 'Dummy Demo Mode' : 'Live Server Mode'}\n`;
    csv += `Export Date,${new Date().toISOString().split('T')[0]}\n`;
    csv += `Selected Range,${activeRange}\n\n`;

    csv += '--- Summary Metrics ---\n';
    csv += `Total Reach,${summary.total_reach ?? 0}\n`;
    csv += `Audience Growth,${summary.weekly_growth ?? '0%'}\n`;
    csv += `Engagement Rate,${summary.engagement_rate ?? '0%'}\n`;
    csv += `Total Interactions,${summary.total_interactions ?? 0}\n\n`;

    csv += '--- Timeline History ---\n';
    csv += 'Period,Impressions,Reach,Engagement %\n';
    history.forEach((h) => {
      csv += `${h.day},${h.impressions || 0},${h.reach || 0},${h.engagement || 0}%\n`;
    });

    csv += '\n--- Top Performing Posts ---\n';
    csv += 'ID,Platforms,Likes,Comments,Shares,Reach,Content\n';
    posts
      .filter((p) => p.status === 'published')
      .slice(0, 5)
      .forEach((p) => {
        const cleanContent = (p.content || '').replace(/[\r\n,]+/g, ' ');
        const pls = Array.isArray(p.platforms) ? p.platforms.join(';') : p.platforms;
        csv += `${p.id},"${pls}",${p.likes || 0},${p.comments || 0},${p.shares || 0},${p.reach || 0},"${cleanContent}"\n`;
      });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SocialSync_${appMode}_Analytics_${activeRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3500);
  };

  const summary = analyticsData?.summary || {};
  const liveAnalytics = analyticsData?.live_analytics || {};
  const history = analyticsData?.history || [];
  const platformData = analyticsData?.platforms || [];
  const publishedPosts = [...posts]
    .filter((p) => p.status === 'published')
    .sort((a, b) => ((b.reach || 0) + (b.likes || 0)) - ((a.reach || 0) + (a.likes || 0)));

  const timeframes = [
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '3m', label: '3 Months' },
    { id: '1y', label: '1 Year' }
  ];

  const metrics = [
    {
      label: isDemoMode ? 'Demo Reach & Views' : 'Total Impressions / Reach',
      value: (summary.total_reach ?? 0).toLocaleString(),
      desc: isDemoMode
        ? 'Simulated reach across Demo Published posts in SQLite.'
        : 'Recorded views in Live Flask & SQLite workspace.',
      icon: Eye,
      accent: 'linear-gradient(90deg, #635BFF 0%, #8B5CF6 100%)',
      iconBg: 'var(--lavender)',
      iconColor: 'var(--primary)'
    },
    {
      label: 'Audience Growth',
      value: summary.weekly_growth ?? '0%',
      desc: `Aggregate growth across ${(summary.total_followers ?? 0).toLocaleString()} followers.`,
      icon: TrendingUp,
      accent: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
      iconBg: 'var(--success-bg)',
      iconColor: 'var(--success)',
      valueColor: 'var(--success)'
    },
    {
      label: 'Engagement Rate',
      value: summary.engagement_rate ?? '0%',
      desc: isDemoMode
        ? 'Simulated Demo engagement ratio across published posts.'
        : 'Computed from Live SQLite post interactions.',
      icon: Heart,
      accent: 'linear-gradient(90deg, #F59E0B 0%, #EC4899 100%)',
      iconBg: 'var(--warning-bg)',
      iconColor: 'var(--warning)'
    },
    {
      label: 'Total Interactions',
      value: (summary.total_interactions ?? 0).toLocaleString(),
      desc: 'Cumulative likes, comments & shares stored in SQLite.',
      icon: MessageSquare,
      accent: 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)',
      iconBg: 'var(--info-bg)',
      iconColor: 'var(--info)'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      {/* Toolbar Header */}
      <div className="ss-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div className="ss-tab-group">
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => handleFilterChange(tf.id)}
                className={`ss-tab ${activeRange === tf.id ? 'active' : ''}`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {exportNotice && (
            <span className="badge badge-success">
              <CheckCircle2 size={13} />
              <span>CSV Exported</span>
            </span>
          )}
        </div>

        <button onClick={handleExport} className="btn-secondary">
          <Download size={15} />
          <span>Export Report CSV</span>
        </button>
      </div>

      {/* Transparency Notice */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          {isDemoMode ? (
            <>
              <strong>Dummy Demo Mode Analytics:</strong> All charts, audience shares, and engagement cards update dynamically from your isolated SQLite Demo posts and demo channels. Switching range filters (`7d` / `30d` / `3m` / `1y`) recalculates real backend Demo series.
            </>
          ) : (
            <>
              <strong>Live Server Mode Analytics ({backendStatus}):</strong> Connected to Flask &amp; SQLite. External network insights (Instagram Insights, Facebook Page Insights, YouTube Analytics) display <strong>OAuth Setup Required</strong> until OAuth is configured.
            </>
          )}
        </div>
      </div>

      {/* Mode Insights Status Panel */}
      <div className="clean-card" style={{ padding: '1.45rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="ss-icon-badge"
              style={{
                backgroundColor: isDemoMode ? 'var(--lavender)' : liveAnalytics.oauth_required ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: isDemoMode ? 'var(--primary)' : liveAnalytics.oauth_required ? 'var(--warning)' : 'var(--success)'
              }}
            >
              {isDemoMode ? <FlaskConical size={19} /> : liveAnalytics.oauth_required ? <KeyRound size={19} /> : <Radio size={19} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.06rem', fontWeight: 700 }}>
                  {isDemoMode ? 'Demo Workspace Engagement Summary' : 'Official Live Platform Insights'}
                </h3>
                {isDemoMode ? (
                  <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                    DEMO MODE (SIMULATED)
                  </span>
                ) : liveAnalytics.oauth_required ? (
                  <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                    OAuth Setup Required
                  </span>
                ) : (
                  <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                    {liveAnalytics.connected_live_accounts?.length || 0} OAuth Connected
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {isDemoMode ? (
                  <>
                    Demo Published Posts: <strong>{liveAnalytics.demo_posts_count || publishedPosts.length}</strong> ·{' '}
                    Active Demo Accounts: <strong>{platformData.length}</strong>
                  </>
                ) : (
                  <>
                    Live Posts: <strong>{liveAnalytics.live_posts_count || 0}</strong> ·{' '}
                    Local/Sandbox Posts: <strong>{liveAnalytics.sandbox_posts_count || 0}</strong> ·{' '}
                    Failed: <strong>{liveAnalytics.failed_posts_count || 0}</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          {onReloadAnalytics && (
            <button type="button" onClick={handleRefresh} className="btn-secondary btn-sm">
              <RefreshCw size={13} />
              <span>Refresh Metrics</span>
            </button>
          )}
        </div>

        {isDemoMode ? (
          <div
            style={{
              padding: '0.95rem 1.15rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--lavender-border)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)'
            }}
          >
            Demo metrics are calculated live from SQLite rows in your Demo workspace. Create or <strong>Demo Publish</strong> new posts in Compose Studio to watch reach, interactions, and chart curves update automatically.
          </div>
        ) : (liveAnalytics.snapshots || []).length === 0 ? (
          <div
            style={{
              padding: '1rem 1.15rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-muted)',
              border: '1px dashed var(--warning-border)',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)'
            }}
          >
            <strong>OAuth Setup Required:</strong> No Live API snapshots exist yet because Instagram, Facebook Pages, and YouTube OAuth connections are not configured in this build. Local SQLite metrics above remain accurate.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {liveAnalytics.snapshots.map((snap, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1.05rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{snap.platform}</strong>
                  <span className="badge badge-success" style={{ fontSize: '0.66rem' }}>LIVE API</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.79rem', color: 'var(--text-secondary)' }}>
                  <span>Followers: <strong style={{ color: 'var(--text-primary)' }}>{(snap.followers || 0).toLocaleString()}</strong></span>
                  <span>Reach/Views: <strong style={{ color: 'var(--text-primary)' }}>{((snap.reach || snap.views) || 0).toLocaleString()}</strong></span>
                  <span>Engagement: <strong style={{ color: 'var(--text-primary)' }}>{(snap.engagement || 0).toLocaleString()}</strong></span>
                  <span>Media: <strong style={{ color: 'var(--text-primary)' }}>{((snap.video_count || snap.media_count) || 0).toLocaleString()}</strong></span>
                </div>
                {snap.permission_note && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>
                    Note: {snap.permission_note}
                  </div>
                )}
                {snap.fetched_at && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Synced: {snap.fetched_at}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="ss-grid-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="ss-kpi-card" style={{ '--kpi-accent': m.accent }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</span>
                <div className="ss-icon-badge" style={{ width: '34px', height: '34px', backgroundColor: m.iconBg, color: m.iconColor }}>
                  <Icon size={16} />
                </div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.85rem',
                  fontWeight: 800,
                  marginBottom: '0.3rem',
                  color: m.valueColor || 'var(--text-primary)'
                }}
              >
                {m.value}
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                {m.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* 2 Recharts Visualizations */}
      <div className="ss-grid-2">
        {/* Area Chart */}
        <div className="clean-card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.15rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.06rem', margin: 0 }}>Impressions &amp; Reach</h3>
                <span className={`badge ${isDemoMode ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '0.66rem' }}>
                  {isDemoMode ? 'Demo Data' : 'SQLite Trend'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                {isDemoMode
                  ? `Simulated Demo series for ${activeRange.toUpperCase()}`
                  : `Live Server series for ${activeRange.toUpperCase()}`}
              </p>
            </div>
            {loading && <span className="badge badge-primary">Updating...</span>}
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635BFF" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="violetReachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => [`${Number(value).toLocaleString()} views`, name === 'reach' ? 'Reach' : 'Impressions']}
                />
                <Area type="monotone" dataKey="impressions" stroke="#635BFF" strokeWidth={2.5} fillOpacity={1} fill="url(#purpleGrad)" />
                <Area type="monotone" dataKey="reach" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#violetReachGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Share Bar Chart */}
        <div className="clean-card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.15rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.06rem', margin: 0 }}>Audience Share by Platform</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Follower weight across connected channels
              </p>
            </div>
            <BarChart3 size={18} color="var(--primary)" />
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
                <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <YAxis type="category" dataKey="platform" stroke="var(--text-primary)" fontSize={12} tickLine={false} axisLine={false} width={90} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '12px'
                  }}
                  formatter={(val) => [`${val}% of total audience`, 'Audience Share']}
                />
                <Bar dataKey="percentage" radius={[0, 8, 8, 0]} barSize={20} fill="#635BFF">
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#635BFF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="clean-card" style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.08rem', margin: 0 }}>Top-Performing Posts</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Ranked by engagement metrics recorded in SQLite
            </p>
          </div>
          <span className="badge badge-primary">{publishedPosts.length} Published</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {publishedPosts.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <div className="empty-state-title">No published posts yet</div>
              <div className="empty-state-desc">
                Once posts are published in Live or Sandbox mode, top performers will appear here.
              </div>
            </div>
          ) : (
            publishedPosts.slice(0, 5).map((post, idx) => (
              <div
                key={post.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.9rem 1.05rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-light)',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: '220px' }}>
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '9px',
                      background: idx === 0 ? 'var(--gradient-brand)' : 'var(--lavender)',
                      color: idx === 0 ? '#FFFFFF' : 'var(--primary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {post.content && post.content.length > 100 ? `${post.content.substring(0, 100)}...` : post.content}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span><strong style={{ color: 'var(--text-primary)' }}>{(post.likes || 0).toLocaleString()}</strong> likes</span>
                  <span><strong style={{ color: 'var(--text-primary)' }}>{(post.reach || 0).toLocaleString()}</strong> reach</span>
                  <span className={`badge ${post.publish_mode === 'live' ? 'badge-success' : (post.publish_mode === 'demo' || isDemoMode) ? 'badge-primary' : 'badge-neutral'}`}>
                    {post.publish_mode === 'live' ? 'Live API' : (post.publish_mode === 'demo' || isDemoMode) ? 'Demo Published' : 'Sandbox Demo'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
