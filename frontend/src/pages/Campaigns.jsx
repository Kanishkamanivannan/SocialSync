import React, { useState } from 'react';
import { 
  Target, 
  Plus, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  X, 
  Info, 
  Users, 
  ArrowRight,
  Edit3,
  Trash2,
  Layers
} from 'lucide-react';
import { api } from '../services/api';

export default function Campaigns({ 
  campaigns = [], 
  posts = [], 
  onCampaignCreated, 
  onCampaignUpdated, 
  onCampaignDeleted 
}) {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'planning', 'completed'

  // Modals state
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

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a campaign name.');
      return;
    }

    setLoading(true);
    try {
      const created = await api.createCampaign({
        title: title.trim(),
        description: description.trim(),
        target_reach: Number(targetReach) || 50000,
        budget: budget || '$1,500',
        end_date: endDate
      });
      if (onCampaignCreated) onCampaignCreated(created);
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setFeedback('New campaign launched successfully!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to create campaign.');
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
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCampaign) return;

    setLoading(true);
    try {
      const updated = await api.updateCampaign(editingCampaign.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        target_reach: Number(editTargetReach) || 50000,
        budget: editBudget.trim(),
        status: editStatus,
        end_date: editEndDate
      });
      if (onCampaignUpdated) onCampaignUpdated(updated);
      setEditingCampaign(null);
      setFeedback(`Campaign '${editTitle}' updated successfully!`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update campaign.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (campId, campTitle) => {
    if (window.confirm(`Are you sure you want to delete campaign "${campTitle}"? This action cannot be undone.`)) {
      try {
        await api.deleteCampaign(campId);
        if (onCampaignDeleted) onCampaignDeleted(campId);
        if (activeDetailCampaign?.id === campId) setActiveDetailCampaign(null);
        setFeedback('Campaign deleted successfully.');
        setTimeout(() => setFeedback(null), 3000);
      } catch (err) {
        console.error(err);
        alert('Failed to delete campaign.');
      }
    }
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} className="animate-fade-in">
      {/* Top Header & Launch Button */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        width: '100%'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Social Media Campaigns</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Coordinate targeted social initiatives, monitor audience milestones, and track return on effort.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Status Filter Pills */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-muted)',
            padding: '3px',
            borderRadius: 'var(--radius-md)'
          }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'planning', label: 'Planning' },
              { id: 'completed', label: 'Completed' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: filterStatus === tab.id ? 'var(--bg-surface)' : 'transparent',
                  color: filterStatus === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ padding: '0.65rem 1.4rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Beginner Explanation Callout */}
      <div className="help-box" style={{ width: '100%', boxSizing: 'border-box' }}>
        <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>What is a Campaign?</strong> A campaign bundles your content together around a single theme (such as a seasonal promotion, product reveal, or awareness drive) so you can track total reach and budget in one central view.
        </span>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success)',
          padding: '0.85rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.88rem',
          fontWeight: 600,
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Fluid Responsive Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="empty-state clean-card">
          <Target size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
          <div className="empty-state-title">No {filterStatus !== 'all' ? filterStatus : ''} campaigns found</div>
          <div className="empty-state-desc">Create your first campaign to group your posts and monitor milestone progress.</div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={16} />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
          gap: '1.5rem',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {filteredCampaigns.map(camp => {
            const target = camp.target_reach || 50000;
            // Calculate dynamic reach from linked posts if available
            const linkedPosts = posts.filter(p => Number(p.campaign_id) === Number(camp.id));
            const calculatedReach = linkedPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
            const current = calculatedReach > 0 ? calculatedReach : (camp.current_reach || 0);
            const progressPercent = Math.min(100, Math.round((current / target) * 100)) || camp.progress || 0;

            return (
              <div
                key={camp.id}
                className="clean-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  padding: '1.5rem',
                  boxSizing: 'border-box',
                  wordBreak: 'break-word',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--lavender)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Target size={18} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {camp.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span className={`badge ${
                        camp.status === 'active' ? 'badge-success' : 
                        camp.status === 'planning' ? 'badge-primary' : 'badge-neutral'
                      }`} style={{ textTransform: 'uppercase', fontSize: '0.72rem', flexShrink: 0 }}>
                        {camp.status}
                      </span>
                      <button
                        onClick={() => handleOpenEdit(camp)}
                        title="Edit Campaign"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(camp.id, camp.title)}
                        title="Delete Campaign"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {camp.description}
                  </p>
                </div>

                {/* Progress Meter with Detailed Metrics */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={14} color="var(--primary)" />
                      Audience Reach Goal
                    </span>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {current.toLocaleString()} / {target.toLocaleString()} ({progressPercent}%)
                    </span>
                  </div>

                  <div style={{
                    height: '9px',
                    backgroundColor: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                    width: '100%'
                  }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      backgroundColor: 'var(--primary)',
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  {linkedPosts.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <Layers size={12} />
                      <span>{linkedPosts.length} post{linkedPosts.length === 1 ? '' : 's'} linked to this campaign</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Budget, Target Date, and View Details Button */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '0.9rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DollarSign size={14} color="var(--primary)" />
                      Budget: <strong style={{ color: 'var(--text-primary)' }}>{camp.budget || '$1,500'}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} />
                      Until: <strong style={{ color: 'var(--text-primary)' }}>{camp.end_date || 'Ongoing'}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveDetailCampaign(camp)}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>View Campaign Details</span>
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
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div
            className="clean-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: 'calc(100vh - 2.5rem)',
              overflowY: 'auto',
              padding: '1.75rem',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Target size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {activeDetailCampaign.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveDetailCampaign(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <span className={`badge ${activeDetailCampaign.status === 'active' ? 'badge-success' : 'badge-primary'}`} style={{ alignSelf: 'flex-start' }}>
                STATUS: {activeDetailCampaign.status.toUpperCase()}
              </span>

              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {activeDetailCampaign.description}
              </p>

              <div style={{
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Target Reach</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {(activeDetailCampaign.target_reach || 50000).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Current Reach</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {(activeDetailCampaign.current_reach || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Allocated Budget</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeDetailCampaign.budget || '$1,500'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Deadline</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeDetailCampaign.end_date || 'Ongoing'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = activeDetailCampaign;
                    setActiveDetailCampaign(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1.15rem' }}
                >
                  <Edit3 size={15} />
                  <span>Edit Campaign</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailCampaign(null)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CAMPAIGN MODAL */}
      {editingCampaign && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div 
            className="clean-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: 'calc(100vh - 2.5rem)',
              overflowY: 'auto',
              padding: '1.75rem',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Edit Campaign</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Update parameters for this marketing initiative.
                </p>
              </div>
              <button 
                onClick={() => setEditingCampaign(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Goal & Strategy *</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Reach</label>
                  <input
                    type="number"
                    value={editTargetReach}
                    onChange={(e) => setEditTargetReach(e.target.value)}
                    className="form-input"
                    min="1000"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Budget</label>
                  <input
                    type="text"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="form-input"
                  >
                    <option value="active">Active</option>
                    <option value="planning">Planning</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Target End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1.15rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ padding: '0.55rem 1.25rem' }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
          boxSizing: 'border-box'
        }}>
          <div 
            className="clean-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: 'calc(100vh - 2.5rem)',
              overflowY: 'auto',
              padding: '1.75rem',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Create New Campaign</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Set up your goal, timeline, and budget parameters.
                </p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
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
                <label className="form-label">Goal & Strategy *</label>
                <textarea
                  rows={3}
                  placeholder="Describe the campaign focus (e.g., Promote product release videos across TikTok and Instagram)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Reach (Views/Audience)</label>
                  <input
                    type="number"
                    value={targetReach}
                    onChange={(e) => setTargetReach(e.target.value)}
                    className="form-input"
                    min="1000"
                    step="1000"
                  />
                  <span className="form-helper">Milestone target.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Budget (Optional)</label>
                  <input
                    type="text"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="form-input"
                    placeholder="e.g. $2,000"
                  />
                  <span className="form-helper">e.g. $1,500</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.55rem 1.15rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ padding: '0.55rem 1.25rem' }}
                >
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
