import React, { useState, useRef } from 'react';
import {
  Clock,
  Send,
  FileText,
  Eye,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  Repeat2,
  Upload,
  Target,
  Info,
  ShieldCheck,
  FlaskConical,
  Film,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { api, isSafeHttpUrl } from '../services/api';

function inferMediaTypeFromUrl(url) {
  if (!url) return 'none';
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi)$/.test(clean)) return 'video';
  return 'image';
}

const OFFICIAL_PLATFORMS = ['Instagram', 'Facebook', 'YouTube'];

export default function Compose({ accounts = [], campaigns = [], onPostCreated, onNavigate }) {
  // Step 0: Publishing Environment Mode (strict separation between Live & Sandbox)
  const [publishMode, setPublishMode] = useState('sandbox');

  // Step 1: Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Instagram', 'Facebook']);

  // Step 2: Content & Media
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80');
  const [mediaType, setMediaType] = useState('image');
  const [videoTitle, setVideoTitle] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState('private');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Step 3: Scheduling Date (Defaults dynamically to tomorrow at 12:00 PM local time)
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${tmrw.getFullYear()}-${pad(tmrw.getMonth() + 1)}-${pad(tmrw.getDate())}T12:00`;
  });

  // Preview & Status
  const [previewTab, setPreviewTab] = useState('Instagram');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [publishReport, setPublishReport] = useState(null);

  // Platforms definition synchronized with connected accounts
  const defaultPlatforms = [
    { name: 'Instagram', followers: '142.5K', icon: '📸', connected: true, oauthConnected: false, mode: 'sandbox' },
    { name: 'Facebook', followers: '88.4K', icon: '👤', connected: true, oauthConnected: false, mode: 'sandbox' },
    { name: 'X', followers: '65.2K', icon: '🐦', connected: true, oauthConnected: false, mode: 'sandbox' },
    { name: 'LinkedIn', followers: '34.1K', icon: '💼', connected: true, oauthConnected: false, mode: 'sandbox' },
    { name: 'YouTube', followers: '52.9K', icon: '▶️', connected: true, oauthConnected: false, mode: 'sandbox' },
    { name: 'TikTok', followers: '215.4K', icon: '🎵', connected: true, oauthConnected: false, mode: 'sandbox' }
  ];

  const platformIcons = {
    Instagram: '📸',
    Facebook: '👤',
    X: '🐦',
    LinkedIn: '💼',
    YouTube: '▶️',
    TikTok: '🎵'
  };

  // Deduplicate accounts just in case
  const uniqueAccounts = accounts.reduce((acc, current) => {
    if (!acc.find(item => item.platform?.toLowerCase() === current.platform?.toLowerCase())) {
      acc.push(current);
    }
    return acc;
  }, []);

  const availablePlatforms = uniqueAccounts.length > 0
    ? uniqueAccounts.map(a => ({
        name: a.platform,
        followers: a.followers >= 1000 ? `${(a.followers / 1000).toFixed(1)}K` : `${a.followers}`,
        icon: platformIcons[a.platform] || '📱',
        connected: a.connected !== 0,
        oauthConnected: Boolean(a.oauth_connected),
        mode: a.mode || (a.oauth_connected ? 'live' : 'sandbox'),
        handle: a.handle,
        nameLabel: a.name
      }))
    : defaultPlatforms;

  const quickHashtags = ['#SocialSync', '#MarketingTips', '#CreatorEconomy', '#Growth2026', '#SocialMedia'];

  const sampleImages = [
    { label: 'Analytics Dashboard', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80' },
    { label: 'Team Work', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80' },
    { label: 'Podcast Microphone', url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80' },
    { label: 'Phone App Preview', url: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80' }
  ];

  // Compute live pre-flight warnings so users see official API requirements clearly
  const getLiveCompatibilityWarnings = () => {
    if (publishMode !== 'live') return [];
    const warnings = [];
    const activeType = mediaUrl ? mediaType : 'none';
    const isLocalUrl = Boolean(mediaUrl) && (/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(mediaUrl) || mediaUrl.startsWith('/uploads'));

    for (const plName of selectedPlatforms) {
      const plObj = availablePlatforms.find(p => p.name === plName);
      if (!OFFICIAL_PLATFORMS.includes(plName)) {
        warnings.push(`${plName} is Sandbox-only and does not support Live API publishing.`);
        continue;
      }
      if (!plObj?.oauthConnected) {
        warnings.push(`${plName} OAuth account is not connected yet. Connect it in Accounts before publishing live.`);
      }
      if (plName === 'Instagram') {
        if (activeType === 'none') {
          warnings.push('Instagram Graph API does not support text-only posts. Attach an image or Reels video.');
        } else if (isLocalUrl) {
          warnings.push('Instagram Graph API requires a publicly reachable HTTPS media URL (configure PUBLIC_BASE_URL or paste a public URL).');
        }
      }
      if (plName === 'YouTube' && activeType !== 'video') {
        warnings.push('YouTube Data API v3 only supports video uploads (text-only and image posts are rejected).');
      }
    }
    return warnings;
  };

  const liveWarnings = getLiveCompatibilityWarnings();

  const togglePlatform = (pl) => {
    if (!pl.connected) {
      setErrorMsg(`${pl.name} is currently paused in Connected Accounts. Enable it before publishing.`);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    if (selectedPlatforms.includes(pl.name)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== pl.name));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, pl.name]);
    }
  };

  const handleAddHashtag = (tag) => {
    setContent(prev => (prev ? `${prev} ${tag}` : tag));
  };

  const handleMediaUrlChange = (nextUrl) => {
    setMediaUrl(nextUrl);
    setMediaType(nextUrl ? inferMediaTypeFromUrl(nextUrl) : 'none');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      const uploaded = await api.uploadMedia(file);
      const nextUrl = typeof uploaded === 'string' ? uploaded : uploaded.url;
      const nextType = typeof uploaded === 'string'
        ? inferMediaTypeFromUrl(nextUrl)
        : (uploaded.media_type || inferMediaTypeFromUrl(nextUrl));
      setMediaUrl(nextUrl);
      setMediaType(nextType);
      setSuccessMsg(`${nextType === 'video' ? 'Video' : 'Image'} uploaded (${uploaded.filename || 'file'}) and attached to your post.`);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload media file. Supported images/videos up to 256MB.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAction = async (actionMode) => {
    setErrorMsg('');
    setSuccessMsg('');
    setPublishReport(null);

    if (!content.trim()) {
      setErrorMsg('Please write something in your post before submitting.');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setErrorMsg('Please select at least one active social media platform.');
      return;
    }

    if (mediaUrl && !isSafeHttpUrl(mediaUrl, true)) {
      setErrorMsg('Media URL must start with http://, https://, or be an uploaded /uploads/ path.');
      return;
    }

    setLoading(true);
    const activeMediaType = mediaUrl ? mediaType : 'none';
    const postPayload = {
      content: content.trim(),
      platforms: selectedPlatforms,
      media_url: mediaUrl || null,
      media_type: activeMediaType,
      campaign_id: selectedCampaignId ? Number(selectedCampaignId) : null,
      status: actionMode === 'publish' ? 'published' : (actionMode === 'schedule' ? 'scheduled' : 'draft'),
      scheduled_for: actionMode === 'schedule' ? scheduleDate.replace('T', ' ') + ':00' : null,
      publish_mode: publishMode,
      video_title: videoTitle.trim() || null,
      youtube_privacy: youtubePrivacy
    };

    try {
      const created = await api.createPost(postPayload);
      const results = created.publish_results || [];
      if (onPostCreated) onPostCreated(created);

      if (actionMode === 'publish') {
        setPublishReport({
          mode: created.publish_mode || publishMode,
          status: created.status,
          results,
          error_message: created.error_message
        });
        if (publishMode === 'sandbox') {
          setSuccessMsg('Simulated publish completed in Sandbox Mode (no external social accounts were modified).');
          setTimeout(() => onNavigate('calendar'), 1500);
        } else if (created.status === 'partial') {
          setErrorMsg(created.error_message || 'Post succeeded on some Live channels but failed on others. See channel report below.');
        } else {
          setSuccessMsg('Post published to your Live connected social media channel(s)!');
        }
      } else if (actionMode === 'schedule') {
        const modeLabel = publishMode === 'live' ? 'Live OAuth Auto-Publish' : 'Sandbox Simulation';
        setSuccessMsg(`Scheduled (${modeLabel}) for ${scheduleDate.replace('T', ' at ')}.`);
        setTimeout(() => onNavigate('calendar'), 1500);
      } else {
        setSuccessMsg('Your post has been saved as a draft.');
        setTimeout(() => onNavigate('calendar'), 1200);
      }
    } catch (err) {
      if (err.data?.id && onPostCreated) {
        onPostCreated(err.data);
      }
      if (err.data?.publish_results) {
        setPublishReport({
          mode: err.data.publish_mode || publishMode,
          status: err.data.status || 'failed',
          results: err.data.publish_results,
          error_message: err.data.error_message || err.message
        });
      }
      setErrorMsg(err.data?.error_message || err.message || 'Publishing failed. Check backend connection and OAuth status.');
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
            Choose Live Mode (official OAuth APIs) or Sandbox Mode (safe demo simulation), then compose text, image, or video content.
          </p>
        </div>

        {/* Strict Live Mode vs Sandbox Mode Switcher */}
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-muted)',
          border: `1.5px solid ${publishMode === 'live' ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-light)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Publishing Mode
            </span>
            <div style={{ display: 'inline-flex', backgroundColor: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => setPublishMode('sandbox')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: publishMode === 'sandbox' ? 'var(--primary)' : 'transparent',
                  color: publishMode === 'sandbox' ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                <FlaskConical size={13} />
                <span>Sandbox Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setPublishMode('live')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: publishMode === 'live' ? 'var(--success)' : 'transparent',
                  color: publishMode === 'live' ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                <ShieldCheck size={13} />
                <span>Live Mode (Real API)</span>
              </button>
            </div>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {publishMode === 'live'
              ? 'Posts will be sent directly to your authorized Instagram, Facebook Page, or YouTube OAuth accounts. Errors are reported without fake success.'
              : 'Simulation only: tests drafting, scheduling, and mock metrics locally without touching real social accounts.'}
          </div>
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
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
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
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Per-channel API Outcome Report */}
        {publishReport && publishReport.results?.length > 0 && (
          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-muted)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Channel Publishing Report ({(publishReport.mode || publishMode).toUpperCase()} — {(publishReport.status || '').toUpperCase()})
              </span>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.74rem' }}
              >
                Open Calendar
              </button>
            </div>
            {publishReport.results.map((r, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: r.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: r.success ? 'var(--success)' : 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <span>
                  <strong>{r.platform}:</strong>{' '}
                  {r.success
                    ? (r.simulated ? 'Simulated (Sandbox)' : `Published${r.external_post_id ? ` (ID: ${r.external_post_id})` : ''}`)
                    : (r.error || 'Publishing failed')}
                </span>
                {isSafeHttpUrl(r.permalink) && (
                  <a
                    href={r.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'underline' }}
                  >
                    <span>View Live Post</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: Choose Platforms (Synced with Accounts) */}
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
            Select active destination channels. Official Live OAuth status is shown on each card:
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
            gap: '0.65rem',
            marginLeft: '32px'
          }}>
            {availablePlatforms.map(pl => {
              const isSelected = selectedPlatforms.includes(pl.name);
              const isDisconnected = !pl.connected;
              const isOfficial = OFFICIAL_PLATFORMS.includes(pl.name);

              return (
                <button
                  key={pl.name}
                  type="button"
                  onClick={() => togglePlatform(pl)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    backgroundColor: isDisconnected
                      ? 'var(--bg-muted)'
                      : (isSelected ? 'var(--lavender)' : 'var(--bg-surface)'),
                    color: isDisconnected
                      ? 'var(--text-muted)'
                      : (isSelected ? 'var(--primary)' : 'var(--text-secondary)'),
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: isDisconnected ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.22rem',
                    opacity: isDisconnected ? 0.6 : 1,
                    transition: 'all 0.15s ease'
                  }}
                  title={isDisconnected ? `${pl.name} is paused` : `${pl.name} (${pl.followers})`}
                >
                  <span style={{ fontSize: '1.1rem' }}>{pl.icon}</span>
                  <span>{pl.name}</span>
                  <span style={{ fontSize: '0.66rem', color: isDisconnected ? 'var(--danger)' : (pl.oauthConnected ? 'var(--success)' : 'var(--text-muted)'), fontWeight: 600 }}>
                    {isDisconnected
                      ? 'Paused'
                      : (pl.oauthConnected ? '● Live OAuth' : (isOfficial ? '○ Sandbox' : '○ Demo Only'))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Create Content, Local Media & Campaign */}
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
              Write Content, Attach Media & Link Campaign
            </label>
          </div>

          <div style={{ marginLeft: '32px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Optional Campaign Association */}
            {campaigns.length > 0 && (
              <div style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem'
              }}>
                <Target size={16} color="var(--primary)" />
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                    Associate with Marketing Campaign (Optional):
                  </label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <option value="">None (Independent Post)</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

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

            {/* Media Attachment: Local Upload (Image or Video) + URL + Presets */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Media Attachment (Text-Only, Image, or Video)
                </span>

                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  {/* Media Type Pill Selector */}
                  <button
                    type="button"
                    onClick={() => setMediaType('image')}
                    className="btn-secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.72rem',
                      borderColor: mediaType === 'image' && mediaUrl ? 'var(--primary)' : undefined,
                      color: mediaType === 'image' && mediaUrl ? 'var(--primary)' : undefined,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <ImageIcon size={12} />
                    <span>Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType('video')}
                    className="btn-secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.72rem',
                      borderColor: mediaType === 'video' && mediaUrl ? 'var(--primary)' : undefined,
                      color: mediaType === 'video' && mediaUrl ? 'var(--primary)' : undefined,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <Film size={12} />
                    <span>Video</span>
                  </button>

                  {/* Local file upload button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="btn-secondary"
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Upload size={13} />
                    <span>{isUploading ? 'Uploading...' : 'Upload Image/Video'}</span>
                  </button>
                </div>
              </div>

              <input
                type="url"
                placeholder="Paste a direct image or video URL (https://...) or leave blank for text-only"
                value={mediaUrl}
                onChange={(e) => handleMediaUrlChange(e.target.value)}
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
                    onClick={() => {
                      setMediaUrl(s.url);
                      setMediaType('image');
                    }}
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
                    onClick={() => {
                      setMediaUrl('');
                      setMediaType('none');
                    }}
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
                    Remove Media (Text Only)
                  </button>
                )}
              </div>
            </div>

            {/* Video Title & YouTube Privacy Options */}
            {(selectedPlatforms.includes('YouTube') || (mediaUrl && mediaType === 'video')) && (
              <div style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Video Title (YouTube / Video Posts)
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to first line of caption"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                  />
                </div>
                {selectedPlatforms.includes('YouTube') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      YouTube Privacy Status
                    </label>
                    <select
                      value={youtubePrivacy}
                      onChange={(e) => setYoutubePrivacy(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                    >
                      <option value="private">Private (Recommended for unverified apps)</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Live Mode Compatibility Pre-flight Warnings */}
            {liveWarnings.length > 0 && (
              <div style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                padding: '0.75rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.79rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                border: '1px solid rgba(239, 68, 68, 0.25)'
              }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertCircle size={15} />
                  <span>Live API Pre-flight Checks</span>
                </strong>
                {liveWarnings.map((w, idx) => (
                  <div key={idx}>• {w}</div>
                ))}
              </div>
            )}
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
                  Save ideas to edit and publish later.
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
                  Auto-publish at designated time.
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
                  backgroundColor: publishMode === 'live' ? 'var(--success)' : 'var(--secondary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.9rem' }}>
                  <Send size={16} />
                  <span>{publishMode === 'live' ? 'Publish Live Now' : 'Simulate Publish'}</span>
                </div>
                <span style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '4px', fontWeight: 400 }}>
                  {publishMode === 'live' ? 'Send directly via official APIs.' : 'Run safe Sandbox simulation.'}
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
                  Target Date & Time for Automated Background Publishing ({publishMode === 'live' ? 'Live OAuth' : 'Sandbox'}):
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

      {/* Right Column: Live Mockup Preview & Environment Indicator */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Eye size={17} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Post Preview</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {['Instagram', 'Facebook', 'YouTube', 'X'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPreviewTab(tab)}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: 'var(--radius-full)',
                  border: previewTab === tab ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                  backgroundColor: previewTab === tab ? 'var(--lavender)' : 'transparent',
                  color: previewTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.76rem',
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
        <div className="clean-card" style={{ maxWidth: '440px', width: '100%' }}>
          {previewTab === 'Instagram' || previewTab === 'Facebook' ? (
            /* Instagram / Facebook Preview */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="Profile"
                    style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {availablePlatforms.find(p => p.name === previewTab)?.handle || 'socialsync_app'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {previewTab} {mediaType === 'video' ? 'Video / Reels' : (mediaUrl ? 'Photo Post' : 'Text Post')}
                    </div>
                  </div>
                </div>
                <span className={`badge ${publishMode === 'live' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                  {publishMode === 'live' ? 'LIVE API' : 'SANDBOX'}
                </span>
              </div>

              {isSafeHttpUrl(mediaUrl, true) && (
                <div style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  maxHeight: '300px',
                  marginBottom: '0.75rem',
                  backgroundColor: '#000'
                }}>
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '300px', display: 'block' }} />
                  ) : (
                    <img src={mediaUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
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
                <strong style={{ marginRight: '6px' }}>{previewTab === 'Facebook' ? 'Page Caption' : 'socialsync_app'}</strong>
                {content || "Your caption will appear here in real-time as you type in Step 2..."}
              </div>
            </div>
          ) : previewTab === 'YouTube' ? (
            /* YouTube Video Preview */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>YouTube Video Upload Preview</span>
                <span className="badge badge-neutral" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {youtubePrivacy}
                </span>
              </div>
              {isSafeHttpUrl(mediaUrl, true) && mediaType === 'video' ? (
                <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#000', marginBottom: '0.75rem' }}>
                  <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '260px', display: 'block' }} />
                </div>
              ) : (
                <div style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  marginBottom: '0.75rem'
                }}>
                  Upload or paste a video URL to preview YouTube upload.
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                {videoTitle.trim() || (content ? content.slice(0, 80) : 'Untitled Video')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {content || 'Video description will appear here...'}
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
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>@socialsync_sandbox</span>
                </div>
                <p style={{ fontSize: '0.88rem', lineHeight: 1.45, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  {content || "Your post copy will appear here in real-time as you type..."}
                </p>

                {isSafeHttpUrl(mediaUrl, true) && (
                  <div style={{
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    maxHeight: '200px',
                    marginBottom: '0.75rem',
                    backgroundColor: '#000'
                  }}>
                    {mediaType === 'video' ? (
                      <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '200px', display: 'block' }} />
                    ) : (
                      <img src={mediaUrl} alt="X media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
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

        {/* Integration Status Notice */}
        <div className="help-box" style={{ fontSize: '0.8rem', padding: '0.75rem' }}>
          <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            {publishMode === 'live' ? (
              <>
                <strong>Live API Environment:</strong> Posts are dispatched to official Meta Graph / YouTube Data API v3 endpoints using backend-encrypted OAuth tokens. Failures are marked <code>FAILED</code> or <code>PARTIAL</code>—never simulated.
              </>
            ) : (
              <>
                <strong>Sandbox Simulation Mode:</strong> Posts generate local demo telemetry inside SQLite and never touch live Facebook Pages, Instagram, or YouTube accounts.
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
