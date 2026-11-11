import React, { useState, useEffect } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

export default function Analytics({ analytics: initialAnalytics, posts = [], onReloadAnalytics }) {
  const [timeFilter, setTimeFilter] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(initialAnalytics);
  const [loading, setLoading] = useState(false);
  const [exportNotice, setExportNotice] = useState(false);

  // Sync when prop updates
  useEffect(() => {
    if (initialAnalytics) {
      setAnalyticsData(initialAnalytics);
    }
  }, [initialAnalytics]);

  // Fetch updated analytics when timeFilter changes
  const handleFilterChange = async (range) => {
    setTimeFilter(range);
    setLoading(true);
    try {
      const data = await api.getAnalytics(range);
      if (data) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Error fetching analytics for range:', range, err);
    } finally {
      setLoading(false);
    }
  };

  // Export Analytics to Downloadable CSV
  const handleExport = () => {
    const summary = analyticsData?.summary || {};
    const history = analyticsData?.history || [];
    
    let csv = "SocialSync Analytics Performance Report\n";
    csv += `Export Date,${new Date().toISOString().split('T')[0]}\n`;
    csv += `Selected Range,${timeFilter}\n\n`;

    csv += "--- Summary Metrics ---\n";
    csv += `Total Reach,${summary.total_reach ?? 0}\n`;
    csv += `Audience Growth,${summary.weekly_growth ?? '0%'}\n`;
    csv += `Engagement Rate,${summary.engagement_rate ?? '0%'}\n`;
    csv += `Total Interactions,${summary.total_interactions ?? 0}\n\n`;

    csv += "--- Timeline History ---\n";
    csv += "Period,Impressions,Reach,Engagement %\n";
    history.forEach(h => {
      csv += `${h.day},${h.impressions || 0},${h.reach || 0},${h.engagement || 0}%\n`;
    });

    csv += "\n--- Top Performing Posts ---\n";
    csv += "ID,Platforms,Likes,Comments,Shares,Reach,Content\n";
    posts.filter(p => p.status === 'published').slice(0, 5).forEach(p => {
      const cleanContent = (p.content || '').replace(/[\r\n,]+/g, ' ');
      const pls = Array.isArray(p.platforms) ? p.platforms.join(';') : p.platforms;
      csv += `${p.id},"${pls}",${p.likes || 0},${p.comments || 0},${p.shares || 0},${p.reach || 0},"${cleanContent}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SocialSync_Analytics_${timeFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3500);
  };

  const summary = analyticsData?.summary || {};
  const liveAnalytics = analyticsData?.live_analytics || {};
  const history = analyticsData?.history || [];
  const platformData = analyticsData?.platforms || [];

  const publishedPosts = posts
    .filter(p => p.status === 'published')
    .sort((a, b) => (b.likes || 0) - (a.likes || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade-in">
      {/* Top Header & Range Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', margin: 0 }}>Analytics Overview</h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
            Real OAuth platform snapshots alongside clearly labelled Sandbox demo metrics.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-muted)',
            padding: '3px',
            borderRadius: 'var(--radius-md)'
          }}>
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '3m', label: '3 Months' },
              { id: '1y', label: '1 Year' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: timeFilter === f.id ? 'var(--bg-surface)' : 'transparent',
                  color: timeFilter === f.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            className="btn-secondary"
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={14} />
            <span>Export Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* Export feedback alert */}
      {exportNotice && (
        <div style={{
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={16} />
          <span>Analytics performance report successfully exported to CSV!</span>
        </div>
      )}

      {/* Environment Separation Notice */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>Live vs Sandbox Telemetry:</strong> Real OAuth platform snapshots are shown below separately from Sandbox Mode chart aggregates (<strong>{timeFilter}</strong> timeframe).
        </span>
      </div>

      {/* Live Official API Analytics Panel */}
      <div className="clean-card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Official Live Platform Insights
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Live API snapshots synced via OAuth ({liveAnalytics.connected_live_accounts?.length || 0} connected) ·{' '}
              Live Posts: <strong>{liveAnalytics.live_posts_count || 0}</strong> ·{' '}
              Sandbox Posts: <strong>{liveAnalytics.sandbox_posts_count || 0}</strong> ·{' '}
              Failed: <strong>{liveAnalytics.failed_posts_count || 0}</strong>
            </p>
          </div>
          {onReloadAnalytics && (
            <button
              type="button"
              onClick={onReloadAnalytics}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
            >
              Refresh Metrics
            </button>
          )}
        </div>

        {(liveAnalytics.snapshots || []).length === 0 ? (
          <div style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-muted)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            No Live API snapshots synced yet. Connect Instagram, Facebook Pages, or YouTube via OAuth in <strong>Connected Accounts</strong> and click <strong>Sync Live</strong> to pull official API metrics.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
            {liveAnalytics.snapshots.map((snap, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{snap.platform}</strong>
                  <span className="badge badge-success" style={{ fontSize: '0.66rem' }}>LIVE API</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>Followers: <strong>{(snap.followers || 0).toLocaleString()}</strong></span>
                  <span>Reach/Views: <strong>{((snap.reach || snap.views) || 0).toLocaleString()}</strong></span>
                  <span>Engagement: <strong>{(snap.engagement || 0).toLocaleString()}</strong></span>
                  <span>Media/Videos: <strong>{((snap.video_count || snap.media_count) || 0).toLocaleString()}</strong></span>
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

      {/* 4 Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Metric 1: Impressions */}
        <div className="clean-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total Impressions / Reach
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--lavender)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Eye size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {(summary.total_reach ?? 0).toLocaleString()}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            Total views recorded across Sandbox &amp; local posts.
          </p>
        </div>

        {/* Metric 2: Audience Growth */}
        <div className="clean-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Audience Growth
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--success)' }}>
            {summary.weekly_growth ?? '0%'}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            Aggregate growth rate across {(summary.total_followers ?? 0).toLocaleString()} configured account followers.
          </p>
        </div>

        {/* Metric 3: Engagement Rate */}
        <div className="clean-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Engagement Rate
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Heart size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {summary.engagement_rate ?? '0%'}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            Percentage of viewers liking, commenting, or sharing (Sandbox demo rate when offline).
          </p>
        </div>

        {/* Metric 4: Total Interactions */}
        <div className="clean-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total Interactions
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--info-bg)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            {(summary.total_interactions ?? 0).toLocaleString()}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            Cumulative likes, comments, and shares recorded in the database.
          </p>
        </div>
      </div>

      {/* 2 Recharts Visualizations */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Chart 1: Impressions Over Time */}
        <div className="clean-card">
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Impressions Over Time (Demo Data)</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Simulated Sandbox trend across the {timeFilter} timeframe.
              </p>
            </div>
            {loading && <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Updating...</span>}
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-light)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value) => [`${value.toLocaleString()} views`, 'Impressions']}
                />
                <Area type="monotone" dataKey="impressions" stroke="#6C5CE7" strokeWidth={2.5} fillOpacity={1} fill="url(#purpleGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Audience Distribution by Platform */}
        <div className="clean-card">
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Audience Share by Platform</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Follower breakdown across your verified social networks.
            </p>
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
                <XAxis type="number" domain={[0, 50]} stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `${val}%`} />
                <YAxis type="category" dataKey="platform" stroke="var(--text-primary)" fontSize={12} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-light)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val) => [`${val}% of total audience`, 'Audience Share']}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]} fill="#6C5CE7">
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performing Posts Section */}
      <div className="clean-card">
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Top-Performing Posts</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Ranked by engagement metrics recorded in your SQLite database.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {publishedPosts.length === 0 ? (
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>No published posts yet.</p>
          ) : (
            publishedPosts.slice(0, 5).map((post, idx) => (
              <div
                key={post.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-muted)',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '220px' }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--lavender)',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    #{idx + 1}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {post.content.length > 95 ? `${post.content.substring(0, 95)}...` : post.content}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span><strong>{(post.likes || 0).toLocaleString()}</strong> likes</span>
                  <span><strong>{(post.reach || 0).toLocaleString()}</strong> reach</span>
                  <span className={`badge ${post.publish_mode === 'live' ? 'badge-success' : 'badge-neutral'}`}>
                    {post.publish_mode === 'live' ? 'Live API' : 'Sandbox Demo'}
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
