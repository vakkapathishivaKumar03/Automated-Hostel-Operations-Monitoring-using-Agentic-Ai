import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/student-leave.css';

const StudentLeave = () => {
  const currentUser = getCurrentUser();
  const [showModal, setShowModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 1)); // February 2026
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messageModal, setMessageModal] = useState({
    open: false,
    title: '',
    message: '',
    success: true,
  });
  const [formData, setFormData] = useState({
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: '',
  });

  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (showModal) {
      window.dispatchEvent(new Event('hostel:close-mobile-sidebar'));
    }
  }, [showModal]);

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        if (!currentUser?.userId) return;
        
        const res = await fetch(`http://localhost:5000/api/student/leaves/${currentUser.userId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setLeaves(data.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching leaves:', error);
        setLoading(false);
      }
    };
    
    fetchLeaves();
  }, [currentUser?.userId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === 'fromDate' && next.toDate && next.toDate < value) {
        next.toDate = value;
      }

      return next;
    });
  };

  const showMessageModal = (title, message, success = true) => {
    setMessageModal({
      open: true,
      title,
      message,
      success,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const today = getTodayDateString();
    
    // Validate form
    if (!formData.leaveType || !formData.fromDate || !formData.toDate || !formData.reason) {
      showMessageModal('Missing Details', 'Please fill in all required fields.', false);
      return;
    }

    if (new Date(formData.toDate) < new Date(formData.fromDate)) {
      showMessageModal('Invalid Dates', 'End date must be after start date.', false);
      return;
    }

    if (formData.fromDate < today || formData.toDate < today) {
      showMessageModal('Invalid Dates', 'Leave dates cannot be in the past.', false);
      return;
    }

    if (!currentUser?.userId) {
      showMessageModal('Authentication Required', 'You are not authenticated. Please log in again.', false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/student/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: currentUser.userId,
          leave_type: formData.leaveType,
          from_date: formData.fromDate,
          to_date: formData.toDate,
          reason: formData.reason,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Optimistically add to list
        setLeaves(prev => [{
          id: data.id || Date.now(),
          leave_type: formData.leaveType,
          from_date: formData.fromDate,
          to_date: formData.toDate,
          reason: formData.reason,
          status: 'pending',
          request_date: new Date().toISOString(),
        }, ...prev]);
        setFormData({
          leaveType: '',
          fromDate: '',
          toDate: '',
          reason: '',
        });
        setShowModal(false);
        showMessageModal('Request Submitted', 'Leave request submitted successfully!');
      } else {
        showMessageModal('Submission Failed', data.message || 'Failed to submit leave request.', false);
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      showMessageModal('Network Error', `Network error: ${error.message}`, false);
    } finally {
      setSubmitting(false);
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const parseLeaveDate = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    if (typeof value === 'string') {
      const datePart = value.split('T')[0].split(' ')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day);
      }
    }

    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) {
      return null;
    }
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  };

  // Build map of leave day status for the current month
  const getLeaveDayStatusMap = () => {
    const statusMap = {};
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth();

    leaves.forEach((leave) => {
      if (!leave.from_date || !leave.to_date) return;

      const start = parseLeaveDate(leave.from_date);
      const end = parseLeaveDate(leave.to_date);

      if (!start || !end) return;

      const startDate = start <= end ? start : end;
      const endDate = end >= start ? end : start;

      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        if (cursor.getFullYear() === currentYear && cursor.getMonth() === currentMonthIndex) {
          const dayNumber = cursor.getDate();

          if (leave.status === 'completed') {
            statusMap[dayNumber] = 'completed';
          } else if (leave.status === 'approved' && statusMap[dayNumber] !== 'completed') {
            statusMap[dayNumber] = 'approved';
          } else if (
            leave.status === 'pending' &&
            statusMap[dayNumber] !== 'approved' &&
            statusMap[dayNumber] !== 'completed'
          ) {
            statusMap[dayNumber] = 'pending';
          } else if (
            leave.status === 'rejected' &&
            statusMap[dayNumber] !== 'approved' &&
            statusMap[dayNumber] !== 'pending' &&
            statusMap[dayNumber] !== 'completed'
          ) {
            statusMap[dayNumber] = 'rejected';
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return statusMap;
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const leaveDayStatusMap = getLeaveDayStatusMap();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  return (
    <>
          <main className="student-main">
          {/* HEADER */}
          <header className="page-header-card leave-header">
            <div className="page-header-text">
              <h2 className="leave-title">Leave Requests</h2>
              <p className="leave-subtitle">Request leave to stay in hostel and skip college</p>
            </div>
            <button
              className="primary-action-btn request-leave-btn"
              onClick={() => setShowModal(true)}
            >
              + Request Leave
            </button>
          </header>

          {/* LEAVE CALENDAR SECTION */}
          <section className="leave-calendar-section">
            <h2 className="calendar-title">My Leave Calendar</h2>
            
            <div className="calendar-container">
              <div className="calendar-header">
                <button className="calendar-nav-btn" onClick={prevMonth}>
                  ←
                </button>
                <h3 className="calendar-month">{monthName}</h3>
                <button className="calendar-nav-btn" onClick={nextMonth}>
                  →
                </button>
              </div>

              <div className="calendar-weekdays">
                <div className="weekday">Sun</div>
                <div className="weekday">Mon</div>
                <div className="weekday">Tue</div>
                <div className="weekday">Wed</div>
                <div className="weekday">Thu</div>
                <div className="weekday">Fri</div>
                <div className="weekday">Sat</div>
              </div>

              <div className="calendar-days">
                {calendarDays.map((day, index) => (
                  (() => {
                    const dayStatus = day ? leaveDayStatusMap[day] : null;
                    return (
                  <div
                    key={index}
                    className={`calendar-day ${day ? 'active' : 'empty'} ${
                      dayStatus === 'completed' ? 'completed' : ''
                    } ${
                      dayStatus === 'approved' ? 'approved' : ''
                    } ${
                      dayStatus === 'pending' ? 'pending' : ''
                    } ${
                      dayStatus === 'rejected' ? 'rejected' : ''
                    }`}
                  >
                    {day && (
                      <>
                        {day}
                        {dayStatus && <div className={`approved-indicator ${dayStatus}`}></div>}
                      </>
                    )}
                  </div>
                    );
                  })()
                ))}
              </div>

              <div className="calendar-legend">
                <div className="legend-item">
                  <div className="legend-color pending-legend"></div>
                  <span>Pending leave days</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color rejected-legend"></div>
                  <span>Rejected leave days</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color approved-legend"></div>
                  <span>Approved leave days</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color completed-legend"></div>
                  <span>Completed leave days</span>
                </div>
              </div>
            </div>
          </section>

          {/* REQUEST HISTORY SECTION */}
          <section className="leave-history-section">
            <h2 className="history-title">Request History</h2>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading leave requests...</div>
            ) : leaves.length === 0 ? (
              <div className="history-empty">
                <p className="history-empty-text">No leave requests yet</p>
              </div>
            ) : (
              <div className="leave-list">
                {leaves.map((leave) => (
                  <div key={leave.id} className="leave-item" style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    backgroundColor: leave.status === 'approved' ? '#f0fdf4' : leave.status === 'rejected' ? '#fef2f2' : '#fffbeb'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0' }}>{leave.leave_type || 'Leave Request'}</h4>
                        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                          {leave.from_date && new Date(leave.from_date).toLocaleDateString('en-GB')} - {leave.to_date && new Date(leave.to_date).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <span style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: leave.status === 'approved' ? '#dcfce7' : leave.status === 'rejected' ? '#fee2e2' : '#fef08a',
                        color: leave.status === 'approved' ? '#166534' : leave.status === 'rejected' ? '#991b1b' : '#78350f',
                      }}>
                        {leave.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                    {leave.reason && (
                      <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                        {leave.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          </main>

      {/* MODAL OVERLAY */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container">
            {/* MODAL CARD */}
            <div className="modal-card modal-content" onClick={(e) => e.stopPropagation()}>
            {/* MODAL HEADER */}
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Request Leave</h2>
                <p className="modal-subtitle">
                  Submit a request to stay in hostel and not attend college
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* MODAL FORM */}
            <form className="modal-form" onSubmit={handleSubmit}>
              {/* Leave Type Field */}
              <div className="form-group">
                <label htmlFor="leaveType" className="form-label">
                  Leave Type *
                </label>
                <select
                  id="leaveType"
                  name="leaveType"
                  className="form-select"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                >
                  <option value="">Select leave type...</option>
                  <option value="medical">Medical / Sick</option>
                  <option value="personal">Personal</option>
                  <option value="family_emergency">Family Emergency</option>
                  <option value="vacation">Vacation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fromDate" className="form-label">
                    From Date *
                  </label>
                  <input
                    type="date"
                    id="fromDate"
                    name="fromDate"
                    className="form-input"
                    value={formData.fromDate}
                    onChange={handleInputChange}
                    min={getTodayDateString()}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="toDate" className="form-label">
                    To Date *
                  </label>
                  <input
                    type="date"
                    id="toDate"
                    name="toDate"
                    className="form-input"
                    value={formData.toDate}
                    onChange={handleInputChange}
                    min={formData.fromDate || getTodayDateString()}
                  />
                </div>
              </div>

              {/* Reason Field */}
              <div className="form-group">
                <label htmlFor="reason" className="form-label">
                  Reason for Leave *
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  className="form-textarea"
                  placeholder="Explain why you need leave from college..."
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows="4"
                />
              </div>

              {/* Modal Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="modal-submit-btn"
                  disabled={submitting}
                  style={{
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {messageModal.open && (
        <div className="modal-overlay" onClick={() => setMessageModal({ open: false, title: '', message: '', success: true })}>
          <div className="modal-container">
            <div className="modal-card modal-content leave-feedback-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">{messageModal.title}</h2>
                  <p className="modal-subtitle">{messageModal.success ? 'Completed successfully' : 'Please review and try again'}</p>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setMessageModal({ open: false, title: '', message: '', success: true })}
                  title="Close"
                >
                  ✕
                </button>
              </div>
              <div className="leave-feedback-body">
                <p className={`leave-feedback-text ${messageModal.success ? 'is-success' : 'is-error'}`}>
                  {messageModal.message}
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-submit-btn"
                  onClick={() => setMessageModal({ open: false, title: '', message: '', success: true })}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentLeave;



