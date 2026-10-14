import React, { useState } from 'react';
import { 
  Check, 
  Clock, 
  Send, 
  FileText, 
  Image as ImageIcon, 
  Hash, 
  Eye, 
  AlertCircle, 
  CheckCircle2,
  Calendar,
  Sparkles,
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  Repeat2
} from 'lucide-react';
import { api } from '../services/api';

export default function Compose({ onPostCreated, onNavigate }) {
  // Step 1: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Instagram', 'X']);
  
  // Step 2: Content
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80');
  
  // Step 3: Scheduling Mode
  const [postMode, setPostMode] = useState('schedule'); // 'publish', 'schedule', 'draft'
  const [scheduleDate, setScheduleDate] = useState('2026-10-18T14:30');
  
  // Preview & Status
  const [previewTab, setPreviewTab] = useState('Instagram');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const platforms = [
    { name: 'Instagram', followers: '142.5K', icon: '📸' },
    { name: 'Facebook', followers: '88.4K', icon: '👤' },
    { name: 'X', followers: '65.2K', icon: '🐦' },
    { name: 'LinkedIn', followers: '34.1K', icon: '💼' },
    { name: 'YouTube', followers: '52.9K', icon: '▶️' },
    { name: 'TikTok', followers: '215.4K', icon: '🎵' }
  ];

  const quickHashtags = ['#SocialSync', '#MarketingTips', '#CreatorEconomy', '#Growth2026', '#SocialMedia'];

  const sampleImages = [
    { label: 'Analytics Dashboard', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80' },
    { label: 'Team Work', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80' },
    { label: 'Podcast Microphone', url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80' },
    { label: 'Phone App Preview', url: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80' }
  ];

  const togglePlatform = (name) => {
    if (selectedPlatforms.includes(name)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== name));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, name]);
    }
  };

  const handleAddHashtag = (tag) => {
    setContent(prev => (prev ? `${prev} ${tag}` : tag));
  };

  const handleAction = async (mode) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!content.trim()) {
      setErrorMsg('Please write something in your post before submitting.');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setErrorMsg('Please select at least one social media platform.');
      return;
    }

    setLoading(true);
    const postPayload = {
      content: content.trim(),
      platforms: selectedPlatforms,
      media_url: mediaUrl || null,
      status: mode === 'publish' ? 'published' : (mode === 'schedule' ? 'scheduled' : 'draft'),
      scheduled_for: mode === 'schedule' ? scheduleDate.replace('T', ' ') + ':00' : null
    };

    try {
      const created = await api.createPost(postPayload);
      if (mode === 'publish') {
        setSuccessMsg('Your post has been published live to your selected channels!');
      } else if (mode === 'schedule') {
        setSuccessMsg(`Your post has been scheduled for ${scheduleDate.replace('T', ' at ')}!`);
      } else {
        setSuccessMsg('Your post has been saved as a draft.');
      }
      if (onPostCreated) onPostCreated(created);
      setTimeout(() => {
        onNavigate('calendar');
      }, 1400);
    } catch (err) {
      setErrorMsg('Could not connect to backend. Changes were saved to local storage.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
      gap: '2rem',
      alignItems: 'start'
    }} className="animate-fade-in">
      {/* Left Column: Guided 3-Step Creator */}
      <div className="clean-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Create New Post</h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
            Follow the 3 simple steps below to publish or schedule your content.
          </p>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Choose Platforms */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              1
            </span>
            <label style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Choose Social Media Platforms
            </label>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', marginLeft: '32px' }}>
            Click the channels where you want this post to appear:
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
            gap: '0.65rem',
            marginLeft: '32px'
          }}>
            {platforms.map(pl => {
              const isSelected = selectedPlatforms.includes(pl.name);
              return (
                <button
                  key={pl.name}
                  type="button"
                  onClick={() => togglePlatform(pl.name)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    backgroundColor: isSelected ? 'var(--lavender)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{pl.icon}</span>
                  <span>{pl.name}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {pl.followers}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Create Content */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              2
            </span>
            <label style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Write Your Post & Add Media
            </label>
          </div>

          <div style={{ marginLeft: '32px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Caption Textarea */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Post Caption
                </span>
                <span style={{ fontSize: '0.75rem', color: content.length > 280 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {content.length} characters (X limit: 280)
                </span>
              </div>
              <textarea
                rows={5}
                placeholder="What's on your mind? Share an update, helpful tip, or announcement..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="form-input"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Hashtag Suggestions */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Click to add popular hashtags:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {quickHashtags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddHashtag(tag)}
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Attachment */}
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Image Attachment (Optional URL)
              </span>
              <input
                type="url"
                placeholder="Paste an image URL (https://...)"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="form-input"
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                  Or select sample:
                </span>
                {sampleImages.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMediaUrl(s.url)}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: mediaUrl === s.url ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                      backgroundColor: mediaUrl === s.url ? 'var(--lavender)' : 'var(--bg-muted)',
                      color: mediaUrl === s.url ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
                {mediaUrl && (
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer'
                    }}
                  >
                    Remove Image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 3: Choose When to Post */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              3
            </span>
            <label style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Publish or Schedule
            </label>
          </div>

          <div style={{ marginLeft: '32px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* 3 Clear Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {/* Button 1: Save Draft */}
              <button
                type="button"
                onClick={() => handleAction('draft')}
                disabled={loading}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.85rem',
                  alignItems: 'flex-start',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.9rem' }}>
                  <FileText size={16} />
                  <span>Save Draft</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 400 }}>
                  Save your ideas to edit and publish later.
                </span>
              </button>

              {/* Button 2: Schedule Post */}
              <button
                type="button"
                onClick={() => handleAction('schedule')}
                disabled={loading}
                className="btn-primary"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.85rem',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  backgroundColor: 'var(--primary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.9rem' }}>
                  <Calendar size={16} />
                  <span>Schedule Post</span>
                </div>
                <span style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '4px', fontWeight: 400 }}>
                  Publish automatically on your selected date.
                </span>
              </button>

              {/* Button 3: Publish Now */}
              <button
                type="button"
                onClick={() => handleAction('publish')}
                disabled={loading}
                className="btn-primary"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.85rem',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  backgroundColor: 'var(--secondary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.9rem' }}>
                  <Send size={16} />
                  <span>Publish Now</span>
                </div>
                <span style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '4px', fontWeight: 400 }}>
                  Send immediately to your active channels.
                </span>
              </button>
            </div>

            {/* Schedule Date Input */}
            <div style={{
              backgroundColor: 'var(--bg-muted)',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <Clock size={18} color="var(--primary)" />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Selected Date & Time for Automatic Publishing:
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.6rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    width: '100%',
                    marginTop: '4px'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Mockup Preview */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Eye size={17} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Live Preview</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {['Instagram', 'X'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPreviewTab(tab)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  border: previewTab === tab ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: previewTab === tab ? 'var(--lavender)' : 'transparent',
                  color: previewTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Live Social Card */}
        <div className="clean-card" style={{ maxWidth: '420px', margin: '0 auto' }}>
          {previewTab === 'Instagram' ? (
            /* Instagram Post Preview */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
                  alt="Profile" 
                  style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }} 
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>socialsync_app</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Instagram Feed Preview</div>
                </div>
              </div>

              {mediaUrl && (
                <div style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  maxHeight: '300px',
                  marginBottom: '0.75rem',
                  backgroundColor: '#000'
                }}>
                  <img src={mediaUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', gap: '0.85rem' }}>
                  <ThumbsUp size={18} color="var(--primary)" />
                  <MessageCircle size={18} />
                  <Share2 size={18} />
                </div>
                <Bookmark size={18} />
              </div>

              <div style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
                <strong style={{ marginRight: '6px' }}>socialsync_app</strong>
                {content || "Your caption will appear here as you type in Step 2..."}
              </div>
            </div>
          ) : (
            /* X / Twitter Preview */
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
                alt="Profile" 
                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} 
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>SocialSync Tech</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>@socialsync_live</span>
                </div>
                <p style={{ fontSize: '0.88rem', lineHeight: 1.45, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  {content || "Your tweet update will appear here in real-time as you type..."}
                </p>

                {mediaUrl && (
                  <div style={{
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    maxHeight: '200px',
                    marginBottom: '0.75rem'
                  }}>
                    <img src={mediaUrl} alt="X media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', maxWidth: '280px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}><MessageCircle size={14} /> 8</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}><Repeat2 size={14} /> 24</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}><ThumbsUp size={14} /> 140</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}><Share2 size={14} /></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
