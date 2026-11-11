import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Trash2,
  Edit3,
  Eye,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarDays,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { api, isSafeHttpUrl } from '../services/api';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function getStatusBadgeClass(status) {
  if (status === 'published') return 'badge-success';
  if (status === 'scheduled') return 'badge-primary';
  if (status === 'failed') return 'badge-danger';
  return 'badge-warning';
}

function getStatusDotColor(status) {
  if (status === 'published') return 'var(--success)';
  if (status === 'scheduled') return 'var(--primary)';
  if (status === 'failed') return 'var(--danger)';
  return 'var(--warning)';
}

function getPublishModeLabel(publishMode, appMode = 'demo') {
  if (publishMode === 'live') return 'LIVE API';
  if (publishMode === 'demo' || appMode === 'demo') return 'DEMO PUBLISHED';
  return 'SANDBOX';
}

export default function Calendar({ posts = [], appMode = 'demo', focusPost = null, onPostUpdated, onPostDeleted, onNavigate }) {
  const isDemoMode = appMode === 'demo';
  const [filter, setFilter] = useState('all');

  const [todayMeta] = useState(() => {
    const now = new Date();
    const rawFocus = focusPost?.scheduled_for || focusPost?.published_at || focusPost?.created_at || '';
    let initYear = now.getFullYear();
    let initMonth = now.getMonth();
    let initDateStr = `${initYear}-${String(initMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(rawFocus)) {
      const [yStr, mStr, dStr] = rawFocus.slice(0, 10).split('-');
      const fy = Number(yStr);
      const fm = Number(mStr) - 1;
      if (!Number.isNaN(fy) && !Number.isNaN(fm) && fm >= 0 && fm <= 11) {
        initYear = fy;
        initMonth = fm;
        initDateStr = `${yStr}-${mStr}-${dStr}`;
      }
    }
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      initYear,
      initMonth,
      initDateStr
    };
  });

  const { year: todayYear, month: todayMonth, day: todayDay, initYear, initMonth, initDateStr } = todayMeta;

  const [currentYear, setCurrentYear] = useState(initYear);
  const [currentMonth, setCurrentMonth] = useState(initMonth);
  const [selectedDate, setSelectedDate] = useState(initDateStr);

  const [viewingPost, setViewingPost] = useState(() => focusPost || null);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState('scheduled');
  const [editPublishMode, setEditPublishMode] = useState(isDemoMode ? 'demo' : 'live');
  const [editDate, setEditDate] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const showTempFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const statusDescriptions = {
    all: `Showing all ${isDemoMode ? 'Demo workspace' : 'Live Server'} content across your calendar: scheduled, published, partial, failed, and draft posts.`,
    scheduled: `Scheduled: Posts queued to automatically release at their designated timestamp (${isDemoMode ? 'Demo Simulation' : 'Live Server SQLite'}).`,
    published: isDemoMode
      ? 'Demo Published: Simulated publishes stored in Demo SQLite workspace (not posted externally).'
      : 'Published: Posts recorded in Live Server workspace.',
    partial: 'Partial: Live post succeeded on one or more channels but failed on at least one channel.',
    failed: 'Failed: Publishing failed (e.g., OAuth Setup Required). Inspect details to fix & retry.',
    draft: 'Drafts: Concepts and work-in-progress captions saved for future refinement.'
  };

  const filteredPosts = posts.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleOpenView = (post) => {
    setViewingPost(post);
  };

  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditStatus(post.status);
    setEditPublishMode(isDemoMode ? 'demo' : post.publish_mode === 'live' ? 'live' : 'sandbox');
    setEditDate(
      post.scheduled_for
        ? post.scheduled_for.replace(' ', 'T').substring(0, 16)
        : `${selectedDate}T12:00`
    );
    setEditErrorMsg('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;

    setLoading(true);
    setEditErrorMsg('');
    try {
      const effectiveMode = isDemoMode ? 'demo' : editPublishMode;
      const updated = await api.updatePost(
        editingPost.id,
        {
          content: editContent,
          status: editStatus,
          publish_mode: effectiveMode,
          scheduled_for: editDate ? editDate.replace('T', ' ') + ':00' : null
        },
        appMode
      );
      if (onPostUpdated) onPostUpdated(updated);
      if (editDate && /^\d{4}-\d{2}-\d{2}/.test(editDate)) {
        const [ny, nm] = editDate.slice(0, 10).split('-').map(Number);
        setSelectedDate(editDate.slice(0, 10));
        if (!Number.isNaN(ny) && !Number.isNaN(nm) && nm >= 1 && nm <= 12) {
          setCurrentYear(ny);
          setCurrentMonth(nm - 1);
        }
      }
      setEditingPost(null);
      if (updated.status === 'published' && (updated.publish_mode === 'demo' || isDemoMode)) {
        showTempFeedback('success', 'Post Demo Published cleanly inside Demo Mode workspace!');
      } else if (updated.status === 'partial') {
        showTempFeedback(
          'error',
          `Post partially published: ${updated.error_message || 'Check View modal for channel details.'}`
        );
      } else {
        showTempFeedback('success', 'Post updated cleanly!');
      }
    } catch (err) {
      console.error(err);
      if (err.data?.id && onPostUpdated) {
        onPostUpdated(err.data);
      }
      setEditErrorMsg(err.data?.error_message || err.message || 'Failed to update post.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoPublish = async (post) => {
    if (!post || !isDemoMode) return;
    setLoading(true);
    try {
      const updated = await api.updatePost(
        post.id,
        {
          content: post.content,
          status: 'published',
          publish_mode: 'demo'
        },
        appMode
      );
      if (onPostUpdated) onPostUpdated(updated);
      setViewingPost(updated);
      showTempFeedback('success', 'Post Demo Published cleanly inside Demo Mode workspace!');
    } catch (err) {
      console.error(err);
      showTempFeedback('error', err.message || 'Failed to Demo Publish post.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      try {
        await api.deletePost(postId, appMode);
        if (onPostDeleted) onPostDeleted(postId);
        if (viewingPost?.id === postId) setViewingPost(null);
        showTempFeedback('success', 'Post deleted cleanly.');
      } catch (err) {
        console.error(err);
        showTempFeedback('error', err?.message || 'Failed to delete post.');
      }
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const getPostsForDateString = (dateStr) =>
    filteredPosts.filter((p) => {
      const check = p.scheduled_for || p.created_at;
      return check && check.startsWith(dateStr);
    });

  const getPostsForDay = (day) => {
    const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getPostsForDateString(dayStr);
  };

  const selectedDatePosts = getPostsForDateString(selectedDate);

  const formatSelectedDateHuman = (dateStr) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const statusTabs = [
    { id: 'all', label: 'All', count: posts.length },
    { id: 'scheduled', label: 'Scheduled', count: posts.filter((p) => p.status === 'scheduled').length },
    { id: 'published', label: 'Published', count: posts.filter((p) => p.status === 'published').length },
    { id: 'partial', label: 'Partial', count: posts.filter((p) => p.status === 'partial').length },
    { id: 'failed', label: 'Failed', count: posts.filter((p) => p.status === 'failed').length },
    { id: 'draft', label: 'Drafts', count: posts.filter((p) => p.status === 'draft').length }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      {/* Top Action & Filter Header */}
      <div className="ss-page-header">
        <div className="ss-tab-group">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`ss-tab ${filter === tab.id ? 'active' : ''}`}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  backgroundColor: filter === tab.id ? 'var(--primary)' : 'var(--bg-surface)',
                  color: filter === tab.id ? '#FFFFFF' : 'var(--text-secondary)',
                  borderRadius: '999px',
                  padding: '0.06rem 0.44rem',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <button onClick={() => onNavigate('compose')} className="btn-primary">
          <Plus size={15} />
          <span>Schedule Post</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          {statusDescriptions[filter]} Click any date cell to inspect that day's queue.
        </span>
      </div>

      {feedback && (
        <div
          className={`ss-alert ${feedback?.type === 'error' ? 'ss-alert-danger' : 'ss-alert-success'}`}
          style={{ fontWeight: 600 }}
        >
          {feedback?.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{typeof feedback === 'string' ? feedback : feedback.text}</span>
        </div>
      )}

      {/* 2-Column Interactive Calendar + Day Agenda */}
      <div className="calendar-grid-layout">
        {/* Left: Monthly Calendar */}
        <div className="clean-card" style={{ padding: '1.35rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.8rem',
              borderBottom: '1px solid var(--border-light)'
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button onClick={handlePrevMonth} className="btn-secondary btn-sm" title="Previous Month" aria-label="Previous Month">
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(now.getMonth());
                  setCurrentYear(now.getFullYear());
                  setSelectedDate(
                    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                  );
                }}
                className="btn-secondary btn-sm"
              >
                Today
              </button>
              <button onClick={handleNextMonth} className="btn-secondary btn-sm" title="Next Month" aria-label="Next Month">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.73rem',
              color: 'var(--text-muted)',
              marginBottom: '0.45rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={{ padding: '0.35rem 0' }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  height: '62px',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: '10px',
                  opacity: 0.35
                }}
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPosts = getPostsForDay(day);
              const isToday = currentMonth === todayMonth && currentYear === todayYear && day === todayDay;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(dateStr)}
                  title={`${dateStr} — ${dayPosts.length} post(s)`}
                  style={{
                    height: '62px',
                    backgroundColor: isSelected
                      ? 'var(--lavender)'
                      : isToday
                        ? 'rgba(99, 91, 255, 0.06)'
                        : 'var(--bg-surface)',
                    border: isSelected
                      ? '2px solid var(--primary)'
                      : isToday
                        ? '1.5px solid var(--lavender-border)'
                        : '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '6px 7px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: isSelected || isToday ? 800 : 600,
                        color: isSelected || isToday ? 'var(--primary)' : 'var(--text-primary)'
                      }}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          textTransform: 'uppercase'
                        }}
                      >
                        Today
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                    {dayPosts.slice(0, 4).map((p, pIdx) => (
                      <span
                        key={pIdx}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: getStatusDotColor(p.status),
                          display: 'inline-block'
                        }}
                      />
                    ))}
                    {dayPosts.length > 4 && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        +{dayPosts.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {[
              { label: 'Scheduled', color: 'var(--primary)' },
              { label: 'Published', color: 'var(--success)' },
              { label: 'Draft / Partial', color: 'var(--warning)' },
              { label: 'Failed', color: 'var(--danger)' }
            ].map((item) => (
              <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Selected-Date Queue */}
        <div className="clean-card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.8rem',
              borderBottom: '1px solid var(--border-light)',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div className="ss-icon-badge" style={{ width: '36px', height: '36px', backgroundColor: 'var(--lavender)', color: 'var(--primary)' }}>
                <CalendarDays size={17} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0 }}>
                  {formatSelectedDateHuman(selectedDate)}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {selectedDatePosts.length} post{selectedDatePosts.length === 1 ? '' : 's'} queued
                </span>
              </div>
            </div>

            <button onClick={() => onNavigate('compose', selectedDate)} className="btn-secondary btn-sm">
              <Plus size={14} />
              <span>Add Post</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {selectedDatePosts.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem', backgroundColor: 'var(--bg-muted)', borderRadius: '14px' }}>
                <div className="empty-state-icon" style={{ width: '44px', height: '44px' }}>
                  <Clock size={20} />
                </div>
                <div className="empty-state-title">No posts on this date</div>
                <div className="empty-state-desc">
                  Schedule content for {formatSelectedDateHuman(selectedDate)} to keep your pipeline full.
                </div>
                <button onClick={() => onNavigate('compose', selectedDate)} className="btn-primary btn-sm">
                  <Plus size={14} />
                  <span>Schedule Content</span>
                </button>
              </div>
            ) : (
              selectedDatePosts.map((post) => {
                const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms];
                const timeString = post.scheduled_for ? post.scheduled_for.split(' ')[1]?.substring(0, 5) : 'Anytime';

                return (
                  <div
                    key={post.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '0.95rem',
                      backgroundColor: 'var(--bg-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${getStatusBadgeClass(post.status)}`} style={{ fontSize: '0.66rem' }}>
                          {post.status.toUpperCase()}
                        </span>
                        <span className={`badge ${post.publish_mode === 'live' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.64rem' }}>
                          {getPublishModeLabel(post.publish_mode, appMode)}
                        </span>
                        {platforms.filter(Boolean).map((pl, idx) => (
                          <span key={idx} className="badge badge-primary" style={{ fontSize: '0.66rem' }}>
                            {pl}
                          </span>
                        ))}
                      </div>

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Clock size={12} color="var(--primary)" />
                        {timeString}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        margin: 0,
                        lineHeight: 1.48,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {post.content}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border-light)' }}>
                      <button onClick={() => handleOpenView(post)} className="btn-secondary btn-sm">
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                      <button onClick={() => handleOpenEdit(post)} className="btn-secondary btn-sm">
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="btn-secondary btn-sm"
                        style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Full Content Agenda Section */}
      <div className="clean-card" style={{ padding: '1.45rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            paddingBottom: '0.8rem',
            borderBottom: '1px solid var(--border-light)'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Complete Content Agenda</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              All filtered posts arranged for quick inspection, editing, and cleanup.
            </p>
          </div>
          <span className="badge badge-primary">
            Showing {filteredPosts.length} item{filteredPosts.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <div className="empty-state-icon">
              <CalendarIcon size={22} />
            </div>
            <div className="empty-state-title">No content matches "{filter}"</div>
            <div className="empty-state-desc">
              Switch back to "All" or create a new post inside Compose Studio.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
            {filteredPosts.map((post) => {
              const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms];
              const dateDisplay = post.scheduled_for || post.created_at || 'Undated';

              return (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '1.05rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.8rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span className={`badge ${getStatusBadgeClass(post.status)}`} style={{ fontSize: '0.67rem' }}>
                          {post.status.toUpperCase()}
                        </span>
                        <span className={`badge ${post.publish_mode === 'live' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.64rem' }}>
                          {getPublishModeLabel(post.publish_mode, appMode)}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} color="var(--primary)" />
                        {dateDisplay}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                      {platforms.filter(Boolean).map((pl, idx) => (
                        <span key={idx} className="badge badge-primary" style={{ fontSize: '0.66rem' }}>
                          {pl}
                        </span>
                      ))}
                    </div>

                    <p
                      style={{
                        fontSize: '0.86rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.48,
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {post.content}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.45rem', paddingTop: '0.55rem', borderTop: '1px solid var(--border-light)' }}>
                    <button onClick={() => handleOpenView(post)} className="btn-secondary btn-sm">
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                    <button onClick={() => handleOpenEdit(post)} className="btn-secondary btn-sm">
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="btn-secondary btn-sm"
                      style={{ backgroundColor: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VIEW POST MODAL */}
      {viewingPost && (
        <div className="ss-modal-backdrop" onClick={() => setViewingPost(null)}>
          <div className="ss-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div className="ss-icon-badge" style={{ width: '34px', height: '34px', backgroundColor: 'var(--lavender)', color: 'var(--primary)' }}>
                  <Eye size={16} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Post Details</h3>
              </div>
              <button
                onClick={() => setViewingPost(null)}
                style={{ background: 'var(--bg-muted)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.05rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={`badge ${getStatusBadgeClass(viewingPost.status)}`}>
                    {viewingPost.status.toUpperCase()}
                  </span>
                  <span className={`badge ${viewingPost.publish_mode === 'live' ? 'badge-success' : 'badge-neutral'}`}>
                    {getPublishModeLabel(viewingPost.publish_mode, appMode)}
                  </span>
                  {viewingPost.media_type && viewingPost.media_type !== 'none' && (
                    <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                      {viewingPost.media_type}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} color="var(--primary)" />
                  {viewingPost.scheduled_for || viewingPost.published_at || viewingPost.created_at || 'Not scheduled'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Target Platforms:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(Array.isArray(viewingPost.platforms) ? viewingPost.platforms : [viewingPost.platforms]).filter(Boolean).map((pl, idx) => (
                    <span key={idx} className="badge badge-primary">
                      {pl}
                    </span>
                  ))}
                </div>
              </div>

              {isSafeHttpUrl(viewingPost.media_url, true) && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '240px', backgroundColor: '#000' }}>
                  {viewingPost.media_type === 'video' ? (
                    <video src={viewingPost.media_url} controls style={{ width: '100%', maxHeight: '240px', display: 'block' }} />
                  ) : (
                    <img src={viewingPost.media_url} alt="Post attachment" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} />
                  )}
                </div>
              )}

              <div
                style={{
                  backgroundColor: 'var(--bg-muted)',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {viewingPost.video_title && (
                  <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{viewingPost.video_title}</div>
                )}
                {viewingPost.content}
              </div>

              {viewingPost.error_message && (
                <div className="ss-alert ss-alert-danger" style={{ fontSize: '0.8rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{viewingPost.error_message}</span>
                </div>
              )}

              {Array.isArray(viewingPost.publish_results) && viewingPost.publish_results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Per-Channel Publishing Log:
                  </span>
                  {viewingPost.publish_results.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '0.77rem',
                        padding: '0.5rem 0.7rem',
                        borderRadius: '10px',
                        backgroundColor: r.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                        border: `1px solid ${r.success ? 'var(--success-border)' : 'var(--danger-border)'}`,
                        color: r.success ? 'var(--success)' : 'var(--danger)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span>
                        <strong>{r.platform}:</strong>{' '}
                        {r.success
                          ? r.simulated
                            ? r.label || (r.mode === 'demo' || isDemoMode ? 'Demo Published (Simulated)' : 'Simulated in Sandbox')
                            : `Published (${r.external_post_id || 'Live'})`
                          : r.error || 'Failed'}
                      </span>
                      {isSafeHttpUrl(r.permalink) && (
                        <a
                          href={r.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'underline' }}
                        >
                          <span>View Live</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                {isDemoMode && viewingPost.status !== 'published' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickDemoPublish(viewingPost)}
                    className="btn-secondary"
                    style={{ borderColor: 'var(--success-border)', color: 'var(--success)', backgroundColor: 'var(--success-bg)' }}
                  >
                    <CheckCircle2 size={15} />
                    <span>{loading ? 'Publishing...' : 'Demo Publish Now'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingPost;
                    setViewingPost(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="btn-primary"
                >
                  <Edit3 size={15} />
                  <span>Edit Post</span>
                </button>
                <button type="button" onClick={() => setViewingPost(null)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <div className="ss-modal-backdrop" onClick={() => setEditingPost(null)}>
          <div className="ss-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div className="ss-icon-badge" style={{ width: '34px', height: '34px', backgroundColor: 'var(--lavender)', color: 'var(--primary)' }}>
                  <Edit3 size={16} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Edit Post</h3>
              </div>
              <button
                onClick={() => setEditingPost(null)}
                style={{ background: 'var(--bg-muted)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {editErrorMsg && (
                <div className="ss-alert ss-alert-danger" style={{ fontSize: '0.8rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{editErrorMsg}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Post Content</label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className={isDemoMode ? 'form-group' : 'ss-grid-2'} style={{ gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="form-input">
                    <option value="draft">Draft (Saved for review)</option>
                    <option value="scheduled">Scheduled (Auto-run at time)</option>
                    <option value="published">{isDemoMode ? 'Demo Publish (Simulate now)' : 'Publish Live (Requires OAuth)'}</option>
                  </select>
                </div>

                {!isDemoMode && (
                  <div className="form-group">
                    <label className="form-label">Publish Mode</label>
                    <select value={editPublishMode} onChange={(e) => setEditPublishMode(e.target.value)} className="form-input">
                      <option value="sandbox">Local Draft / Sandbox</option>
                      <option value="live">Live Mode (OAuth Required)</option>
                    </select>
                  </div>
                )}
              </div>

              {editStatus === 'scheduled' && (
                <div className="form-group">
                  <label className="form-label">Scheduled Date &amp; Time</label>
                  <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="form-input" />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.4rem' }}>
                <button type="button" onClick={() => setEditingPost(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
