import React, { useMemo } from 'react';
import { 
  Users, 
  Eye, 
  Heart, 
  Send, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  Plus
} from 'lucide-react';

export default function Dashboard({ 
  user, 
  posts = [], 
  activity = [], 
  analytics, 
  onNavigate 
}) {
  const scheduledPosts = posts.filter(p => p.status === 'scheduled');
  const publishedPosts = posts.filter(p => p.status === 'published');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const displayName = user?.name ? user.name.split(' ')[0] : 'User';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }} className="animate-fade-in">
      {/* Top Welcome Header */}
      <div style={{
        padding: '0.5rem 0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {greeting}, {displayName}! 👋
          </h2>
          <p style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-secondary)' }}>
            Here's what's happening with your social media today.
          </p>
        </div>

        <button
          onClick={() => onNavigate('compose')}
          className="btn-primary"
          style={{ padding: '0.6rem 1.3rem', fontSize: '0.88rem' }}
        >
          <Plus size={16} />
          <span>New Post</span>
        </button>
      </div>

      {/* 4 Spacious Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Metric 1: Total Audience */}
        <div 
          className="clean-card" 
          onClick={() => onNavigate('accounts')}
          style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
          title="Click to view connected accounts"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total Audience
              </span>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--lavender)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={20} />
              </div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              {(analytics?.summary?.total_followers ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Across all connected channels
            </p>
            <ArrowRight size={14} color="var(--primary)" />
          </div>
        </div>

        {/* Metric 2: Total Reach */}
        <div 
          className="clean-card"
          onClick={() => onNavigate('analytics')}
          style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
          title="Click to view detailed analytics"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total Reach
              </span>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Eye size={20} />
              </div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              {(analytics?.summary?.total_reach ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Estimated viewers across campaigns
            </p>
            <ArrowRight size={14} color="var(--info)" />
          </div>
        </div>

        {/* Metric 3: Engagement Rate */}
        <div 
          className="clean-card"
          onClick={() => onNavigate('analytics')}
          style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
          title="Click to view detailed analytics"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Engagement Rate
              </span>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--warning-bg)',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Heart size={20} />
              </div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              {analytics?.summary?.engagement_rate ?? '0%'}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Average viewer action percentage
            </p>
            <ArrowRight size={14} color="var(--warning)" />
          </div>
        </div>

        {/* Metric 4: Published Posts */}
        <div 
          className="clean-card"
          onClick={() => onNavigate('calendar')}
          style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
          title="Click to view posts calendar"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Published Posts
              </span>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Send size={20} />
              </div>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              {publishedPosts.length}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              {`${publishedPosts.filter(p => p.publish_mode === 'live').length} Live API · ${publishedPosts.filter(p => p.publish_mode !== 'live').length} Sandbox`}
            </p>
            <ArrowRight size={14} color="var(--success)" />
          </div>
        </div>
      </div>

      {/* Main Dashboard Columns: Upcoming Scheduled Queue & Recent Activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '2rem'
      }}>
        {/* Upcoming Scheduled Posts Section */}
        <div className="clean-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Upcoming Scheduled Posts</h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Posts that publish automatically at their scheduled times
              </p>
            </div>
            <button
              onClick={() => onNavigate('calendar')}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            >
              View Calendar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {scheduledPosts.length === 0 ? (
              <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
                <div className="empty-state-icon">
                  <Clock size={22} />
                </div>
                <div className="empty-state-title">No posts scheduled yet</div>
                <div className="empty-state-desc">
                  When you schedule content in Create Post, it will appear right here with its countdown.
                </div>
                <button
                  onClick={() => onNavigate('compose')}
                  className="btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  <Plus size={14} />
                  <span>Schedule Content</span>
                </button>
              </div>
            ) : (
              scheduledPosts.slice(0, 4).map(post => {
                const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms];
                return (
                  <div
                    key={post.id}
                    style={{
                      padding: '1.15rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-muted)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${post.publish_mode === 'live' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.68rem' }}>
                          {post.publish_mode === 'live' ? 'LIVE API' : 'SANDBOX'}
                        </span>
                        {platforms.map((pl, idx) => (
                          <span key={idx} className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                            {pl}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Clock size={13} />
                        {post.scheduled_for || 'Queued'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                      {post.content.length > 120 ? `${post.content.substring(0, 120)}...` : post.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Recent Activity Feed */}
        <div className="clean-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Recent Activity</h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Chronological updates from Live APIs and Sandbox actions
              </p>
            </div>
            <span className="badge badge-primary">Activity Log</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No recent activity to show.</p>
              </div>
            ) : (
              activity.slice(0, 5).map((act, idx) => (
                <div 
                  key={act.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    paddingBottom: '0.85rem',
                    borderBottom: idx < 4 ? '1px solid var(--border-light)' : 'none'
                  }}
                >
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--lavender)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {act.title}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {act.created_at || 'Recently'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, marginTop: '3px', lineHeight: 1.45 }}>
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
