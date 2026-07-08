import React, { useEffect, useMemo, useState } from 'react';
import { getAuthHeaders } from '../../utils/auth';
import '../../styles/warden-complaints.css';

const parseDate = (value) => new Date(`${value}T00:00:00`);
const API_BASE_URL = 'http://localhost:5000';

const WardenLeave = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReasons, setExpandedReasons] = useState({});
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionErrors, setActionErrors] = useState({});
  const [emailStatus, setEmailStatus] = useState({});
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [historyModal, setHistoryModal] = useState({ open: false, roll: '', name: '' });
  const [historyState, setHistoryState] = useState({ loading: false, items: [] });
  const [feedbackModal, setFeedbackModal] = useState({ open: false, message: '', success: true });

  const showFeedbackModal = (message, success) => setFeedbackModal({ open: true, message, success });
  const closeFeedbackModal = () => setFeedbackModal({ open: false, message: '', success: true });
  const [agenticData, setAgenticData] = useState({
    status_summary: {},
    alerts: [],
    new_request_alerts: [],
    recommendations: [],
    weekly_insights: {}
  });

  // Fetch leave requests from database
  useEffect(() => {
    fetchLeaveRequests();
    fetchAgenticLeaveMonitor();

    const poller = setInterval(() => {
      fetchAgenticLeaveMonitor();
    }, 60000);

    return () => clearInterval(poller);
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/warden/leaves/pending`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgenticLeaveMonitor = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/warden/leaves/agentic-monitor`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.data) {
        setAgenticData({
          status_summary: data.data.status_summary || {},
          alerts: Array.isArray(data.data.alerts) ? data.data.alerts : [],
          new_request_alerts: Array.isArray(data.data.new_request_alerts) ? data.data.new_request_alerts : [],
          recommendations: Array.isArray(data.data.recommendations) ? data.data.recommendations : [],
          weekly_insights: data.data.weekly_insights || {}
        });
      }
    } catch (error) {
      console.error('Error fetching leave agentic monitor:', error);
    }
  };

  const filteredRequests = selectedStatus === 'all' 
    ? requests 
    : requests.filter((req) => req.status === selectedStatus);

  const openHistory = (roll, name) => {
    setHistoryModal({ open: true, roll, name });
    setHistoryState({ loading: true, items: [] });
    fetchLeaveHistory(roll);
  };

  const fetchLeaveHistory = async (roll) => {
    try {
      const response = await fetch(`http://localhost:5000/api/warden/leave-history/${encodeURIComponent(roll)}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setHistoryState({ loading: false, items: data.data || [] });
      } else {
        setHistoryState({ loading: false, items: [] });
      }
    } catch (error) {
      console.error('Error fetching leave history:', error);
      setHistoryState({ loading: false, items: [] });
    }
  };

  const closeHistory = () => {
    setHistoryModal({ open: false, roll: '', name: '' });
    setHistoryState({ loading: false, items: [] });
  };

  useEffect(() => {
    if (!historyModal.open) return;
    const handler = (event) => {
      if (event.key === 'Escape') closeHistory();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [historyModal.open]);

  const historySummary = useMemo(() => {
    if (!historyModal.open) return { total: 0, last30: 0 };
    const items = historyState.items;
    const total = items.length;
    const now = new Date();
    const last30 = items.filter((item) => {
      const toDate = parseDate(item.to_date || item.to);
      const diff = now.getTime() - toDate.getTime();
      return diff <= 30 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, last30 };
  }, [historyModal.open, historyState.items]);

  const toggleReason = (id) => {
    setExpandedReasons((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startAction = (id, mode) => {
    setActionDrafts((prev) => ({ ...prev, [id]: { mode, text: prev[id]?.text || '' } }));
    setActionErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const updateDraft = (id, text) => {
    setActionDrafts((prev) => ({ ...prev, [id]: { ...prev[id], text } }));
  };

  const cancelAction = (id) => {
    setActionDrafts((prev) => ({ ...prev, [id]: undefined }));
    setActionErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const confirmAction = async (id) => {
    const draft = actionDrafts[id];
    if (!draft) return;
    if (draft.mode === 'reject' && !draft.text.trim()) {
      setActionErrors((prev) => ({ ...prev, [id]: 'Rejection reason is required.' }));
      return;
    }
    setProcessingId(id);

    // Get user from localStorage (using correct key 'hostelUser')
    const userStr = localStorage.getItem('hostelUser');
    if (!userStr) {
      showFeedbackModal('User not authenticated. Please log in again.', false);
      setProcessingId(null);
      return;
    }

    let user;
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      showFeedbackModal('Error parsing user data. Please log in again.', false);
      setProcessingId(null);
      return;
    }

    if (!user || (!user.userId && !user.id)) {
      showFeedbackModal('User ID not found. Please log in again.', false);
      setProcessingId(null);
      return;
    }

    const userId = user.userId || user.id;
    const endpoint = draft.mode === 'approve' 
    ? `${API_BASE_URL}/api/warden/leave/${id}/approve`
    : `${API_BASE_URL}/api/warden/leave/${id}/reject`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ 
          approved_by: userId,
          remark: draft.mode === 'approve' ? draft.text.trim() : undefined,
          rejection_reason: draft.mode === 'reject' ? draft.text.trim() : undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        fetchLeaveRequests(); // Refresh list
        cancelAction(id);
        if (typeof data.email_sent === 'boolean') {
          setEmailStatus((prev) => ({ ...prev, [id]: data.email_sent }));
        }
        if (data.email_sent === false) {
          showFeedbackModal('Leave processed, but email failed to send. Check backend logs or email configuration.', false);
        } else {
          showFeedbackModal(`Leave ${draft.mode === 'approve' ? 'approved' : 'rejected'} successfully`, true);
        }
      } else {
        showFeedbackModal('Failed to process leave: ' + data.message, false);
      }
    } catch (error) {
      console.error('Error processing leave:', error);
      showFeedbackModal('Error processing leave request: ' + error.message, false);
    } finally {
      setProcessingId(null);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB');
  };

  return (
    <div className="leave-page">
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Leave Approvals</h2>
          <p>Review and manage student leave requests</p>
        </div>
      </div>

      <div className="agentic-summary-grid" style={{ marginBottom: '16px' }}>
        <div className="agentic-tile critical">
          <div className="agentic-label">Pending Too Long</div>
          <div className="agentic-value">{agenticData.status_summary.pending_too_long || 0}</div>
        </div>
        <div className="agentic-tile warning">
          <div className="agentic-label">Active Leaves</div>
          <div className="agentic-value">{agenticData.status_summary.active || 0}</div>
        </div>
        <div className="agentic-tile info">
          <div className="agentic-label">Completed</div>
          <div className="agentic-value">{agenticData.status_summary.completed || 0}</div>
        </div>
        <div className="agentic-tile success">
          <div className="agentic-label">Suspicious Alerts</div>
          <div className="agentic-value">{agenticData.alerts.length || 0}</div>
        </div>
      </div>

      <div className="leave-filters">
        <button 
          className={`filter-btn ${selectedStatus === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('all')}
        >
          All ({requests.length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('pending')}
        >
          Pending ({requests.filter(r => r.status === 'pending').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'approved' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('approved')}
        >
          Approved ({requests.filter(r => r.status === 'approved').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'active' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('active')}
        >
          Active ({requests.filter(r => r.status === 'active').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'completed' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('completed')}
        >
          Completed ({requests.filter(r => r.status === 'completed').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'expired' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('expired')}
        >
          Expired ({requests.filter(r => r.status === 'expired').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('rejected')}
        >
          Rejected ({requests.filter(r => r.status === 'rejected').length})
        </button>
      </div>

      {loading ? (
        <div className="leave-page"><p>Loading leave requests...</p></div>
      ) : filteredRequests.length === 0 ? (
        <div className="leave-empty">
          <div className="leave-empty-card">
            <div className="leave-empty-icon" aria-hidden="true">📭</div>
            <h3>No leave requests found</h3>
            <p>No requests match the selected filter.</p>
          </div>
        </div>
      ) : (
        <div className="leave-list">
          {filteredRequests.map((req) => {
            const isExpanded = expandedReasons[req.id];
            const draft = actionDrafts[req.id];
            const error = actionErrors[req.id];
            const emailSent = emailStatus[req.id];
            const reasonText = req.leave_reason || req.reason || '';
            const rejectionReason = req.rejection_reason || '';
            const trimmed = reasonText.length > 90 ? `${reasonText.slice(0, 90)}...` : reasonText;
            return (
              <article className="leave-card" key={req.id}>
                <div className="leave-card-top">
                  <div>
                    <div className="leave-name">{req.student_name || 'N/A'}</div>
                    <div className="leave-meta">{req.roll_number || 'N/A'} - Room {req.room_number || 'N/A'}</div>
                  </div>
                  <div className="leave-tags">
                    <span className={`tag ${req.status}`}>{req.status}</span>
                    {emailSent === true && <span className="tag email-success">Email sent</span>}
                    {emailSent === false && <span className="tag email-failed">Email failed</span>}
                  </div>
                </div>

                <div className="leave-grid">
                  <div>
                    <div className="leave-label">Leave Type</div>
                    <div className="leave-value">{(req.leave_type || 'N/A').charAt(0).toUpperCase() + (req.leave_type || '').slice(1).replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="leave-label">Date Range</div>
                    <div className="leave-value">{formatDate(req.from_date)} → {formatDate(req.to_date)}</div>
                  </div>
                  <div>
                    <div className="leave-label">Total Days</div>
                    <div className="leave-value">{req.total_days || 0} days</div>
                  </div>
                  <div>
                    <div className="leave-label">Request Date</div>
                    <div className="leave-value">{formatDate(req.created_at)}</div>
                  </div>
                </div>

                <div className="leave-reason">
                  <div className="leave-label">Reason</div>
                  <div className="leave-value">
                    {isExpanded ? reasonText : trimmed}
                    {reasonText.length > 90 && (
                      <button className="link-btn" type="button" onClick={() => toggleReason(req.id)}>
                        {isExpanded ? 'View Less' : 'View More'}
                      </button>
                    )}
                  </div>
                </div>

                {rejectionReason && (
                  <div className="leave-reason rejection-reason">
                    <div className="leave-label">Rejection Reason</div>
                    <div className="leave-value">{rejectionReason}</div>
                  </div>
                )}

                <div className="leave-actions">
                  <button
                    className="action-btn approve"
                    onClick={() => startAction(req.id, 'approve')}
                    disabled={req.status !== 'pending'}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="action-btn reject"
                    onClick={() => startAction(req.id, 'reject')}
                    disabled={req.status !== 'pending'}
                  >
                    ❌ Reject
                  </button>
                  <button className="action-btn history" onClick={() => openHistory(req.roll_number, req.student_name)}>
                    📜 View Previous Leaves
                  </button>
                  {req.notified && <span className="leave-notify">Student notified</span>}
                </div>

                {draft && (
                  <div className="leave-action-panel">
                    <div className="leave-label">
                      {draft.mode === 'approve' ? 'Optional remark' : 'Rejection reason'}
                    </div>
                    <textarea
                      value={draft.text}
                      onChange={(event) => updateDraft(req.id, event.target.value)}
                      placeholder={draft.mode === 'approve' ? 'Add a note for the student (optional)' : 'Provide a reason for rejection'}
                      rows={3}
                    />
                    {error && <div className="leave-error">{error}</div>}
                    <div className="leave-action-buttons">
                      <button className="action-btn ghost" onClick={() => cancelAction(req.id)} disabled={processingId === req.id}>
                        Cancel
                      </button>
                      <button className="action-btn primary" onClick={() => confirmAction(req.id)} disabled={processingId === req.id}>
                        {processingId === req.id && <span className="btn-spinner" />}
                        {processingId === req.id ? 'Processing...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {historyModal.open && (
        <div className="leave-modal" role="dialog" aria-modal="true">
          <div className="leave-modal-backdrop" onClick={closeHistory} />
          <div className="leave-modal-card">
            <div className="leave-modal-header">
              <div>
                <h2>Previous Leaves</h2>
                <p>
                  {historyModal.name} - {historyModal.roll}
                  <span className="leave-badge">Last 30 days</span>
                </p>
              </div>
              <button className="close-btn" onClick={closeHistory} aria-label="Close modal">✕</button>
            </div>

            <div className="leave-summary">
              <div>
                <div className="leave-label">Total leaves this semester</div>
                <div className="leave-value">{historySummary.total}</div>
              </div>
              <div>
                <div className="leave-label">Last 30 days</div>
                <div className="leave-value">{historySummary.last30}</div>
              </div>
            </div>

            {historyState.loading ? (
              <div className="leave-loading">Loading leave history...</div>
            ) : (
              <div className="leave-history-list">
                {historyState.items.length === 0 ? (
                  <div className="leave-empty-history">No previous leaves found.</div>
                ) : (
                  historyState.items.map((item) => (
                    <div className="leave-history-row" key={item.id}>
                      <div>
                        <div className="leave-value">{formatDate(item.from_date || item.from)} → {formatDate(item.to_date || item.to)}</div>
                        <div className="leave-label">{(item.leave_type || item.type || '').charAt(0).toUpperCase() + (item.leave_type || item.type || '').slice(1).replace('_', ' ')}</div>
                      </div>
                      <div className="leave-history-meta">
                        <span className={`tag ${(item.status || '').toLowerCase()}`}>{(item.status || '').charAt(0).toUpperCase() + (item.status || '').slice(1)}</span>
                        {(item.approved_by_name || item.approvedBy) && <span className="leave-label">Approved by {item.approved_by_name || item.approvedBy}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {feedbackModal.open && (
        <div className="leave-modal-overlay" onClick={closeFeedbackModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                {feedbackModal.success ? '✅ Success' : '⚠️ Error'}
              </h2>
              <button onClick={closeFeedbackModal} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ margin: 0, color: feedbackModal.success ? '#065f46' : '#991b1b', fontWeight: 500 }}>
                {feedbackModal.message}
              </p>
            </div>
            <div style={{ padding: '12px 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeFeedbackModal}
                style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: feedbackModal.success ? '#16a34a' : '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardenLeave;


