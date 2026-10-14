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
  Download 
} from 'lucide-react';

export default function Analytics({ analytics, posts = [] }) {
  const [timeFilter, setTimeFilter] = useState('7d');

  // Chart data for daily impressions
  const impressionsData = [
    { day: 'Mon', impressions: 125000, reach: 98000 },
    { day: 'Tue', impressions: 142000, reach: 112000 },
    { day: 'Wed', impressions: 158000, reach: 124000 },
    { day: 'Thu', impressions: 169000, reach: 135000 },
    { day: 'Fri', impressions: 185000, reach: 148000 },
    { day: 'Sat', impressions: 198000, reach: 156000 },
    { day: 'Sun', impressions: 215000, reach: 172000 }
  ];

  // Audience distribution by platform
  const platformData = [
    { platform: 'TikTok', percentage: 42, color: '#0F172A' },
    { platform: 'Instagram', percentage: 28, color: '#E1306C' },
    { platform: 'Facebook', percentage: 17, color: '#1877F2' },
    { platform: 'X', percentage: 13, color: '#64748B' },
    { platform: 'YouTube', percentage: 10, color: '#EF4444' },
    { platform: 'LinkedIn', percentage: 7, color: '#0A66C2' }
  ];

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
            Understand how many people see your content and which channels perform best.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                onClick={() => setTimeFilter(f.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: timeFilter === f.id ? 'var(--bg-surface)' : 'transparent',
                  color: timeFilter === f.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => alert('Exporting Analytics Summary as PDF...')}
            className="btn-secondary"
            style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>Sample Analytics Data:</strong> The numbers and charts below display simulated metrics so you can learn how cross-platform performance tracking works.
        </span>
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
              Total Impressions
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
            1,192,000
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            The total number of times your posts were seen on user screens.
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
            +14.8%
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            How fast your follower count is growing compared to last period.
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
            6.4%
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            The percentage of viewers who took an action (liked, commented, shared).
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
            82,450
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            All likes, comments, and shares combined across all 6 networks.
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
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Impressions Over Time</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Shows how many times your content was viewed each day of the week.
            </p>
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={impressionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              Shows what percentage of your followers belong to each social channel.
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
            Ranked by total likes and engagement received from your audience.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {publishedPosts.map((post, idx) => (
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
                <span><strong>{(post.reach || 0).toLocaleString()}</strong> impressions</span>
                <span className="badge badge-success">High Engagement</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
