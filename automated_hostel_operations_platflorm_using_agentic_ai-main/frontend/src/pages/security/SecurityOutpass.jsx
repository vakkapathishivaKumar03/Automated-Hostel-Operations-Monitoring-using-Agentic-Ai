import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/security-dashboard.css';

const SecurityOutpass = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedOutpass, setSelectedOutpass] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [actionConfirm, setActionConfirm] = useState({ open: false, type: null, id: null });
  const [actionResult, setActionResult] = useState({ open: false, title: '', message: '', success: true });
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = getCurrentUser();

  const [outpasses, setOutpasses] = useState([]);

  useEffect(() => {
    fetchOutpasses();
  }, []);

  useEffect(() => {
    const hasOpenModal = showDetails || actionConfirm.open || actionResult.open;

    if (hasOpenModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showDetails, actionConfirm.open, actionResult.open]);

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

  const fetchOutpasses = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch('http://localhost:5000/api/security/outpasses/approved');
      const data = await response.json();
      if (data.success) {
        setOutpasses(data.data);
      }
    } catch (error) {
      console.error('Error fetching outpasses:', error);
      setActionResult({
        open: true,
        success: false,
        title: 'Load Failed',
        message: 'Failed to fetch outpasses.'
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleMarkOut = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    const securityUserId = currentUser?.userId || currentUser?.id || null;
    
    try {
      const response = await fetch(`http://localhost:5000/api/security/outpass/${id}/mark-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          security_user_id: securityUserId,
          notes: notes || 'Student exited'
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setActionResult({
          open: true,
          success: true,
          title: 'Exit Recorded',
          message: 'Student marked as OUT.'
        });
        setNotes('');
        fetchOutpasses();
      } else {
        setActionResult({
          open: true,
          success: false,
          title: 'Action Failed',
          message: data.message || 'Unable to mark student as OUT.'
        });
      }
    } catch (error) {
      console.error('Error marking exit:', error);
      setActionResult({
        open: true,
        success: false,
        title: 'Action Failed',
        message: 'Failed to mark exit.'
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleMarkIn = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    const securityUserId = currentUser?.userId || currentUser?.id || null;
    
    try {
      const response = await fetch(`http://localhost:5000/api/security/outpass/${id}/mark-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          security_user_id: securityUserId,
          notes: notes || 'Student returned'
        })
      });
      const data = await response.json();
      
      if (data.success) {
        let message = 'Student marked as RETURNED';
        if (data.is_late) {
          message += `\nStudent was ${formatLateDuration(data.late_minutes)} late.`;
          if (data.grace_period_applied) {
            message += '\nGrace period applied.';
          } else {
            message += '\nHigh-priority alert generated for warden.';
          }
        }
        setActionResult({
          open: true,
          success: true,
          title: 'Return Recorded',
          message
        });
        setNotes('');
        fetchOutpasses();
      } else {
        setActionResult({
          open: true,
          success: false,
          title: 'Action Failed',
          message: data.message || 'Unable to mark student as RETURNED.'
        });
      }
    } catch (error) {
      console.error('Error marking return:', error);
      setActionResult({
        open: true,
        success: false,
        title: 'Action Failed',
        message: 'Failed to mark return.'
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const requestConfirm = (type, id) => {
    setActionConfirm({ open: true, type, id });
  };

  const confirmAction = async () => {
    if (!actionConfirm.open || !actionConfirm.id) return;
    const { type, id } = actionConfirm;
    setActionConfirm({ open: false, type: null, id: null });
    if (type === 'out') {
      await handleMarkOut(id);
    } else {
      await handleMarkIn(id);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedOutpass(item);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedOutpass(null);
  };

  const getStatusClass = (item) => {
    const status = item?.status;
    switch(status?.toLowerCase()) {
      case 'approved': return 'approved';
      case 'exited': return 'out';
      case 'returned':
        return item?.is_late || Number(item?.late_minutes || 0) > 0 ? 'returned-late' : 'returned';
      case 'overdue': return 'rejected';
      case 'pending': return 'pending';
      default: return 'pending';
    }
  };

  const getStatusDisplay = (item) => {
    const status = item?.status?.toLowerCase();
    switch(status) {
      case 'approved': return '✅ Approved';
      case 'exited': return '🚪 Out';
      case 'returned':
        return item?.is_late || Number(item?.late_minutes || 0) > 0
          ? 'Returned Late'
          : '✔️ Returned';
      case 'overdue': return '⚠️ Overdue';
      default: return item?.status;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTimeParts = (dateStr, timeStr) => {
    if (!dateStr) return '—';
    const safeTime = timeStr || '00:00:00';
    const isoLike = `${dateStr}T${safeTime}`;
    return formatDateTime(isoLike);
  };

  const getTimelineProgress = (outpass) => {
    if (!outpass) return 0;

    if (outpass.actual_return_time || outpass.status?.toLowerCase() === 'returned') {
      return 100;
    }
    if (outpass.status?.toLowerCase() === 'overdue') {
      return 75;
    }
    if (outpass.actual_exit_time || outpass.status?.toLowerCase() === 'exited') {
      return 50;
    }
    if (outpass.status?.toLowerCase() === 'approved') {
      return 25;
    }

    return 0;
  };

  const filteredOutpasses = outpasses.filter(item => {
    const matchesSearch = !searchQuery || 
      item.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roll_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.destination?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
      item.status?.toLowerCase() === statusFilter.toLowerCase();

    let matchesDate = true;
    if (dateFilter !== 'All' && item.expected_return_time) {
      const expectedReturn = new Date(item.expected_return_time);
      const now = new Date();
      if (dateFilter === 'Today') {
        matchesDate = expectedReturn.toDateString() === now.toDateString();
      } else if (dateFilter === 'This Week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        matchesDate = expectedReturn >= weekStart && expectedReturn <= now;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const approvedCount = outpasses.filter((item) => ['approved', 'approved_otp'].includes(item.status?.toLowerCase())).length;
  const exitedCount = outpasses.filter((item) => item.status?.toLowerCase() === 'exited').length;
  const overdueCount = outpasses.filter((item) => item.status?.toLowerCase() === 'overdue').length;
  const returnedCount = outpasses.filter((item) => item.status?.toLowerCase() === 'returned').length;

  return (
    <>
      <header className="outpass-header">
            <div className="header-content">
              <h1 className="security-title-main">Outpass Management</h1>
              <p className="security-subtitle">Track student exits and returns</p>
            </div>
            <button
              className="outpass-refresh-btn"
              onClick={() => fetchOutpasses(true)}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </header>

          <section className="outpass-summary-cards">
            <div className="outpass-summary-card">
              <span className="card-label">Approved</span>
              <strong className="card-value">{approvedCount}</strong>
              <span className="card-subtitle">Awaiting exit scan</span>
            </div>
            <div className="outpass-summary-card">
              <span className="card-label">Currently Out</span>
              <strong className="card-value">{exitedCount}</strong>
              <span className="card-subtitle">Not yet returned</span>
            </div>
            <div className="outpass-summary-card outpass-summary-card-alert">
              <span className="card-label">Overdue</span>
              <strong className="card-value">{overdueCount}</strong>
              <span className="card-subtitle">Need immediate follow-up</span>
            </div>
            <div className="outpass-summary-card">
              <span className="card-label">Returned</span>
              <strong className="card-value">{returnedCount}</strong>
              <span className="card-subtitle">Completed outpass cycle</span>
            </div>
          </section>

          <section className="outpass-filters">
            <div className="filter-group wide">
              <label className="filter-label">Search</label>
              <input
                className="filter-input"
                placeholder="Search by student name or roll number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All</option>
                <option value="approved">Approved</option>
                <option value="exited">Out</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Date Range</label>
              <select
                className="filter-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option>All</option>
                <option>Today</option>
                <option>This Week</option>
              </select>
            </div>
            <div className="filter-group wide">
              <label className="filter-label">Action Notes (optional)</label>
              <input
                className="filter-input"
                placeholder="Example: ID checked at main gate"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>

          {loading ? (
            <div className="outpass-loading">Loading outpasses...</div>
          ) : filteredOutpasses.length > 0 ? (
            <>
            <section className="outpass-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Room</th>
                    <th>Destination</th>
                    <th>Reason</th>
                    <th>Expected Return</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutpasses.map((item) => (
                    <tr
                      key={item.id}
                      className={item.status === 'overdue' ? 'overdue-row' : ''}
                    >
                      <td className="student-cell">
                        <div className="student-name">{item.student_name}</div>
                      </td>
                      <td>{item.roll_number}</td>
                      <td>{item.room_number ? `${item.room_number} ${item.block_name}` : '—'}</td>
                      <td>{item.destination}</td>
                      <td>{item.reason}</td>
                      <td>{formatDateTime(item.expected_return_time)}</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(item)}`}>
                          {getStatusDisplay(item)}
                        </span>
                        {item.status === 'overdue' && (
                          <div className="overdue-note">
                            Late by {formatLateDuration(item.late_minutes || 0)}
                          </div>
                        )}
                        {item.status === 'returned' && item.is_late && item.grace_period_applied && (
                          <div className="grace-period-note">
                            ✅ Grace period applied ({formatLateDuration(item.late_minutes)} late)
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action"
                            onClick={() => handleViewDetails(item)}
                          >
                            View Details
                          </button>
                          {(item.status === 'approved' || item.status === 'approved_otp') && (
                            <button
                              className="btn-action primary"
                              onClick={() => requestConfirm('out', item.id)}
                              disabled={actionLoading[item.id]}
                            >
                              {actionLoading[item.id] && <span className="btn-spinner" />}
                              {actionLoading[item.id] ? 'Marking...' : 'Mark OUT'}
                            </button>
                          )}
                          {(item.status === 'exited' || item.status === 'overdue') && (
                            <button
                              className="btn-action primary"
                              onClick={() => requestConfirm('in', item.id)}
                              disabled={actionLoading[item.id]}
                            >
                              {actionLoading[item.id] && <span className="btn-spinner" />}
                              {actionLoading[item.id] ? 'Marking...' : 'Mark IN'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="outpass-mobile-cards">
              {filteredOutpasses.map((item) => (
                <article
                  key={`mobile-${item.id}`}
                  className={`outpass-mobile-card ${item.status === 'overdue' ? 'overdue-row' : ''}`}
                >
                  <div className="outpass-mobile-head">
                    <div>
                      <div className="student-name">{item.student_name}</div>
                      <div className="student-id">{item.roll_number}</div>
                    </div>
                    <span className={`status-badge ${getStatusClass(item)}`}>{getStatusDisplay(item)}</span>
                  </div>

                  <div className="outpass-mobile-grid">
                    <div><span>Room</span><strong>{item.room_number ? `${item.room_number} ${item.block_name}` : '—'}</strong></div>
                    <div><span>Destination</span><strong>{item.destination}</strong></div>
                    <div><span>Expected Return</span><strong>{formatDateTime(item.expected_return_time)}</strong></div>
                    <div><span>Reason</span><strong>{item.reason}</strong></div>
                  </div>

                  {item.status === 'overdue' && (
                    <div className="overdue-note">Late by {formatLateDuration(item.late_minutes || 0)}</div>
                  )}

                  {item.status === 'returned' && item.is_late && item.grace_period_applied && (
                    <div className="grace-period-note">✅ Grace period applied ({formatLateDuration(item.late_minutes)} late)</div>
                  )}

                  <div className="action-buttons">
                    <button className="btn-action" onClick={() => handleViewDetails(item)}>View Details</button>
                    {(item.status === 'approved' || item.status === 'approved_otp') && (
                      <button
                        className="btn-action primary"
                        onClick={() => requestConfirm('out', item.id)}
                        disabled={actionLoading[item.id]}
                      >
                        {actionLoading[item.id] && <span className="btn-spinner" />}
                        {actionLoading[item.id] ? 'Marking...' : 'Mark OUT'}
                      </button>
                    )}
                    {(item.status === 'exited' || item.status === 'overdue') && (
                      <button
                        className="btn-action primary"
                        onClick={() => requestConfirm('in', item.id)}
                        disabled={actionLoading[item.id]}
                      >
                        {actionLoading[item.id] && <span className="btn-spinner" />}
                        {actionLoading[item.id] ? 'Marking...' : 'Mark IN'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🚪</span>
              <p className="empty-message">
                {searchQuery || statusFilter !== 'All' 
                  ? 'No outpasses match your filters' 
                  : 'No approved outpasses at the moment'}
              </p>
            </div>
          )}

      {showDetails && selectedOutpass && (
            <div className="modal-overlay outpass-modal-overlay" onClick={closeDetails}>
          <div className="modal-content outpass-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header outpass-details-header">
              <h2>Outpass Details</h2>
              <button className="modal-close" onClick={closeDetails}>×</button>
            </div>
            <div className="modal-body outpass-details-body">
              <div className="outpass-details-grid">
                <div className="outpass-detail-card">
                  <div className="detail-label">Student</div>
                  <div className="detail-value">{selectedOutpass.student_name}</div>
                  <div className="detail-sub">{selectedOutpass.roll_number}</div>
                </div>
                <div className="outpass-detail-card">
                  <div className="detail-label">Room</div>
                  <div className="detail-value">
                    {selectedOutpass.room_number ? `${selectedOutpass.room_number} ${selectedOutpass.block_name}` : 'Not assigned'}
                  </div>
                  <div className="detail-sub">Phone: {selectedOutpass.phone || '—'}</div>
                </div>
                <div className="outpass-detail-card">
                  <div className="detail-label">Destination</div>
                  <div className="detail-value">{selectedOutpass.destination}</div>
                  <div className="detail-sub">{selectedOutpass.reason}</div>
                </div>
                <div className="outpass-detail-card">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">
                    <span className={`status-badge ${getStatusClass(selectedOutpass)}`}>
                      {getStatusDisplay(selectedOutpass)}
                    </span>
                  </div>
                  <div className="detail-sub">
                    {selectedOutpass.is_late && (
                      <>
                        {selectedOutpass.grace_period_applied 
                          ? `✅ Grace period (${formatLateDuration(selectedOutpass.late_minutes)})`
                          : `⚠️ Overdue (${formatLateDuration(selectedOutpass.late_minutes)})`
                        }
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="timeline outpass-timeline"
                style={{ '--track-width': `${getTimelineProgress(selectedOutpass)}%` }}
              >
                <div className="timeline-item outpass-timeline-item">
                  <div>Expected Departure</div>
                  <div className="timeline-time">
                    {formatDateTimeParts(selectedOutpass.out_date, selectedOutpass.out_time)}
                  </div>
                </div>
                <div className={`timeline-item outpass-timeline-item ${selectedOutpass.actual_exit_time ? 'active' : 'pending'}`}>
                  <div>Actual Exit</div>
                  <div className="timeline-time">
                    {selectedOutpass.actual_exit_time ? formatDateTime(selectedOutpass.actual_exit_time) : 'Not yet'}
                  </div>
                </div>
                <div className="timeline-item outpass-timeline-item">
                  <div>Expected Return</div>
                  <div className="timeline-time">{formatDateTime(selectedOutpass.expected_return_time)}</div>
                </div>
                <div className={`timeline-item outpass-timeline-item ${selectedOutpass.actual_return_time ? 'active' : 'pending'}`}>
                  <div>Actual Return</div>
                  <div className="timeline-time">
                    {selectedOutpass.actual_return_time ? formatDateTime(selectedOutpass.actual_return_time) : 'Not yet'}
                  </div>
                </div>
              </div>

              {selectedOutpass.security_notes && (
                <div className="notes-section">
                  <div className="detail-label">Security Notes</div>
                  <div className="notes-content">{selectedOutpass.security_notes}</div>
                </div>
              )}
            </div>
            <div className="modal-footer outpass-details-footer">
              <button className="btn-secondary outpass-details-close" onClick={closeDetails}>Close</button>
            </div>
          </div>
        </div>
      )}

      {actionConfirm.open && (
        <div className="modal-overlay outpass-modal-overlay" onClick={() => setActionConfirm({ open: false, type: null, id: null })}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Action</h2>
              <button className="modal-close" onClick={() => setActionConfirm({ open: false, type: null, id: null })}>×</button>
            </div>
            <div className="modal-body">
              <p>
                {actionConfirm.type === 'out'
                  ? 'Mark this student as EXITED?'
                  : 'Mark this student as RETURNED?'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActionConfirm({ open: false, type: null, id: null })}>Cancel</button>
              <button className="btn-action primary" onClick={confirmAction}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {actionResult.open && (
        <div className="modal-overlay outpass-modal-overlay" onClick={() => setActionResult({ open: false, title: '', message: '', success: true })}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{actionResult.title}</h2>
              <button className="modal-close" onClick={() => setActionResult({ open: false, title: '', message: '', success: true })}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-line', color: actionResult.success ? '#065f46' : '#991b1b' }}>{actionResult.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-action primary" onClick={() => setActionResult({ open: false, title: '', message: '', success: true })}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityOutpass;

