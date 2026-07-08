import { useState, useEffect } from 'react';
import { getAuthHeaders, getCurrentUser } from '../../utils/auth';
import '../../styles/warden-room-change-requests.css';

const RoomChangeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    title: '',
    message: '',
    success: false
  });

  const showFeedbackModal = (title, message, success = false) => {
    setFeedbackModal({ open: true, title, message, success });
  };

  useEffect(() => {
    if (selectedRequest) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [selectedRequest]);

  // Fetch room change requests from database
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/warden/room-change-requests', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching room change requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter requests
  const getFilteredRequests = () => {
    return requests.filter(req => {
      const statusMatch = statusFilter === 'All' || req.status === statusFilter;
      const searchMatch = 
        (req.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.roll_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.current_room_number || '').includes(searchTerm);
      return statusMatch && searchMatch;
    });
  };

  const filteredRequests = getFilteredRequests();

  // Handle approve
  const handleApprove = async (id) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const user = getCurrentUser();
      if (!user || !user.userId) {
        showFeedbackModal('Authentication Required', 'User not logged in. Please login again.');
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/warden/room-change-request/${id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ approved_by: user.userId })
      });
      const data = await response.json();
      if (data.success) {
        fetchRequests(); // Refresh list
        showFeedbackModal('Request Approved', 'Room change request approved successfully', true);
      } else {
        showFeedbackModal('Approval Failed', `Failed to approve request: ${data.message}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      showFeedbackModal('Approval Error', `Error approving request: ${error.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Handle reject
  const handleReject = async (id, reason) => {
    if (actionLoading[id]) return;
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const user = getCurrentUser();
      if (!user || !user.userId) {
        showFeedbackModal('Authentication Required', 'User not logged in. Please login again.');
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/warden/room-change-request/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ 
          approved_by: user.userId,
          rejection_reason: reason || 'Room not available'
        })
      });
      const data = await response.json();
      if (data.success) {
        fetchRequests(); // Refresh list
        showFeedbackModal('Request Rejected', 'Room change request rejected', true);
      } else {
        showFeedbackModal('Rejection Failed', `Failed to reject request: ${data.message}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      showFeedbackModal('Rejection Error', `Error rejecting request: ${error.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Get status color class
  const getStatusClass = (status) => {
    switch(status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      default: return '';
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB');
  };

  // Available beds calculation
  const getAvailableBeds = (capacity, occupied) => {
    return (capacity || 0) - (occupied || 0);
  };

  if (loading) {
    return <div className="room-change-page"><p>Loading room change requests...</p></div>;
  }

  return (
    <div className="room-change-page">
      {/* Page Header */}
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Room Change Requests</h2>
          <p>Review and manage room change applications</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, roll number, or room..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-filter">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length > 0 ? (
        <div>
          <div className="requests-table-container requests-desktop-table">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Current Room</th>
                  <th>Requested Room</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => (
                  <tr key={request.id}>
                    <td className="cell-name">
                      <div className="name-cell">
                        <div className="avatar">{(request.student_name || 'U').charAt(0)}</div>
                        <div>
                          <p className="name">{request.student_name || 'N/A'}</p>
                          <p className="branch">{request.branch || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td>{request.roll_number || 'N/A'}</td>
                    <td>
                      <span className="room-badge">{request.current_room_number || 'N/A'}</span>
                      <span className="room-block">{request.current_block_name || 'N/A'}</span>
                    </td>
                    <td>
                      <span className="room-badge requested">{request.requested_room_number || 'N/A'}</span>
                      <span className="room-block">{request.requested_block_name || 'N/A'}</span>
                    </td>
                    <td className="reason-cell">{request.preference_reason || 'N/A'}</td>
                    <td className="date-cell">{formatDate(request.created_at)}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(request.status)}`}>
                        {(request.status || 'pending').charAt(0).toUpperCase() + (request.status || 'pending').slice(1)}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn-details"
                        onClick={() => setSelectedRequest(request)}
                      >
                        View
                      </button>
                      {request.status === 'pending' && (
                        <>
                          <button 
                            className="btn-approve"
                            onClick={() => handleApprove(request.id)}
                            disabled={actionLoading[request.id]}
                          >
                            {actionLoading[request.id] && <span className="btn-spinner" />}
                            {actionLoading[request.id] ? 'Processing...' : 'Approve'}
                          </button>
                          <button 
                            className="btn-reject"
                            onClick={() => handleReject(request.id, 'Room not available')}
                            disabled={actionLoading[request.id]}
                          >
                            {actionLoading[request.id] && <span className="btn-spinner" />}
                            {actionLoading[request.id] ? 'Processing...' : 'Reject'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="requests-mobile-cards">
            {filteredRequests.map((request) => (
              <article key={request.id} className="request-mobile-card">
                <div className="request-mobile-header">
                  <div className="name-cell">
                    <div className="avatar">{(request.student_name || 'U').charAt(0)}</div>
                    <div>
                      <p className="name">{request.student_name || 'N/A'}</p>
                      <p className="branch">{request.branch || 'N/A'}</p>
                    </div>
                  </div>
                  <span className={`status-badge ${getStatusClass(request.status)}`}>
                    {(request.status || 'pending').charAt(0).toUpperCase() + (request.status || 'pending').slice(1)}
                  </span>
                </div>

                <div className="request-mobile-grid">
                  <div className="request-mobile-item">
                    <span className="label">Roll Number</span>
                    <span className="value">{request.roll_number || 'N/A'}</span>
                  </div>
                  <div className="request-mobile-item">
                    <span className="label">Date</span>
                    <span className="value">{formatDate(request.created_at)}</span>
                  </div>
                  <div className="request-mobile-item">
                    <span className="label">Current Room</span>
                    <span className="value">{request.current_room_number || 'N/A'} ({request.current_block_name || 'N/A'})</span>
                  </div>
                  <div className="request-mobile-item">
                    <span className="label">Requested Room</span>
                    <span className="value">{request.requested_room_number || 'N/A'} ({request.requested_block_name || 'N/A'})</span>
                  </div>
                  <div className="request-mobile-item full-width">
                    <span className="label">Reason</span>
                    <span className="value">{request.preference_reason || 'N/A'}</span>
                  </div>
                </div>

                <div className="request-mobile-actions">
                  <button
                    className="btn-details"
                    onClick={() => setSelectedRequest(request)}
                  >
                    View
                  </button>
                  {request.status === 'pending' && (
                    <>
                      <button
                        className="btn-approve"
                        onClick={() => handleApprove(request.id)}
                        disabled={actionLoading[request.id]}
                      >
                        {actionLoading[request.id] && <span className="btn-spinner" />}
                        {actionLoading[request.id] ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        className="btn-reject"
                        onClick={() => handleReject(request.id, 'Room not available')}
                        disabled={actionLoading[request.id]}
                      >
                        {actionLoading[request.id] && <span className="btn-spinner" />}
                        {actionLoading[request.id] ? 'Processing...' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No room change requests found</h3>
          <p>All room change requests have been processed or there are no pending requests.</p>
        </div>
      )}

      {/* Details Modal */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Room Change Request Details</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>×</button>
            </div>

            <div className="modal-body">
              {/* Request Status */}
              <div className="detail-section">
                <h3>Request Status</h3>
                <div className="status-info">
                  <div className="status-item">
                    <span className="label">Request Date</span>
                    <span className="value">{formatDate(selectedRequest.created_at)}</span>
                  </div>
                  <div className="status-item">
                    <span className="label">Current Status</span>
                    <span className={`status-badge ${getStatusClass(selectedRequest.status)}`}>
                      {(selectedRequest.status || 'pending').charAt(0).toUpperCase() + (selectedRequest.status || 'pending').slice(1)}
                    </span>
                  </div>
                  {selectedRequest.rejection_reason && (
                    <div className="status-item">
                      <span className="label">Rejection Reason</span>
                      <span className="value">{selectedRequest.rejection_reason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Information */}
              <div className="detail-section">
                <h3>Student Information</h3>
                <div className="student-grid">
                  <div className="grid-item">
                    <span className="label">Name</span>
                    <span className="value">{selectedRequest.student_name || 'N/A'}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Roll Number</span>
                    <span className="value">{selectedRequest.roll_number || 'N/A'}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Branch</span>
                    <span className="value">{selectedRequest.branch || 'N/A'}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Email</span>
                    <span className="value">{selectedRequest.student_email || 'N/A'}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Phone</span>
                    <span className="value">{selectedRequest.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Current Room Details */}
              <div className="detail-section">
                <h3>Current Room Details</h3>
                <div className="room-grid">
                  <div className="grid-item">
                    <span className="label">Room Number</span>
                    <span className="value">{selectedRequest.current_room_number || 'N/A'}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Block</span>
                    <span className="value">{selectedRequest.current_block_name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Requested Room Preferences */}
              <div className="detail-section">
                <h3>Requested Room Preferences</h3>
                <div className="room-grid">
                  <div className="grid-item">
                    <span className="label">Preferred Room</span>
                    <span className="value">{selectedRequest.requested_room_number || 'N/A'}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Preferred Block</span>
                    <span className="value">{selectedRequest.requested_block_name || 'N/A'}</span>
                  </div>
                  {selectedRequest.requested_room_capacity && (
                    <div className="grid-item">
                      <span className="label">Available Beds</span>
                      <span className="value">
                        {getAvailableBeds(selectedRequest.requested_room_capacity, selectedRequest.requested_room_occupied)} / {selectedRequest.requested_room_capacity}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Reason */}
              <div className="detail-section">
                <h3>Detailed Reason for Request</h3>
                <div className="reason-box">
                  <p>{selectedRequest.full_reason || 'No detailed reason provided.'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedRequest.status === 'pending' && (
                <div className="modal-actions">
                  <button 
                    className="btn-modal-approve"
                    onClick={() => {
                      handleApprove(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                  >
                    ✓ Approve Request
                  </button>
                  <button 
                    className="btn-modal-reject"
                    onClick={() => {
                      handleReject(selectedRequest.id, 'Room not available');
                      setSelectedRequest(null);
                    }}
                  >
                    ✕ Reject Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="modal-overlay" onClick={() => setFeedbackModal((prev) => ({ ...prev, open: false }))}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ paddingRight: '2rem' }}>
              <h2>{feedbackModal.title}</h2>
              <button
                className="modal-close"
                onClick={() => setFeedbackModal((prev) => ({ ...prev, open: false }))}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: feedbackModal.success ? '#166534' : '#991b1b', fontWeight: 600 }}>
                {feedbackModal.message}
              </p>
            </div>
            <div className="modal-body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className={feedbackModal.success ? 'btn-modal-approve' : 'btn-modal-reject'}
                onClick={() => setFeedbackModal((prev) => ({ ...prev, open: false }))}
                style={{ minWidth: '120px' }}
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

export default RoomChangeRequests;



