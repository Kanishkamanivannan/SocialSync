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
  Server,
  FlaskConical,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Hash,
  Sparkles,
  Check,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import { api, isSafeHttpUrl } from '../services/api';

function inferMediaTypeFromUrl(url) {
  if (!url) return 'none';
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi)$/.test(clean)) return 'video';
  return 'image';
}

function getDefaultScheduleValue() {
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${tmrw.getFullYear()}-${pad(tmrw.getMonth() + 1)}-${pad(tmrw.getDate())}T12:00`;
}

const DEFAULT_MEDIA_URL =
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80';
const OFFICIAL_PLATFORMS = ['Instagram', 'Facebook', 'YouTube'];

export default function Compose({
  accounts = [],
  campaigns = [],
  posts = [],
  appMode = 'demo',
  backendStatus = 'connected',
  prefillDate = null,
  onPostCreated,
  onPostUpdated,
  onPostDeleted,
  onSwitchAppMode,
  onNavigate
}) {
  const isDemoMode = appMode === 'demo';
  const publishMode = isDemoMode ? 'demo' : 'live';

  const [editingPostId, setEditingPostId] = useState(null);
  const [postListFilter, setPostListFilter] = useState('all');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Instagram', 'Facebook']);

  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState(DEFAULT_MEDIA_URL);
  const [mediaType, setMediaType] = useState('image');
  const [videoTitle, setVideoTitle] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState('private');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [scheduleDate, setScheduleDate] = useState(() =>
    prefillDate ? `${prefillDate}T12:00` : getDefaultScheduleValue()
  );

  const [previewTab, setPreviewTab] = useState('Instagram');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [publishReport, setPublishReport] = useState(null);

  const defaultPlatforms = [
    { name: 'Instagram', followers: '142.5K', icon: '📸', connected: true, oauthConnected: false, mode: 'demo' },
    { name: 'Facebook', followers: '88.4K', icon: '👤', connected: true, oauthConnected: false, mode: 'demo' },
    { name: 'X', followers: '65.2K', icon: '🐦', connected: true, oauthConnected: false, mode: 'demo' },
    { name: 'LinkedIn', followers: '34.1K', icon: '💼', connected: true, oauthConnected: false, mode: 'demo' },
    { name: 'YouTube', followers: '52.9K', icon: '▶️', connected: true, oauthConnected: false, mode: 'demo' },
    { name: 'TikTok', followers: '215.4K', icon: '🎵', connected: true, oauthConnected: false, mode: 'demo' }
  ];

  const platformIcons = {
    Instagram: '📸',
    Facebook: '👤',
    X: '🐦',
    LinkedIn: '💼',
    YouTube: '▶️',
    TikTok: '🎵'
  };

  const uniqueAccounts = accounts.reduce((acc, current) => {
    if (!acc.find((item) => item.platform?.toLowerCase() === current.platform?.toLowerCase())) {
      acc.push(current);
    }
    return acc;
  }, []);

  const availablePlatforms =
    uniqueAccounts.length > 0
      ? uniqueAccounts.map((a) => ({
          name: a.platform,
          followers: a.followers >= 1000 ? `${(a.followers / 1000).toFixed(1)}K` : `${a.followers}`,
          icon: platformIcons[a.platform] || '📱',
          connected: a.connected !== 0,
          oauthConnected: !isDemoMode && Boolean(a.oauth_connected),
          mode: isDemoMode ? 'demo' : a.mode || (a.oauth_connected ? 'live' : 'live'),
          handle: a.handle,
          nameLabel: a.name
        }))
      : defaultPlatforms;

  const quickHashtags = ['#SocialSync', '#MarketingTips', '#CreatorEconomy', '#Growth2026', '#SocialMedia'];

  const sampleImages = [
    { label: 'Analytics Dashboard', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80' },
    { label: 'Team Work', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80' },
    { label: 'Podcast Studio', url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=80' },
    { label: 'App Launch', url: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80' }
  ];

  const resetComposerForm = () => {
    setEditingPostId(null);
    setContent('');
    setMediaUrl(DEFAULT_MEDIA_URL);
    setMediaType('image');
    setVideoTitle('');
    setYoutubePrivacy('private');
    setSelectedCampaignId('');
    setSelectedPlatforms(['Instagram', 'Facebook']);
    setScheduleDate(getDefaultScheduleValue());
  };

  const handleStartEditPost = (post) => {
    setEditingPostId(post.id);
    setContent(post.content || '');
    const postPlatforms = Array.isArray(post.platforms) && post.platforms.length > 0 ? post.platforms : ['Instagram'];
    setSelectedPlatforms(postPlatforms);
    setPreviewTab(postPlatforms[0] || 'Instagram');
    setMediaUrl(post.media_url || '');
    setMediaType(post.media_url ? (post.media_type || inferMediaTypeFromUrl(post.media_url)) : 'none');
    setVideoTitle(post.video_title || '');
    setYoutubePrivacy(post.youtube_privacy || 'private');
    setSelectedCampaignId(post.campaign_id ? String(post.campaign_id) : '');
    if (post.scheduled_for) {
      setScheduleDate(post.scheduled_for.replace(' ', 'T').slice(0, 16));
    }
    setErrorMsg('');
    setSuccessMsg(`Loaded post #${post.id} into editor.`);
    setPublishReport(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    resetComposerForm();
    setErrorMsg('');
    setSuccessMsg('');
    setPublishReport(null);
  };

  const handleDeleteSavedPost = async (postId) => {
    setDeletingId(postId);
    setErrorMsg('');
    try {
      await api.deletePost(postId, appMode);
      if (onPostDeleted) onPostDeleted(postId);
      if (editingPostId === postId) {
        resetComposerForm();
      }
      setSuccessMsg(`Deleted post #${postId} cleanly.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to delete post.');
    } finally {
      setDeletingId(null);
    }
  };

  const getLiveCompatibilityWarnings = () => {
    if (isDemoMode) return [];
    const warnings = [];
    const activeType = mediaUrl ? mediaType : 'none';
    const isLocalUrl =
      Boolean(mediaUrl) && (/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(mediaUrl) || mediaUrl.startsWith('/uploads'));

    for (const plName of selectedPlatforms) {
      const plObj = availablePlatforms.find((p) => p.name === plName);
      if (!OFFICIAL_PLATFORMS.includes(plName)) {
        warnings.push(`${plName} has no OAuth integration in Live Server Mode (Draft & Schedule supported locally).`);
        continue;
      }
      if (!plObj?.oauthConnected) {
        warnings.push(`OAuth Setup Required — ${plName} external publishing is disabled until OAuth is configured.`);
      }
      if (plName === 'Instagram') {
        if (activeType === 'none') {
          warnings.push('Instagram Graph API requires an image or Reels video (text-only unsupported).');
        } else if (isLocalUrl) {
          warnings.push('Instagram Graph API requires a publicly reachable HTTPS media URL when OAuth is enabled.');
        }
      }
      if (plName === 'YouTube' && activeType !== 'video') {
        warnings.push('YouTube Data API v3 only supports video uploads.');
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
        setSelectedPlatforms(selectedPlatforms.filter((p) => p !== pl.name));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, pl.name]);
    }
  };

  const handleAddHashtag = (tag) => {
    setContent((prev) => (prev ? `${prev} ${tag}` : tag));
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
      const nextType =
        typeof uploaded === 'string'
          ? inferMediaTypeFromUrl(nextUrl)
          : uploaded.media_type || inferMediaTypeFromUrl(nextUrl);
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
      status: actionMode === 'publish' ? 'published' : actionMode === 'schedule' ? 'scheduled' : 'draft',
      scheduled_for: actionMode === 'schedule' ? scheduleDate.replace('T', ' ') + ':00' : null,
      publish_mode: publishMode,
      video_title: videoTitle.trim() || null,
      youtube_privacy: youtubePrivacy
    };

    try {
      const wasEditing = Boolean(editingPostId);
      const savedPost = wasEditing
        ? await api.updatePost(editingPostId, postPayload, appMode)
        : await api.createPost(postPayload, appMode);

      const results = savedPost.publish_results || [];
      if (wasEditing && onPostUpdated) {
        onPostUpdated(savedPost);
      } else if (!wasEditing && onPostCreated) {
        onPostCreated(savedPost);
      }

      if (actionMode === 'publish') {
        setPublishReport({
          mode: savedPost.publish_mode || publishMode,
          status: savedPost.status,
          results,
          error_message: savedPost.error_message
        });
        if (isDemoMode) {
          setSuccessMsg(
            `Demo Published across ${selectedPlatforms.join(', ')} (simulated metrics recorded locally — no external social posts sent).`
          );
          resetComposerForm();
        } else if (savedPost.status === 'partial') {
          setErrorMsg(savedPost.error_message || 'Post succeeded on some Live channels but failed on others. See channel report below.');
        } else {
          setSuccessMsg('Post published to your Live connected social media channel(s)!');
          resetComposerForm();
        }
      } else if (actionMode === 'schedule') {
        setSuccessMsg(
          `${wasEditing ? 'Updated scheduled post' : 'Scheduled'} (${isDemoMode ? 'Demo Workspace' : 'Live SQLite Queue'}) for ${scheduleDate.replace('T', ' at ')}.`
        );
        resetComposerForm();
      } else {
        setSuccessMsg(wasEditing ? 'Post draft updated in workspace.' : 'Your post has been saved as a draft.');
        resetComposerForm();
      }
    } catch (err) {
      if (err.data?.id) {
        if (editingPostId && onPostUpdated) onPostUpdated(err.data);
        else if (!editingPostId && onPostCreated) onPostCreated(err.data);
      }
      if (err.data?.publish_results) {
        setPublishReport({
          mode: err.data.publish_mode || publishMode,
          status: err.data.status || 'failed',
          results: err.data.publish_results,
          error_message: err.data.error_message || err.message
        });
      }
      setErrorMsg(err.data?.error_message || err.message || 'Action failed. Check backend connection and OAuth status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ss-compose-grid animate-fade-in">
      {/* Left Column: Composer Workbench */}
      <div className="clean-card" style={{ padding: '1.65rem', display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
        <div className="ss-page-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.32rem', fontWeight: 800, margin: 0 }}>
              {editingPostId ? `Edit Post #${editingPostId}` : 'Create New Post'}
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              {isDemoMode
                ? 'Compose, edit, schedule, or Demo Publish posts directly inside your SQLite Demo workspace.'
                : 'Draft, upload media, and schedule posts in Flask + SQLite. External API publishing requires OAuth.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {editingPostId && (
              <button type="button" onClick={handleCancelEdit} className="btn-secondary btn-sm">
                <X size={13} />
                <span>Cancel Edit</span>
              </button>
            )}
            <span className={`badge ${isDemoMode ? 'badge-primary' : 'badge-success'}`}>
              {isDemoMode ? 'DEMO MODE' : 'LIVE SERVER MODE'}
            </span>
          </div>
        </div>

        {/* Workspace Mode Card */}
        <div
          style={{
            padding: '1rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-muted)',
            border: `1.5px solid ${isDemoMode ? 'var(--lavender-border)' : 'var(--success-border)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              {isDemoMode ? <FlaskConical size={15} color="var(--primary)" /> : <Server size={15} color="var(--success)" />}
              <span>{isDemoMode ? 'Dummy Demo Publishing Active' : `Live Server Workspace (${backendStatus})`}</span>
            </span>
            {onSwitchAppMode && (
              <button
                type="button"
                onClick={() => onSwitchAppMode(isDemoMode ? 'live' : 'demo')}
                className="btn-secondary btn-sm"
              >
                {isDemoMode ? 'Switch to Live Server Mode' : 'Switch to Demo Mode'}
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {isDemoMode
              ? 'Posts, drafts, schedules, and "Demo Published" actions persist to SQLite Demo workspace without contacting real external accounts.'
              : 'Drafts, schedules, campaigns & file uploads save directly to Flask/SQLite. Clicking Publish displays honest "OAuth Setup Required" status until OAuth is linked.'}
          </div>
        </div>

        {/* Notifications & Channel Report */}
        {errorMsg && (
          <div className="ss-alert ss-alert-danger">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="ss-alert ss-alert-success">
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {publishReport && publishReport.results?.length > 0 && (
          <div
            style={{
              padding: '0.95rem 1.05rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.83rem', fontWeight: 700 }}>
                {publishReport.mode === 'demo'
                  ? 'Demo Publish Simulation Report'
                  : `Channel Delivery Report (${(publishReport.status || '').toUpperCase()})`}
              </span>
              <button type="button" onClick={() => onNavigate('calendar')} className="btn-secondary btn-sm">
                Open Calendar
              </button>
            </div>
            {publishReport.results.map((r, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '0.79rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '10px',
                  backgroundColor: r.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                  border: `1px solid ${r.success ? 'var(--success-border)' : 'var(--danger-border)'}`,
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
                    ? r.simulated
                      ? r.label || 'Demo Published'
                      : `Published${r.external_post_id ? ` (ID: ${r.external_post_id})` : ''}`
                    : r.error || 'OAuth Setup Required'}
                </span>
                {isSafeHttpUrl(r.permalink) && (
                  <a
                    href={r.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                  >
                    <span>View Live Post</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: Target Channels */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'var(--gradient-brand)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              01
            </span>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Select Target Channels</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 36px' }}>
            Choose active networks synced from Connected Accounts.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(126px, 1fr))',
              gap: '0.65rem',
              marginLeft: '36px'
            }}
          >
            {availablePlatforms.map((pl) => {
              const isSelected = selectedPlatforms.includes(pl.name);
              const isDisconnected = !pl.connected;
              const isOfficial = OFFICIAL_PLATFORMS.includes(pl.name);

              return (
                <button
                  key={pl.name}
                  type="button"
                  onClick={() => togglePlatform(pl)}
                  title={isDisconnected ? `${pl.name} is paused` : `${pl.name} (${pl.followers})`}
                  style={{
                    position: 'relative',
                    padding: '0.75rem 0.65rem',
                    borderRadius: '12px',
                    border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isDisconnected
                      ? 'var(--bg-muted)'
                      : isSelected
                        ? 'var(--gradient-brand-soft)'
                        : 'var(--bg-surface)',
                    color: isDisconnected
                      ? 'var(--text-muted)'
                      : isSelected
                        ? 'var(--primary)'
                        : 'var(--text-primary)',
                    cursor: isDisconnected ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.28rem',
                    opacity: isDisconnected ? 0.58 : 1,
                    transition: 'all 0.16s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '1.15rem' }}>{pl.icon}</span>
                    {isSelected && (
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{pl.name}</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: isDisconnected
                        ? 'var(--danger)'
                        : isDemoMode
                          ? 'var(--primary)'
                          : pl.oauthConnected
                            ? 'var(--success)'
                            : 'var(--warning)'
                    }}
                  >
                    {isDisconnected
                      ? 'Paused'
                      : isDemoMode
                        ? '● Demo Ready'
                        : pl.oauthConnected
                          ? '● Live OAuth'
                          : isOfficial
                            ? '○ OAuth Required'
                            : '○ Local Draft Only'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Content & Media */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'var(--gradient-brand)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              02
            </span>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Write Copy, Attach Media &amp; Link Campaign</h3>
          </div>

          <div style={{ marginLeft: '36px', display: 'flex', flexDirection: 'column', gap: '1.05rem' }}>
            {campaigns.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--bg-muted)',
                  padding: '0.78rem 0.9rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem'
                }}
              >
                <div className="ss-icon-badge" style={{ width: '32px', height: '32px', backgroundColor: 'var(--lavender)', color: 'var(--primary)' }}>
                  <Target size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.76rem', marginBottom: '3px' }}>
                    Link Marketing Campaign (Optional)
                  </label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="form-input"
                    style={{ padding: '0.38rem 0.65rem', fontSize: '0.82rem' }}
                  >
                    <option value="">None (Independent Post)</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Caption */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Post Caption / Description</label>
                <span
                  className={`badge ${content.length > 280 ? 'badge-danger' : 'badge-neutral'}`}
                  style={{ fontSize: '0.7rem' }}
                >
                  {content.length} chars {content.length > 280 ? '(Over X 280 limit)' : ''}
                </span>
              </div>
              <textarea
                rows={5}
                placeholder="Write a compelling caption, launch story, or announcement..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="form-input"
                style={{ resize: 'vertical', lineHeight: 1.55 }}
              />
            </div>

            {/* Quick Hashtags */}
            <div>
              <span style={{ fontSize: '0.77rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '0.4rem' }}>
                <Hash size={13} color="var(--primary)" />
                Quick Hashtags:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {quickHashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddHashtag(tag)}
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '999px',
                      padding: '0.26rem 0.68rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.color = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Studio Card */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-muted)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="form-label">Media Attachment (Image or Video)</span>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setMediaType('image')}
                    className={mediaType === 'image' && mediaUrl ? 'btn-outline btn-sm' : 'btn-secondary btn-sm'}
                  >
                    <ImageIcon size={12} />
                    <span>Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType('video')}
                    className={mediaType === 'video' && mediaUrl ? 'btn-outline btn-sm' : 'btn-secondary btn-sm'}
                  >
                    <Film size={12} />
                    <span>Video</span>
                  </button>

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
                    className="btn-primary btn-sm"
                  >
                    <Upload size={13} />
                    <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                  </button>
                </div>
              </div>

              <input
                type="url"
                placeholder="Paste a direct image/video URL (https://...) or leave blank for text-only"
                value={mediaUrl}
                onChange={(e) => handleMediaUrlChange(e.target.value)}
                className="form-input"
              />

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Presets:</span>
                {sampleImages.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMediaUrl(s.url);
                      setMediaType('image');
                    }}
                    style={{
                      fontSize: '0.73rem',
                      padding: '0.24rem 0.6rem',
                      borderRadius: '8px',
                      border: mediaUrl === s.url ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: mediaUrl === s.url ? 'var(--lavender)' : 'var(--bg-surface)',
                      color: mediaUrl === s.url ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
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
                      fontSize: '0.73rem',
                      padding: '0.24rem 0.6rem',
                      borderRadius: '8px',
                      border: '1px solid var(--danger-border)',
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Remove Media
                  </button>
                )}
              </div>
            </div>

            {/* Video Title & YouTube Options */}
            {(selectedPlatforms.includes('YouTube') || (mediaUrl && mediaType === 'video')) && (
              <div
                className="ss-grid-2"
                style={{
                  backgroundColor: 'var(--bg-muted)',
                  padding: '0.95rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  gap: '0.85rem'
                }}
              >
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.77rem' }}>
                    Video Title (YouTube / Video Posts)
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to first line of caption"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="form-input"
                  />
                </div>
                {selectedPlatforms.includes('YouTube') && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.77rem' }}>
                      YouTube Privacy Status
                    </label>
                    <select
                      value={youtubePrivacy}
                      onChange={(e) => setYoutubePrivacy(e.target.value)}
                      className="form-input"
                    >
                      <option value="private">Private (Recommended for testing)</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Pre-flight Warnings */}
            {liveWarnings.length > 0 && (
              <div className="ss-alert ss-alert-warning" style={{ flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                  <AlertCircle size={15} />
                  <span>Live Server Compatibility Check</span>
                </div>
                {liveWarnings.map((w, idx) => (
                  <div key={idx} style={{ fontSize: '0.79rem' }}>
                    • {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: Dispatch & Schedule */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'var(--gradient-brand)',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              03
            </span>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Publish or Schedule</h3>
          </div>

          <div style={{ marginLeft: '36px', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                padding: '0.9rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem'
              }}
            >
              <div className="ss-icon-badge" style={{ width: '36px', height: '36px', backgroundColor: 'var(--lavender)', color: 'var(--primary)' }}>
                <Clock size={17} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px' }}>
                  Schedule Date &amp; Time ({isDemoMode ? 'Demo Workspace Scheduler' : 'Local SQLite Queue'})
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="form-input"
                  style={{ padding: '0.45rem 0.7rem' }}
                />
              </div>
            </div>

            <div className="ss-grid-3" style={{ gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleAction('draft')}
                disabled={loading}
                className="btn-secondary"
                style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '0.88rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                  <FileText size={15} />
                  <span>{editingPostId ? 'Save Draft Changes' : 'Save Draft'}</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {isDemoMode ? 'Store in Demo SQLite.' : 'Save in SQLite backend.'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleAction('schedule')}
                disabled={loading}
                className="btn-primary"
                style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '0.88rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                  <Calendar size={15} />
                  <span>{editingPostId ? 'Update Schedule' : 'Schedule Post'}</span>
                </div>
                <span style={{ fontSize: '0.72rem', opacity: 0.9, fontWeight: 400 }}>
                  Queue for selected timestamp.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleAction('publish')}
                disabled={loading}
                className="btn-primary"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '0.88rem',
                  background: isDemoMode
                    ? 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)'
                    : 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                  <Send size={15} />
                  <span>{isDemoMode ? 'Demo Publish' : 'Publish Live'}</span>
                </div>
                <span style={{ fontSize: '0.72rem', opacity: 0.9, fontWeight: 400 }}>
                  {isDemoMode ? 'Simulated local publish.' : 'OAuth Setup Required.'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Sticky Realistic Channel Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '94px' }}>
        <div className="clean-card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Eye size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '1.02rem', margin: 0 }}>Live Feed Preview</h3>
            </div>
            <div className="ss-tab-group">
              {['Instagram', 'Facebook', 'YouTube', 'X'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPreviewTab(tab)}
                  className={`ss-tab ${previewTab === tab ? 'active' : ''}`}
                  style={{ padding: '0.32rem 0.65rem', fontSize: '0.74rem' }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: '1.05rem',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border-color)'
            }}
          >
            {previewTab === 'Instagram' || previewTab === 'Facebook' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                      alt="Profile"
                      style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                        {availablePlatforms.find((p) => p.name === previewTab)?.handle || 'socialsync_app'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {previewTab} {mediaType === 'video' ? 'Video / Reels' : mediaUrl ? 'Photo Post' : 'Text Post'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      publishMode === 'live'
                        ? 'badge-success'
                        : publishMode === 'demo'
                          ? 'badge-primary'
                          : 'badge-warning'
                    }`}
                    style={{ fontSize: '0.64rem' }}
                  >
                    {publishMode === 'live' ? 'LIVE API' : publishMode === 'demo' ? 'DEMO MODE' : 'SANDBOX'}
                  </span>
                </div>

                {isSafeHttpUrl(mediaUrl, true) && (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '280px', marginBottom: '0.75rem', backgroundColor: '#000' }}>
                    {mediaType === 'video' ? (
                      <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '280px', display: 'block' }} />
                    ) : (
                      <img src={mediaUrl} alt="Preview" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.85rem', color: 'var(--text-secondary)' }}>
                    <ThumbsUp size={17} color="var(--primary)" />
                    <MessageCircle size={17} />
                    <Share2 size={17} />
                  </div>
                  <Bookmark size={17} color="var(--text-secondary)" />
                </div>

                <div style={{ fontSize: '0.83rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  <strong style={{ marginRight: '6px' }}>{previewTab === 'Facebook' ? 'Page Post' : 'socialsync_app'}</strong>
                  {content || 'Your caption updates here live as you type...'}
                </div>
              </div>
            ) : previewTab === 'YouTube' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>YouTube Upload Preview</span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                    {youtubePrivacy}
                  </span>
                </div>
                {isSafeHttpUrl(mediaUrl, true) && mediaType === 'video' ? (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', marginBottom: '0.75rem' }}>
                    <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '240px', display: 'block' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '2rem 1rem',
                      textAlign: 'center',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      marginBottom: '0.75rem'
                    }}
                  >
                    Upload a video file or attach a video URL to preview YouTube playback.
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.3rem' }}>
                  {videoTitle.trim() || (content ? content.slice(0, 80) : 'Untitled Video')}
                </div>
                <div style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {content || 'Video description will appear here...'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                  alt="Profile"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      {availablePlatforms.find((p) => p.name === 'X')?.accountName || 'SocialSync Studio'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                      {availablePlatforms.find((p) => p.name === 'X')?.handle || '@socialsync_demo'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.45, color: 'var(--text-primary)', margin: '0 0 0.7rem 0' }}>
                    {content || 'Your post copy will appear here in real-time...'}
                  </p>

                  {isSafeHttpUrl(mediaUrl, true) && (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '200px', marginBottom: '0.7rem', backgroundColor: '#000' }}>
                      {mediaType === 'video' ? (
                        <video src={mediaUrl} controls style={{ width: '100%', maxHeight: '200px', display: 'block' }} />
                      ) : (
                        <img src={mediaUrl} alt="X preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', maxWidth: '240px', fontSize: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={13} /> 8</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Repeat2 size={13} /> 24</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ThumbsUp size={13} /> 140</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Share2 size={13} /></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="help-box" style={{ fontSize: '0.8rem' }}>
          <Sparkles size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            {isDemoMode ? (
              <>
                <strong>Demo Isolation:</strong> Saves directly to your isolated Demo SQLite workspace. Simulated actions never publish externally and always label results <strong>Demo Published</strong>.
              </>
            ) : (
              <>
                <strong>Live Server Mode:</strong> Saves drafts, scheduled posts, and uploaded media cleanly to Flask &amp; SQLite. External channel dispatch remains disabled until <strong>OAuth Setup Required</strong> is completed.
              </>
            )}
          </span>
        </div>

        {/* Workspace Saved & Recent Posts (Quick Edit / Delete) */}
        <div className="clean-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700 }}>
              Workspace Posts ({posts.length})
            </h4>
            <button type="button" onClick={() => onNavigate('calendar')} className="btn-secondary btn-sm">
              Open Calendar
            </button>
          </div>

          {posts.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'published', label: isDemoMode ? 'Demo Published' : 'Published' },
                { id: 'scheduled', label: 'Scheduled' },
                { id: 'draft', label: 'Drafts' }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setPostListFilter(st.id)}
                  className={postListFilter === st.id ? 'badge badge-primary' : 'badge badge-neutral'}
                  style={{ cursor: 'pointer', border: 'none', fontSize: '0.68rem', padding: '0.26rem 0.55rem' }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}

          {posts.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.4rem 0' }}>
              No posts yet in {isDemoMode ? 'Demo Mode' : 'Live Server Mode'}. Use the composer to save a draft, schedule, or publish.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '300px', overflowY: 'auto' }}>
              {posts
                .filter((p) => postListFilter === 'all' || p.status === postListFilter)
                .map((p) => {
                const isPublishedDemo = p.status === 'published' && (p.publish_mode === 'demo' || isDemoMode);
                const statusLabel = isPublishedDemo
                  ? 'Demo Published'
                  : p.status === 'published'
                    ? 'Published'
                    : p.status === 'scheduled'
                      ? 'Scheduled'
                      : p.status === 'failed'
                        ? 'Failed'
                        : 'Draft';

                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '0.68rem 0.78rem',
                      borderRadius: '10px',
                      backgroundColor: editingPostId === p.id ? 'var(--lavender)' : 'var(--bg-muted)',
                      border: `1px solid ${editingPostId === p.id ? 'var(--primary)' : 'var(--border-light)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.42rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        className={`badge ${
                          p.status === 'published'
                            ? 'badge-success'
                            : p.status === 'scheduled'
                              ? 'badge-primary'
                              : p.status === 'failed'
                                ? 'badge-danger'
                                : 'badge-warning'
                        }`}
                        style={{ fontSize: '0.66rem' }}
                      >
                        {statusLabel}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {(Array.isArray(p.platforms) ? p.platforms : [p.platforms]).filter(Boolean).join(', ')}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.79rem',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {p.content}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEditPost(p)}
                        className="btn-secondary btn-sm"
                        style={{ padding: '0.24rem 0.55rem', fontSize: '0.72rem' }}
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleDeleteSavedPost(p.id)}
                        className="btn-secondary btn-sm"
                        style={{
                          padding: '0.24rem 0.55rem',
                          fontSize: '0.72rem',
                          backgroundColor: 'var(--danger-bg)',
                          borderColor: 'var(--danger-border)',
                          color: 'var(--danger)'
                        }}
                      >
                        <Trash2 size={11} />
                        <span>{deletingId === p.id ? '...' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
