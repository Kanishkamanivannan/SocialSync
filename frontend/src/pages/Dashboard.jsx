import React, { useState } from 'react';
import {
  Users,
  Eye,
  Heart,
  Send,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus,
  CalendarDays,
  Share2,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function Dashboard({
  user,
  posts = [],
  accounts = [],
  activity = [],
  analytics,
  appMode = 'demo',
  backendStatus = 'connected',
  onNavigate
}) {
  const isDemoMode = appMode === 'demo';
  const scheduledPosts = posts.filter((p) => p.status === 'scheduled');
  const publishedPosts = posts.filter((p) => p.status === 'published');
  const livePublishedCount = publishedPosts.filter((p) => p.publish_mode === 'live').length;
  const demoOrSandboxPublishedCount = publishedPosts.filter((p) => p.publish_mode !== 'live').length;
  const connectedChannels = accounts.filter((a) => a.connected || a.oauth_connected);
  const history = analytics?.history || [];
  const demoDateSpan =
    isDemoMode && history.length >= 2 ? `${history[0].day} – ${history[history.length - 1].day}` : '';
  const demoPeakReach = isDemoMode && history.length ? Math.max(...history.map((h) => h.reach || 0)) : 0;
  const demoAvgReach =
    isDemoMode && history.length
      ? Math.round(history.reduce((sum, h) => sum + (h.reach || 0), 0) / history.length)
      : 0;

  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  const displayName = user?.name ? user.name.split(' ')[0] : 'Creator';

  const kpis = [
    {
      label: 'Total Audience',
      value: (analytics?.summary?.total_followers ?? 0).toLocaleString(),
      sub: isDemoMode
        ? `${connectedChannels.length} demo-connected channels`
        : 'OAuth Setup Required for live follower sync',
      icon: Users,
      accent: 'linear-gradient(90deg, #635BFF 0%, #8B5CF6 100%)',
      iconBg: 'var(--lavender)',
      iconColor: 'var(--primary)',
      target: 'accounts'
    },
    {
      label: 'Total Reach',
      value: (analytics?.summary?.total_reach ?? 0).toLocaleString(),
      sub: isDemoMode ? `Last 7 days across ${publishedPosts.length} posts` : 'Views recorded in SQLite',
      icon: Eye,
      accent: 'linear-gradient(90deg, #3B82F6 0%, #635BFF 100%)',
      iconBg: 'var(--info-bg)',
      iconColor: 'var(--info)',
      target: 'analytics'
    },
    {
      label: 'Engagement Rate',
      value: analytics?.summary?.engagement_rate ?? '0%',
      sub: isDemoMode
        ? `${(analytics?.summary?.total_interactions ?? 0).toLocaleString()} demo interactions`
        : 'Average SQLite interaction ratio',
      icon: Heart,
      accent: 'linear-gradient(90deg, #F59E0B 0%, #EC4899 100%)',
      iconBg: 'var(--warning-bg)',
      iconColor: 'var(--warning)',
      target: 'analytics'
    },
    {
      label: 'Published Posts',
      value: publishedPosts.length,
      sub: isDemoMode
        ? `${demoOrSandboxPublishedCount} Demo Published`
        : `${livePublishedCount} Live API · ${demoOrSandboxPublishedCount} Local`,
      icon: Send,
      accent: 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)',
      iconBg: 'var(--success-bg)',
      iconColor: 'var(--success)',
      target: 'calendar'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.65rem' }} className="animate-fade-in">
      {/* Executive Welcome Hero Banner */}
      <section className="ss-hero-banner">
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
        >
          <div style={{ maxWidth: '640px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.26rem 0.7rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '0.73rem',
                fontWeight: 600,
                color: '#E0E7FF',
                marginBottom: '0.65rem'
              }}
            >
              <Sparkles size={13} />
              <span>
                {isDemoMode ? 'DEMO MODE' : 'LIVE SERVER MODE'} · {scheduledPosts.length} Scheduled · {connectedChannels.length} {isDemoMode ? 'Demo Connected' : 'Channels'}
              </span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: 0,
                letterSpacing: '-0.03em'
              }}
            >
              {greeting}, {displayName}
            </h2>
            <p
              style={{
                margin: '0.38rem 0 0 0',
                fontSize: '0.92rem',
                color: '#C7D2FE',
                lineHeight: 1.5
              }}
            >
              {isDemoMode
                ? 'Explore realistic demo analytics, schedule posts, run Demo Published previews, and manage campaigns without external OAuth setup.'
                : `Connected to Flask & SQLite (${backendStatus}). Draft, schedule, upload media & manage campaigns. External social publishing shows OAuth Setup Required.`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigate('calendar')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.62rem 1.05rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.13)',
                border: '1px solid rgba(255, 255, 255, 0.24)',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.16s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.13)'; }}
            >
              <CalendarDays size={15} />
              <span>View Calendar</span>
            </button>

            <button
              onClick={() => onNavigate('compose')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.64rem 1.18rem',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                border: 'none',
                color: '#312E81',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
                transition: 'transform 0.16s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Plus size={16} />
              <span>New Post</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Gradient-Accented KPI Cards */}
      <div className="ss-grid-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="ss-kpi-card ss-card-interactive"
              style={{ '--kpi-accent': item.accent, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              onClick={() => onNavigate(item.target)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.95rem' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                  <div
                    className="ss-icon-badge"
                    style={{
                      width: '38px',
                      height: '38px',
                      backgroundColor: item.iconBg,
                      color: item.iconColor
                    }}
                  >
                    <Icon size={18} />
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    lineHeight: 1.1,
                    marginBottom: '0.55rem'
                  }}
                >
                  {item.value}
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '0.72rem',
                  marginTop: '0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                  {item.sub}
                </span>
                <ArrowRight size={14} color={item.iconColor} style={{ flexShrink: 0 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Momentum Chart + Connected Channels Overview */}
      <div className="ss-grid-2">
        {/* Chart Preview Card */}
        <div className="clean-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.15rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0 }}>
                  Reach Trajectory
                </h3>
                <span className="badge badge-neutral" style={{ fontSize: '0.67rem' }}>
                  {isDemoMode ? 'Last 7 Days' : 'Demo Trend'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                {isDemoMode
                  ? demoDateSpan
                    ? `${demoDateSpan} · Avg ${demoAvgReach.toLocaleString()}/day · Peak ${demoPeakReach.toLocaleString()}`
                    : '7-day daily reach across Demo Published posts'
                  : 'Simulated Sandbox impressions trajectory from Analytics'}
              </p>
            </div>
            <button onClick={() => onNavigate('analytics')} className="btn-outline btn-sm">
              <TrendingUp size={13} />
              <span>Full Analytics</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <div className="empty-state-title">No trajectory points yet</div>
              <div className="empty-state-desc">
                Visit Analytics to inspect historical performance or sync live OAuth metrics.
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={history}
                  margin={isDemoMode ? { top: 10, right: 12, left: -10, bottom: 0 } : { top: 8, right: 8, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dashIndigoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#635BFF" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#635BFF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickMargin={6}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '12px'
                    }}
                    labelFormatter={(label, payload) =>
                      isDemoMode ? payload?.[0]?.payload?.full_date || label : label
                    }
                    formatter={(value, _name, item) => {
                      if (!isDemoMode) {
                        return [`${Number(value).toLocaleString()}`, 'Impressions'];
                      }
                      const pt = item?.payload || {};
                      const postCount = pt.posts_count ?? 0;
                      return [
                        `${Number(value).toLocaleString()} (${pt.engagement ?? 0}% eng · ${postCount} post${postCount === 1 ? '' : 's'})`,
                        'Daily Reach'
                      ];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={isDemoMode ? 'reach' : 'impressions'}
                    stroke="#635BFF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#dashIndigoGrad)"
                    dot={isDemoMode ? { r: 3.5, fill: '#635BFF', stroke: '#FFFFFF', strokeWidth: 2 } : false}
                    activeDot={isDemoMode ? { r: 5.5, fill: '#635BFF', stroke: '#FFFFFF', strokeWidth: 2 } : { r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Channel Connections Summary */}
        <div className="clean-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0 }}>Channel Status</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  {isDemoMode
                    ? 'Demo-connected channels for simulated publishing & analytics'
                    : 'Live SQLite channels (OAuth Setup Required for external publishing)'}
                </p>
              </div>
              <button onClick={() => onNavigate('accounts')} className="btn-secondary btn-sm">
                <Share2 size={13} />
                <span>Manage</span>
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.75rem 1rem' }}>
                <div className="empty-state-icon">
                  <Share2 size={20} />
                </div>
                <div className="empty-state-title">No channels configured</div>
                <div className="empty-state-desc">
                  Check Connected Accounts to manage your {isDemoMode ? 'Demo channels' : 'Live Server connections'}.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {accounts.slice(0, 4).map((acc) => {
                  const isLive = !isDemoMode && Boolean(acc.oauth_connected);
                  const isActive = Boolean(acc.connected || isLive);
                  return (
                    <div
                      key={acc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.7rem 0.9rem',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-muted)',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            {acc.platform}
                          </span>
                          <span
                            className={`badge ${isDemoMode ? 'badge-primary' : isLive ? 'badge-success' : 'badge-warning'}`}
                            style={{ fontSize: '0.64rem', padding: '0.12rem 0.45rem' }}
                          >
                            {isDemoMode ? 'Demo' : isLive ? 'OAuth Live' : 'OAuth Required'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {acc.handle || acc.name || 'Not connected'}
                        </div>
                      </div>

                      <span className={`badge ${isActive ? (isDemoMode ? 'badge-success' : isLive ? 'badge-primary' : 'badge-warning') : 'badge-danger'}`}>
                        {isDemoMode ? (isActive ? 'Demo Connected' : 'Paused') : isLive ? 'Ready' : 'Setup Required'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Scheduled Queue & Recent Activity */}
      <div className="ss-grid-2">
        {/* Scheduled Posts */}
        <div className="clean-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0 }}>Upcoming Scheduled Posts</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Automated background queue awaiting publish time
              </p>
            </div>
            <button onClick={() => onNavigate('calendar')} className="btn-secondary btn-sm">
              Open Queue
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {scheduledPosts.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-icon">
                  <Clock size={22} />
                </div>
                <div className="empty-state-title">No posts scheduled yet</div>
                <div className="empty-state-desc">
                  Schedule content inside Compose Studio to see your upcoming delivery timeline here.
                </div>
                <button onClick={() => onNavigate('compose')} className="btn-primary btn-sm">
                  <Plus size={14} />
                  <span>Schedule Content</span>
                </button>
              </div>
            ) : (
              scheduledPosts.slice(0, 4).map((post) => {
                const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms];
                return (
                  <div
                    key={post.id}
                    style={{
                      padding: '0.95rem 1.05rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-muted)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${post.publish_mode === 'live' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.67rem' }}>
                          {post.publish_mode === 'live' ? 'LIVE API' : isDemoMode || post.publish_mode === 'demo' ? 'DEMO' : 'LOCAL'}
                        </span>
                        {platforms.filter(Boolean).map((pl, idx) => (
                          <span key={idx} className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                            {pl}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Clock size={13} color="var(--primary)" />
                        {post.scheduled_for || 'Queued'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                      {post.content && post.content.length > 115 ? `${post.content.substring(0, 115)}...` : post.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="clean-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0 }}>Recent Activity</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                {isDemoMode ? 'Real-time Demo alerts for posts, channels, and campaigns' : 'Audit trail of Live API syncs and Sandbox actions'}
              </p>
            </div>
            <span className="badge badge-primary">Live Feed</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-title">No recent activity</div>
                <div className="empty-state-desc">
                  Activity events from publishing, connecting accounts, and campaigns will appear here.
                </div>
              </div>
            ) : (
              activity.slice(0, 5).map((act, idx) => (
                <div
                  key={act.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.8rem',
                    paddingBottom: idx < Math.min(activity.length, 5) - 1 ? '0.85rem' : 0,
                    borderBottom: idx < Math.min(activity.length, 5) - 1 ? '1px solid var(--border-light)' : 'none'
                  }}
                >
                  <div
                    className="ss-icon-badge"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--lavender)',
                      color: 'var(--primary)',
                      marginTop: '2px'
                    }}
                  >
                    <CheckCircle2 size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                        {act.title}
                      </span>
                      <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {act.created_at || 'Recently'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.81rem', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: 1.45 }}>
                      {act.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
