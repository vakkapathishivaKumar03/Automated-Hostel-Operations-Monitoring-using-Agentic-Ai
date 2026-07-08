import React, { useMemo, useState, useEffect } from 'react';
import { getAuthHeaders, getCurrentUser } from '../../utils/auth';
import '../../styles/warden-dashboard.css';
import '../../styles/warden-outpass.css';

const formatLateDuration = (lateMinutes) => {
  const totalMinutes = Number(lateMinutes || 0);
  if (!totalMinutes) return '0:00 hours';

  const days = Math.floor(totalMinutes / (24 * 60));
  const remaining = totalMinutes % (24 * 60);
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;

  if (days > 0) {
    return `${days} ${days === 1 ? 'day' : 'days'} ${hours}:${String(minutes).padStart(2, '0')} hours`;
  }
  return `${hours}:${String(minutes).padStart(2, '0')} hours`;
};

const WardenOutpass = () => {
  const [requests, setRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [emailStatus, setEmailStatus] = useState({});
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionErrors, setActionErrors] = useState({});
  const [showParentDetails, setShowParentDetails] = useState({});
  const [holidayModal, setHolidayModal] = useState({ open: false, message: '', success: true });
  const currentUser = getCurrentUser();

  const showHolidayModal = (message, success) => setHolidayModal({ open: true, message, success });
  const closeHolidayModal = () => setHolidayModal({ open: false, message: '', success: true });
  
  // Holiday Mode state
  const [holidayMode, setHolidayMode] = useState(false);
  
  // Fetch holiday mode status from backend
  useEffect(() => {
    const fetchHolidayMode = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/system/holiday-mode');
        const data = await res.json();
        if (data.success) {
          setHolidayMode(data.holidayMode);
        }
      } catch (error) {
        console.error('Error fetching holiday mode:', error);
      }
    };
    fetchHolidayMode();
  }, []);
  
  // Toggle holiday mode
  const toggleHolidayMode = async () => {
    const newMode = !holidayMode;
    try {
      const res = await fetch('http://localhost:5000/api/system/holiday-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          holidayMode: newMode,
          updated_by: currentUser?.userId 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHolidayMode(newMode);
        showHolidayModal(`Holiday Mode ${newMode ? 'enabled' : 'disabled'} successfully!`, true);
      }
    } catch (error) {
      console.error('Error toggling holiday mode:', error);
      showHolidayModal('Failed to toggle holiday mode. Please try again.', false);
    }
  };

  // Fetch outpasses on mount
  const fetchOutpasses = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes, rejectedRes, alertsRes] = await Promise.all([
        fetch('http://localhost:5000/api/warden/outpasses/pending', { headers: getAuthHeaders() }),
        fetch('http://localhost:5000/api/warden/outpasses/approved', { headers: getAuthHeaders() }),
        fetch('http://localhost:5000/api/warden/outpasses/rejected', { headers: getAuthHeaders() }),
        fetch('http://localhost:5000/api/warden/outpasses/alerts', { headers: getAuthHeaders() })
      ]);

      const pendingData = await pendingRes.json();
      const approvedData = await approvedRes.json();
      const rejectedData = await rejectedRes.json();
      const alertsData = await alertsRes.json();

      const all = [
        ...(Array.isArray(pendingData.data) ? pendingData.data : []),
        ...(Array.isArray(approvedData.data) ? approvedData.data : []),
        ...(Array.isArray(rejectedData.data) ? rejectedData.data : [])
      ];

      setRequests(all);
      setAlerts(Array.isArray(alertsData.data) ? alertsData.data : []);
    } catch (error) {
      console.error('Error fetching outpasses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutpasses();
  }, []);

  const filteredRequests = useMemo(() => {
    if (selectedStatus === 'alerts') {
      return alerts;
    }
    if (selectedStatus === 'approved') {
      return requests.filter((r) => 
        r.status === 'approved' || 
        r.status === 'approved_otp' || 
        r.status === 'exited' || 
        r.status === 'returned'
      );
    }
    if (selectedStatus === 'pending') {
      return requests.filter((r) => r.status === 'pending' || r.status === 'pending_otp');
    }
    return selectedStatus === 'all' ? requests : requests.filter((r) => r.status === selectedStatus);
  }, [requests, alerts, selectedStatus]);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      const endpoint = status === 'approved' 
        ? `http://localhost:5000/api/warden/outpass/${id}/approve`
        : `http://localhost:5000/api/warden/outpass/${id}/reject`;

      const rejection_reason = status === 'rejected' ? (actionDrafts[id]?.text || '') : null;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ approved_by: currentUser?.userId || null, rejection_reason })
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const message = data?.message || `Request failed with status ${res.status}`;
        setActionErrors({ ...actionErrors, [id]: message });
        return;
      }

      if (data?.success) {
        setEmailStatus({ ...emailStatus, [id]: data.email_sent });
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        setActionDrafts({ ...actionDrafts, [id]: null });
        fetchOutpasses();
      } else {
        const message = data?.message || 'Failed to update outpass';
        setActionErrors({ ...actionErrors, [id]: message });
      }
    } catch (error) {
      setActionErrors({ ...actionErrors, [id]: 'Request failed' });
      console.error('Error updating outpass:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const startAction = (id, mode) => {
    setActionDrafts({ ...actionDrafts, [id]: { mode, text: '' } });
    setActionErrors({ ...actionErrors, [id]: null });
  };

  const cancelAction = (id) => {
    setActionDrafts({ ...actionDrafts, [id]: null });
    setActionErrors({ ...actionErrors, [id]: null });
  };

  const updateDraft = (id, text) => {
    const draft = actionDrafts[id];
    setActionDrafts({ ...actionDrafts, [id]: { ...draft, text } });
  };

  const confirmAction = (id) => {
    const draft = actionDrafts[id];
    if (draft.mode === 'reject' && !draft.text.trim()) {
      setActionErrors({ ...actionErrors, [id]: 'Rejection reason is required' });
      return;
    }
    updateStatus(id, draft.mode === 'approve' ? 'approved' : 'rejected');
  };

  const toggleParentDetails = (id) => {
    setShowParentDetails({ ...showParentDetails, [id]: !showParentDetails[id] });
  };

  return (
    <div className="leave-page">
      <div className="page-header-card outpass-page-header">
        <div className="page-header-text">
          <h2>Outpass Approvals</h2>
          <p>Manage student outpass requests.</p>
        </div>

        <div className="page-header-action-group outpass-header-actions">
          {holidayMode && (
            <span className="outpass-holiday-badge">
              🎄 Holiday Mode Active
            </span>
          )}
          <label className={`outpass-holiday-toggle ${holidayMode ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={holidayMode}
              onChange={toggleHolidayMode}
              className="outpass-holiday-checkbox"
            />
            College Holiday Mode
          </label>
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
          Pending ({requests.filter(r => r.status === 'pending' || r.status === 'pending_otp').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'approved' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('approved')}
        >
          Approved ({requests.filter(r => r.status === 'approved' || r.status === 'approved_otp' || r.status === 'exited' || r.status === 'returned').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'alerts' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('alerts')}
          style={{ background: alerts.length > 0 ? '#dc2626' : undefined, color: alerts.length > 0 ? 'white' : undefined }}
        >
          🚨 Alerts ({alerts.length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('rejected')}
        >
          Rejected ({requests.filter(r => r.status === 'rejected').length})
        </button>
      </div>

      {loading ? (
        <div className="leave-page"><p>Loading outpass requests...</p></div>
      ) : filteredRequests.length === 0 ? (
        <div className="leave-empty">
          <div className="leave-empty-card">
            <div className="leave-empty-icon" aria-hidden="true">📭</div>
            <h3>No outpass requests found</h3>
            <p>No requests match the selected filter.</p>
          </div>
        </div>
      ) : (
        <div className="leave-list">
          {selectedStatus === 'alerts' && filteredRequests.length > 0 && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fca5a5', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '16px',
              color: '#991b1b'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                🚨 Active Overdue Alerts
              </h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                The following outpasses have triggered automatic overdue alerts. 
                Emails have been sent to students and/or parents.
              </p>
            </div>
          )}
          {filteredRequests.map((req) => {
            const draft = actionDrafts[req.id];
            const error = actionErrors[req.id];
            const emailSent = emailStatus[req.id];
            const rejectionReason = req.rejection_reason || '';
            const parentDetailsVisible = showParentDetails[req.id];
            const isAlertView = selectedStatus === 'alerts';
            return (
              <article className="leave-card" key={req.id}>
                <div className="leave-card-top">
                  <div>
                    <div className="leave-name">{req.student_name || 'N/A'}</div>
                    <div className="leave-meta">{req.roll_number || 'N/A'} - Room {req.room_number || 'N/A'}</div>
                  </div>
                  <div className="leave-tags">
                    <span className={`tag ${req.status === 'pending_otp' ? 'pending' : req.status === 'approved_otp' ? 'approved' : req.status}`}>
                      {req.status === 'pending_otp' ? '🔐 Pending OTP Verification' : 
                       req.status === 'approved_otp' ? '✅ Approved via Parent OTP' :
                       req.status === 'pending' && req.approvalMethod === 'manual' ? '📋 Pending Manual Approval' :
                       req.status === 'approved' && req.approvalMethod === 'manual' ? '✅ Approved Manually' :
                       req.status}
                    </span>
                    {req.monitor_state && (
                      <span className={`tag ${req.monitor_state === 'overdue' ? 'rejected' : req.monitor_state === 'grace_period' ? 'pending' : 'approved'}`}>
                        {req.monitor_state.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                    {req.student_risk_level && (
                      <span className={`tag ${req.student_risk_level}`}>
                        Risk: {req.student_risk_level.toUpperCase()}
                      </span>
                    )}
                    {emailSent === true && <span className="tag email-success">Email sent</span>}
                    {emailSent === false && <span className="tag email-failed">Email failed</span>}
                  </div>
                </div>

                {isAlertView && (
                  <div className="leave-reason" style={{ background: '#fee2e2', borderColor: '#fca5a5' }}>
                    <div className="leave-label" style={{ color: '#991b1b' }}>🚨 Alert Generated</div>
                    <div className="leave-value" style={{ color: '#7f1d1d' }}>
                      {req.alert_to_student && '✅ Student email sent'}
                      {req.alert_to_student && req.alert_to_parent && ' - '}
                      {req.alert_to_parent && '✅ Parent email sent'}
                      {req.alert_sent_at && ` - Alert time: ${new Date(req.alert_sent_at).toLocaleString()}`}
                      {req.late_minutes && ` - Delay: ${formatLateDuration(req.late_minutes)}`}
                    </div>
                  </div>
                )}

                {req.has_overdue_warning && (
                  <div className="leave-reason" style={{ background: '#fff7ed', borderColor: '#fdba74' }}>
                    <div className="leave-label" style={{ color: '#b45309' }}>⚠ Previous overdue return detected</div>
                    <div className="leave-value" style={{ color: '#9a3412' }}>
                      {req.warning_message} - Overdue count: {req.previous_overdue_count || 0}
                      {req.last_overdue_at ? ` - Last overdue: ${new Date(req.last_overdue_at).toLocaleDateString('en-GB')}` : ''}
                    </div>
                  </div>
                )}

                {!isAlertView && req.has_alert && (
                  <div className="leave-reason" style={{ background: '#fef3c7', borderColor: '#fcd34d' }}>
                    <div className="leave-label" style={{ color: '#92400e' }}>⚠️ Alert Sent</div>
                    <div className="leave-value" style={{ color: '#78350f' }}>
                      Overdue alerts have been sent for this outpass
                      {req.alert_sent_at && ` on ${new Date(req.alert_sent_at).toLocaleString()}`}
                    </div>
                  </div>
                )}

                <div className="leave-grid">
                  <div>
                    <div className="leave-label">Destination</div>
                    <div className="leave-value">{req.destination || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="leave-label">Departure</div>
                    <div className="leave-value">{req.out_date || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="leave-label">Expected Return</div>
                    <div className="leave-value">{req.expected_return_time || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="leave-label">Request Date</div>
                    <div className="leave-value">{req.created_at ? new Date(req.created_at).toLocaleDateString('en-GB') : 'N/A'}</div>
                  </div>
                </div>

                {req.reason && (
                  <div className="leave-reason">
                    <div className="leave-label">Reason</div>
                    <div className="leave-value">{req.reason}</div>
                  </div>
                )}

                <div className="leave-reason">
                  <div className="leave-label">Parent/Guardian Information</div>
                  <button className="link-btn" type="button" onClick={() => toggleParentDetails(req.id)}>
                    {parentDetailsVisible ? 'Hide Parent Details' : 'Show Parent Details'}
                  </button>
                  {parentDetailsVisible && (
                    <div className="leave-value" style={{ marginTop: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                        <strong>Parent Name:</strong>
                        <span>{req.parent_name || 'Not provided'}</span>
                        <strong>Parent Phone:</strong>
                        <span>{req.parent_phone || 'Not provided'}</span>
                        <strong>Parent Email:</strong>
                        <span>{req.parent_email || 'Not provided'}</span>
                        <strong>Emergency Contact:</strong>
                        <span>{req.emergency_contact || req.student_phone || 'Not provided'}</span>
                        <strong>Student Phone:</strong>
                        <span>{req.student_phone || 'Not provided'}</span>
                        <strong>Student Email:</strong>
                        <span>{req.student_email || 'Not provided'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {rejectionReason && (
                  <div className="leave-reason rejection-reason">
                    <div className="leave-label">Rejection Reason</div>
                    <div className="leave-value">{rejectionReason}</div>
                  </div>
                )}

                {/* Only show manual approval actions if not OTP-approved */}
                {req.status !== 'approved_otp' && req.status !== 'pending_otp' && (
                  <div className="leave-actions">
                    <button
                      className="action-btn approve"
                      onClick={() => startAction(req.id, 'approve')}
                      disabled={req.status !== 'pending' || isAlertView}
                    >
                      ✅ Approve
                    </button>
                    <button
                      className="action-btn reject"
                      onClick={() => startAction(req.id, 'reject')}
                      disabled={req.status !== 'pending' || isAlertView}
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}
                
                {/* Info message for OTP-approved outpasses */}
                {req.status === 'approved_otp' && (
                  <div style={{ padding: '0.75rem', background: '#d1fae5', border: '1px solid #10b981', borderRadius: '6px', color: '#065f46', fontSize: '14px' }}>
                    ℹ️ This outpass was automatically approved via parent OTP verification. No manual action needed.
                  </div>
                )}
                
                {req.status === 'pending_otp' && (
                  <div style={{ padding: '0.75rem', background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: '6px', color: '#1e40af', fontSize: '14px' }}>
                    ℹ️ Student is completing OTP verification with parent. This will auto-approve once verified.
                  </div>
                )}

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
                      <button className="action-btn ghost" onClick={() => cancelAction(req.id)} disabled={updatingId === req.id}>
                        Cancel
                      </button>
                      <button className="action-btn primary" onClick={() => confirmAction(req.id)} disabled={updatingId === req.id}>
                        {updatingId === req.id && <span className="btn-spinner" />}
                        {updatingId === req.id ? 'Processing...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {holidayModal.open && (
        <div className="modal-overlay" onClick={closeHolidayModal}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '16px', margin: 0 }}>
                {holidayModal.success ? '🎄 Holiday Mode' : '⚠️ Error'}
              </h2>
              <button className="modal-close" onClick={closeHolidayModal}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: holidayModal.success ? '#065f46' : '#991b1b', fontWeight: 500 }}>
                {holidayModal.message}
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={closeHolidayModal}
                style={{
                  padding: '8px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: holidayModal.success ? '#16a34a' : '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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

export default WardenOutpass;



