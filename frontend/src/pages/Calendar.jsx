import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Trash2, 
  Edit3, 
  Eye, 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  AlertCircle,
  Share2,
  CalendarDays
} from 'lucide-react';
import { api } from '../services/api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Calendar({ posts = [], onPostUpdated, onPostDeleted, onNavigate }) {
  const [filter, setFilter] = useState('all'); // 'all', 'scheduled', 'published', 'draft'
  
  // Default to October 2026 based on mock posts and current date context
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9); // 0-indexed, 9 = October
  const [selectedDate, setSelectedDate] = useState('2026-10-14');

  // Modals state
  const [viewingPost, setViewingPost] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState('scheduled');
  const [editDate, setEditDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Status explanations for beginners
  const statusDescriptions = {
    all: 'Showing all content across your calendar: scheduled posts, published posts, and saved drafts.',
    scheduled: 'Scheduled: Posts queued to automatically release at their designated date and time.',
    published: 'Published: Content that is currently live and viewable by your audience.',
    draft: 'Drafts: Ideas and work-in-progress posts saved for future refinement.'
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleOpenView = (post) => {
    setViewingPost(post);
  };

  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditStatus(post.status);
    setEditDate(post.scheduled_for ? post.scheduled_for.replace(' ', 'T').substring(0, 16) : '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPost) return;

    setLoading(true);
    try {
      const updated = await api.updatePost(editingPost.id, {
        content: editContent,
        status: editStatus,
        scheduled_for: editDate ? editDate.replace('T', ' ') + ':00' : null
      });
      if (onPostUpdated) onPostUpdated(updated);
      setEditingPost(null);
      setFeedback('Post updated successfully!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update post.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      try {
        await api.deletePost(postId);
        if (onPostDeleted) onPostDeleted(postId);
        if (viewingPost?.id === postId) setViewingPost(null);
        setFeedback('Post deleted successfully.');
        setTimeout(() => setFeedback(null), 3000);
      } catch (err) {
        console.error(err);
        alert('Failed to delete post.');
      }
    }
  };

  // Month navigation calculations
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Helper to get posts for any specific date string "YYYY-MM-DD"
  const getPostsForDateString = (dateStr) => {
    return filteredPosts.filter(p => {
      const check = p.scheduled_for || p.created_at;
      return check && check.startsWith(dateStr);
    });
  };

  // Helper to get posts for day of current month
  const getPostsForDay = (day) => {
    const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getPostsForDateString(dayStr);
  };

  // Posts for currently selected date
  const selectedDatePosts = getPostsForDateString(selectedDate);

  // Format selected date nicely for human display
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }} className="animate-fade-in">
      {/* Top Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        {/* Filter Pills with Real Counts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { id: 'all', label: 'All Content', count: posts.length },
            { id: 'scheduled', label: 'Scheduled', count: posts.filter(p => p.status === 'scheduled').length },
            { id: 'published', label: 'Published', count: posts.filter(p => p.status === 'published').length },
            { id: 'draft', label: 'Drafts', count: posts.filter(p => p.status === 'draft').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-full)',
                border: filter === tab.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                backgroundColor: filter === tab.id ? 'var(--lavender)' : 'var(--bg-surface)',
                color: filter === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                backgroundColor: filter === tab.id ? 'var(--primary)' : 'var(--bg-muted)',
                color: filter === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 7px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Schedule Post Action Button */}
        <button
          onClick={() => onNavigate('compose')}
          className="btn-primary"
          style={{ padding: '0.55rem 1.25rem', fontSize: '0.86rem' }}
        >
          <Plus size={16} />
          <span>Schedule Post</span>
        </button>
      </div>

      {/* Helpful Context Callout */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>{statusDescriptions[filter]} Click any calendar date to view its scheduled queue on the right.</span>
      </div>

      {/* Action Feedback alert */}
      {feedback && (
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
          <span>{feedback}</span>
        </div>
      )}

      {/* BALANCED 2-COLUMN LAYOUT: Compact Calendar Left, Selected-Date Agenda Right */}
      <div className="calendar-grid-layout" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.95fr)',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* LEFT COLUMN: Compact Monthly Calendar */}
        <div className="clean-card" style={{ padding: '1.25rem' }}>
          {/* Month Navigation Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-light)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={handlePrevMonth}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.6rem' }}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => {
                  setCurrentMonth(9);
                  setCurrentYear(2026);
                  setSelectedDate('2026-10-14');
                }}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 600 }}
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.6rem' }}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ padding: '0.35rem 0' }}>{d}</div>
            ))}
          </div>

          {/* Compact Calendar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px'
          }}>
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div 
                key={`empty-${i}`} 
                style={{ 
                  height: '56px', 
                  backgroundColor: 'var(--bg-muted)', 
                  borderRadius: 'var(--radius-sm)',
                  opacity: 0.25 
                }} 
              />
            ))}

            {/* Actual Days of the Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPosts = getPostsForDay(day);
              const isToday = currentMonth === 9 && currentYear === 2026 && day === 14;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    height: '56px',
                    backgroundColor: isSelected 
                      ? 'var(--lavender)' 
                      : isToday 
                        ? 'rgba(108, 92, 231, 0.08)' 
                        : 'var(--bg-surface)',
                    border: isSelected 
                      ? '2px solid var(--primary)' 
                      : isToday 
                        ? '1.5px solid var(--primary)' 
                        : '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                  }}
                  title={`${dateStr} — ${dayPosts.length} post(s)`}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: isSelected || isToday ? 800 : 600,
                      color: isSelected 
                        ? 'var(--primary)' 
                        : isToday 
                          ? 'var(--primary)' 
                          : 'var(--text-primary)'
                    }}>
                      {day}
                    </span>
                    {isToday && (
                      <span style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        Today
                      </span>
                    )}
                  </div>

                  {/* Indicator Dots / Mini Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                    {dayPosts.slice(0, 3).map((p, pIdx) => (
                      <span
                        key={pIdx}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: p.status === 'published' ? 'var(--success)' :
                                           p.status === 'scheduled' ? 'var(--primary)' : 'var(--warning)',
                          display: 'inline-block'
                        }}
                      />
                    ))}
                    {dayPosts.length > 3 && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        +{dayPosts.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected-Date Agenda */}
        <div className="clean-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarDays size={18} color="var(--primary)" />
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {formatSelectedDateHuman(selectedDate)}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {selectedDatePosts.length} post{selectedDatePosts.length === 1 ? '' : 's'} on this date
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('compose')}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            >
              <Plus size={14} />
              <span>Add Post</span>
            </button>
          </div>

          {/* Agenda Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {selectedDatePosts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)'
              }}>
                <Clock size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.7 }} />
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  No posts scheduled for this date
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                  Plan ahead and maintain an active social presence by scheduling content for this day.
                </p>
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
              selectedDatePosts.map(post => {
                const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms];
                const timeString = post.scheduled_for ? post.scheduled_for.split(' ')[1]?.substring(0, 5) : 'Anytime';

                return (
                  <div
                    key={post.id}
                    style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${
                          post.status === 'published' ? 'badge-success' : 
                          post.status === 'scheduled' ? 'badge-primary' : 'badge-warning'
                        }`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                          {post.status.toUpperCase()}
                        </span>
                        {platforms.map((pl, idx) => (
                          <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                            {pl}
                          </span>
                        ))}
                      </div>

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} />
                        {timeString}
                      </span>
                    </div>

                    <p style={{
                      fontSize: '0.86rem',
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {post.content}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '0.45rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border-light)'
                    }}>
                      <button
                        onClick={() => handleOpenView(post)}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        title="View Full Post"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(post)}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        title="Edit Post"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        style={{
                          backgroundColor: 'var(--danger-bg)',
                          border: 'none',
                          color: 'var(--danger)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Delete Post"
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

      {/* COMPREHENSIVE AGENDA OVERVIEW SECTION BELOW CALENDAR */}
      <div className="clean-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Complete Content Agenda
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Full chronological list of all scheduled posts, live releases, and draft concepts.
            </p>
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Showing {filteredPosts.length} item{filteredPosts.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <CalendarIcon size={24} />
            <div className="empty-state-title">No content matches "{filter}"</div>
            <div className="empty-state-desc">Try selecting "All Content" or create a new post to get started.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {filteredPosts.map(post => {
              const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms];
              const dateDisplay = post.scheduled_for || post.created_at || 'Undated';

              return (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className={`badge ${
                        post.status === 'published' ? 'badge-success' : 
                        post.status === 'scheduled' ? 'badge-primary' : 'badge-warning'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {post.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {dateDisplay}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                      {platforms.map((pl, idx) => (
                        <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          {pl}
                        </span>
                      ))}
                    </div>

                    <p style={{
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.45,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {post.content}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                    <button
                      onClick={() => handleOpenView(post)}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(post)}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      style={{
                        backgroundColor: 'var(--danger-bg)',
                        border: 'none',
                        color: 'var(--danger)',
                        padding: '0.35rem 0.65rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div 
            className="clean-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Post Preview</h3>
              </div>
              <button 
                onClick={() => setViewingPost(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className={`badge ${
                  viewingPost.status === 'published' ? 'badge-success' : 
                  viewingPost.status === 'scheduled' ? 'badge-primary' : 'badge-warning'
                }`}>
                  {viewingPost.status.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} />
                  {viewingPost.scheduled_for || viewingPost.created_at || 'Not scheduled'}
                </span>
              </div>

              {/* Target Platforms */}
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Target Platforms:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(Array.isArray(viewingPost.platforms) ? viewingPost.platforms : [viewingPost.platforms]).map((pl, idx) => (
                    <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                      {pl}
                    </span>
                  ))}
                </div>
              </div>

              {/* Post Content Box */}
              <div style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap'
              }}>
                {viewingPost.content}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingPost;
                    setViewingPost(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1.15rem' }}
                >
                  <Edit3 size={15} />
                  <span>Edit Post</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingPost(null)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.15rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div 
            className="clean-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Edit Scheduled Post</h3>
              </div>
              <button 
                onClick={() => setEditingPost(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="form-input"
                >
                  <option value="draft">Draft (Saved for review)</option>
                  <option value="scheduled">Scheduled (Will publish automatically)</option>
                  <option value="published">Published (Live now)</option>
                </select>
              </div>

              {editStatus === 'scheduled' && (
                <div className="form-group">
                  <label className="form-label">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
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
