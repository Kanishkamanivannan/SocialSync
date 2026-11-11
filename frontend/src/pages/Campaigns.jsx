import React, { useState } from 'react';
import {
  Target,
  Plus,
  Search,
  Calendar,
  DollarSign,
  CheckCircle2,
  X,
  Info,
  Users,
  ArrowRight,
  Edit3,
  Trash2,
  Layers,
  Activity,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function Campaigns({
  campaigns = [],
  posts = [],
  appMode = 'demo',
  backendStatus = 'connected',
  onCampaignCreated,
  onCampaignUpdated,
  onCampaignDeleted
}) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [activeDetailCampaign, setActiveDetailCampaign] = useState(null);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetReach, setTargetReach] = useState(50000);
  const [budget, setBudget] = useState('$1,500');
  const [endDate, setEndDate] = useState('2026-11-30');

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTargetReach, setEditTargetReach] = useState(50000);
  const [editBudget, setEditBudget] = useState('$1,500');
  const [editStatus, setEditStatus] = useState('active');
  const [editEndDate, setEditEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [modalError, setModalError] = useState('');

  const showTempFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!title.trim()) {
      setModalError('Please enter a campaign name.');
      return;
    }

    setLoading(true);
    try {
      const created = await api.createCampaign(
        {
          title: title.trim(),
          description: description.trim(),
          target_reach: Number(targetReach) || 50000,
          budget: budget || '$1,500',
          end_date: endDate
        },
        appMode
      );
      if (onCampaignCreated) onCampaignCreated(created);
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      showTempFeedback('success', `New campaign "${created.title}" launched in ${appMode === 'demo' ? 'Demo' : 'Live Server'} workspace!`);
    } catch (err) {
      console.error(err);
      setModalError(err?.message || 'Failed to create campaign.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (camp) => {
    setEditingCampaign(camp);
    setEditTitle(camp.title);
    setEditDescription(camp.description || '');
    setEditTargetReach(camp.target_reach || 50000);
    setEditBudget(camp.budget || '$1,500');
    setEditStatus(camp.status || 'active');
    setEditEndDate(camp.end_date || '');
    setModalError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCampaign) return;
    setModalError('');

    setLoading(true);
    try {
      const updated = await api.updateCampaign(
        editingCampaign.id,
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          target_reach: Number(editTargetReach) || 50000,
          budget: editBudget.trim(),
          status: editStatus,
          end_date: editEndDate
        },
        appMode
      );
      if (onCampaignUpdated) onCampaignUpdated(updated);
      setEditingCampaign(null);
      showTempFeedback('success', `Campaign '${editTitle}' updated successfully!`);
    } catch (err) {
      console.error(err);
      setModalError(err?.message || 'Failed to update campaign.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (campId, campTitle) => {
    if (window.confirm(`Are you sure you want to delete campaign "${campTitle}"? This action cannot be undone.`)) {
      try {
        await api.deleteCampaign(campId, appMode);
        if (onCampaignDeleted) onCampaignDeleted(campId);
        if (activeDetailCampaign?.id === campId) setActiveDetailCampaign(null);
        showTempFeedback('success', `Campaign "${campTitle}" deleted successfully.`);
      } catch (err) {
        console.error(err);
        showTempFeedback('error', err?.message || 'Failed to delete campaign.');
      }
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    if (!matchesStatus) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.title || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      (c.budget || '').toLowerCase().includes(q)
    );
  });

  const activeCount = campaigns.filter((c) => c.status === 'active').length;
  const totalLinkedPosts = posts.filter((p) => Boolean(p.campaign_id)).length;
  const totalGoalReach = campaigns.reduce((sum, c) => sum + (c.target_reach || 50000), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
      {/* Page Action Header */}
      <div className="ss-page-header">
        <div>
          <h2 className="ss-page-title">Marketing Campaigns</h2>
          <p className="ss-page-subtitle">
            Coordinate product launches, group related posts, and track milestone progress.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <Search
              size={14}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.15rem', paddingTop: '0.45rem', paddingBottom: '0.45rem', fontSize: '0.82rem', minHeight: '36px' }}
            />
          </div>

          <div className="ss-tab-group">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'planning', label: 'Planning' },
              { id: 'completed', label: 'Completed' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`ss-tab ${filterStatus === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={16} />
            <span>Launch Campaign</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Strip */}
      <div className="ss-grid-4">
        <div className="ss-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #635BFF 0%, #8B5CF6 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Campaigns</span>
            <Target size={16} color="var(--primary)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800 }}>
            {campaigns.length}
          </div>
        </div>

        <div className="ss-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #10B981 0%, #34D399 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Active Launches</span>
            <Activity size={16} color="var(--success)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800 }}>
            {activeCount}
          </div>
        </div>

        <div className="ss-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Linked Posts</span>
            <Layers size={16} color="var(--info)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800 }}>
            {totalLinkedPosts}
          </div>
        </div>

        <div className="ss-kpi-card" style={{ '--kpi-accent': 'linear-gradient(90deg, #F59E0B 0%, #EC4899 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Combined Reach Goal</span>
            <TrendingUp size={16} color="var(--warning)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 800 }}>
            {totalGoalReach.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`ss-alert ${feedback.type === 'error' ? 'ss-alert-danger' : 'ss-alert-success'}`}>
          {feedback.type === 'error' ? (
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <span>{typeof feedback === 'string' ? feedback : feedback.text}</span>
        </div>
      )}

      {/* Helper Callout */}
      <div className="help-box">
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          {appMode === 'demo' ? (
            <>
              <strong>Dummy Demo Mode:</strong> Create, edit, track, and delete demo marketing campaigns inside your isolated Demo SQLite workspace. Link posts in <strong>Compose Studio</strong> to track reach milestones.
            </>
          ) : (
            <>
              <strong>Live Server Mode ({backendStatus}):</strong> Managing real campaign initiatives stored in Flask &amp; SQLite. Link posts in <strong>Compose Studio</strong> to track reach milestones.
            </>
          )}
        </div>
      </div>

      {/* Campaigns Grid or Empty State */}
      {filteredCampaigns.length === 0 ? (
        <div className="clean-card empty-state">
          <div className="empty-state-icon">
            <Target size={24} />
          </div>
          <div className="empty-state-title">
            No {filterStatus !== 'all' ? filterStatus : ''} campaigns found
          </div>
          <div className="empty-state-desc">
            Create your first campaign to group scheduled posts and monitor reach progress against your goals.
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={16} />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 345px), 1fr))',
            gap: '1.35rem'
          }}
        >
          {filteredCampaigns.map((camp) => {
            const target = camp.target_reach || 50000;
            const linkedPosts = posts.filter((p) => Number(p.campaign_id) === Number(camp.id));
            const publishedLinked = linkedPosts.filter((p) => p.status === 'published');
            const calculatedReach = publishedLinked.reduce((sum, p) => sum + (p.reach || 0), 0);
            const current = appMode === 'demo' ? calculatedReach : (calculatedReach > 0 ? calculatedReach : camp.current_reach || 0);
            const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

            return (
              <div
                key={camp.id}
                className="clean-card ss-card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.15rem',
                  padding: '1.45rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                      <div
                        className="ss-icon-badge"
                        style={{
                          width: '38px',
                          height: '38px',
                          backgroundColor: 'var(--lavender)',
                          color: 'var(--primary)'
                        }}
                      >
                        <Target size={18} />
                      </div>
                      <h3 style={{ fontSize: '1.06rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                        {camp.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                      <span
                        className={`badge ${
                          camp.status === 'active'
                            ? 'badge-success'
                            : camp.status === 'planning'
                              ? 'badge-primary'
                              : 'badge-neutral'
                        }`}
                        style={{ textTransform: 'uppercase', fontSize: '0.67rem' }}
                      >
                        {camp.status}
                      </span>
                      <button
                        onClick={() => handleOpenEdit(camp)}
                        title="Edit Campaign"
                        aria-label="Edit Campaign"
                        style={{
                          background: 'var(--bg-muted)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(camp.id, camp.title)}
                        title="Delete Campaign"
                        aria-label="Delete Campaign"
                        style={{
                          background: 'var(--danger-bg)',
                          border: '1px solid var(--danger-border)',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                    {camp.description}
                  </p>
                </div>

                {/* Progress Bar + Reach Info */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={13} color="var(--primary)" />
                      Reach Progress
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {current.toLocaleString()} / {target.toLocaleString()} ({progressPercent}%)
                    </span>
                  </div>

                  <div className="ss-progress-track">
                    <div className="ss-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>

                  {linkedPosts.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.42rem' }}>
                      <Layers size={12} color="var(--primary)" />
                      <span>
                        {linkedPosts.length} post{linkedPosts.length === 1 ? '' : 's'} linked
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DollarSign size={14} color="var(--primary)" />
                      Budget: <strong style={{ color: 'var(--text-primary)' }}>{camp.budget || '$1,500'}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} color="var(--text-muted)" />
                      Until: <strong style={{ color: 'var(--text-primary)' }}>{camp.end_date || 'Ongoing'}</strong>
                    </span>
                  </div>

                  <button type="button" onClick={() => setActiveDetailCampaign(camp)} className="btn-secondary btn-sm" style={{ width: '100%' }}>
                    <span>View Details</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW CAMPAIGN DETAILS MODAL */}
      {activeDetailCampaign && (
        <div className="ss-modal-backdrop" onClick={() => setActiveDetailCampaign(null)}>
          <div className="ss-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="ss-icon-badge" style={{ width: '36px', height: '36px', backgroundColor: 'var(--lavender)', color: 'var(--primary)' }}>
                  <Target size={18} />
                </div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0 }}>{activeDetailCampaign.title}</h3>
              </div>
              <button
                onClick={() => setActiveDetailCampaign(null)}
                style={{ background: 'var(--bg-muted)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <span className={`badge ${activeDetailCampaign.status === 'active' ? 'badge-success' : 'badge-primary'}`} style={{ alignSelf: 'flex-start' }}>
                STATUS: {(activeDetailCampaign.status || 'active').toUpperCase()}
              </span>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                {activeDetailCampaign.description}
              </p>

              <div
                style={{
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Target Reach</span>
                  <span style={{ fontSize: '1.12rem', fontWeight: 800 }}>
                    {(activeDetailCampaign.target_reach || 50000).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Current Reach</span>
                  <span style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {(() => {
                      const campPosts = posts.filter((p) => Number(p.campaign_id) === Number(activeDetailCampaign.id));
                      const pubReach = campPosts.filter((p) => p.status === 'published').reduce((s, p) => s + (p.reach || 0), 0);
                      const val = appMode === 'demo' ? pubReach : (pubReach > 0 ? pubReach : activeDetailCampaign.current_reach || 0);
                      return val.toLocaleString();
                    })()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Allocated Budget</span>
                  <span style={{ fontSize: '1.12rem', fontWeight: 800 }}>
                    {activeDetailCampaign.budget || '$1,500'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Deadline</span>
                  <span style={{ fontSize: '1.12rem', fontWeight: 800 }}>
                    {activeDetailCampaign.end_date || 'Ongoing'}
                  </span>
                </div>
              </div>

              {(() => {
                const detailPosts = posts.filter((p) => Number(p.campaign_id) === Number(activeDetailCampaign.id));
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Linked Workspace Posts ({detailPosts.length})
                    </span>
                    {detailPosts.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.65rem 0.85rem', borderRadius: '10px', backgroundColor: 'var(--bg-muted)' }}>
                        No posts assigned to this campaign yet. Link posts from the Compose page.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '150px', overflowY: 'auto' }}>
                        {detailPosts.map((lp) => (
                          <div
                            key={lp.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.6rem',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '10px',
                              backgroundColor: 'var(--bg-muted)',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.79rem'
                            }}
                          >
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                              {lp.content}
                            </span>
                            <span className={`badge ${lp.status === 'published' ? 'badge-success' : lp.status === 'scheduled' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.64rem', flexShrink: 0 }}>
                              {lp.status === 'published' && (lp.publish_mode === 'demo' || appMode === 'demo') ? 'Demo Published' : lp.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = activeDetailCampaign;
                    setActiveDetailCampaign(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="btn-primary"
                >
                  <Edit3 size={15} />
                  <span>Edit Campaign</span>
                </button>
                <button type="button" onClick={() => setActiveDetailCampaign(null)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CAMPAIGN MODAL */}
      {editingCampaign && (
        <div className="ss-modal-backdrop" onClick={() => setEditingCampaign(null)}>
          <div className="ss-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Edit Campaign</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Update goal targets, deadline, or status.
                </p>
              </div>
              <button
                onClick={() => setEditingCampaign(null)}
                style={{ background: 'var(--bg-muted)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modalError && (
                <div className="ss-alert ss-alert-danger" style={{ fontSize: '0.8rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="form-input" required />
              </div>

              <div className="form-group">
                <label className="form-label">Goal &amp; Strategy *</label>
                <textarea rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="form-input" required />
              </div>

              <div className="ss-grid-2" style={{ gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Reach</label>
                  <input type="number" value={editTargetReach} onChange={(e) => setEditTargetReach(e.target.value)} className="form-input" min="1000" step="1000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Budget</label>
                  <input type="text" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} className="form-input" />
                </div>
              </div>

              <div className="ss-grid-2" style={{ gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="form-input">
                    <option value="active">Active</option>
                    <option value="planning">Planning</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target End Date</label>
                  <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="form-input" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditingCampaign(null)} className="btn-secondary">
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

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="ss-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="ss-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Create New Campaign</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Set up your goal, timeline, and budget parameters.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'var(--bg-muted)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modalError && (
                <div className="ss-alert ss-alert-danger" style={{ fontSize: '0.8rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Brand Awareness Sprint"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  required
                />
                <span className="form-helper">Choose a recognizable title for internal tracking.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Goal &amp; Strategy *</label>
                <textarea
                  rows={3}
                  placeholder="Describe the campaign focus (e.g., Promote product release videos across Instagram and YouTube)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="ss-grid-2" style={{ gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Reach</label>
                  <input type="number" value={targetReach} onChange={(e) => setTargetReach(e.target.value)} className="form-input" min="1000" step="1000" />
                  <span className="form-helper">Milestone target.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Budget (Optional)</label>
                  <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} className="form-input" placeholder="e.g. $2,000" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Save & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
