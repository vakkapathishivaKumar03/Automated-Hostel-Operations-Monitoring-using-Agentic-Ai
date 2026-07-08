import React, { useState, useMemo, useEffect } from 'react';
import ContextActionModal from '../../components/ContextActionModal';
import '../../styles/admin-registrations.css';

const AdminRegistrations = () => {
  // State for students/registrations data from database
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch registrations from database
  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/registrations/pending'),
        fetch('http://localhost:5000/api/admin/registrations/approved'),
        fetch('http://localhost:5000/api/admin/registrations/rejected')
      ]);

      const [pendingData, approvedData, rejectedData] = await Promise.all([
        pendingRes.json(),
        approvedRes.json(),
        rejectedRes.json()
      ]);

      const combinedRegistrations = [
        ...(pendingData.success && Array.isArray(pendingData.data) ? pendingData.data : []),
        ...(approvedData.success && Array.isArray(approvedData.data) ? approvedData.data : []),
        ...(rejectedData.success && Array.isArray(rejectedData.data) ? rejectedData.data : [])
      ];

      if (combinedRegistrations.length > 0) {
        setRegistrations(combinedRegistrations);
      } else {
        setRegistrations([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      openFeedbackModal('Load Failed', 'Failed to fetch registrations from database', 'danger');
      setLoading(false);
    }
  };

  // Old dummy data replaced with database - State management

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState({ open: false, title: '', message: '', tone: 'primary' });

  const openFeedbackModal = (title, message, tone = 'primary') => {
    setFeedbackModal({ open: true, title, message, tone });
  };

  // Filter registrations
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(reg => {
      const matchesSearch = 
        reg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.roll_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBranch = branchFilter === 'All' || reg.branch === branchFilter;
      const matchesStatus = statusFilter === 'All' || reg.registration_status === statusFilter.toLowerCase();

      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [registrations, searchTerm, branchFilter, statusFilter]);

  // Handlers
  const handleViewDetails = (registration) => {
    setSelectedRegistration(registration);
    setShowDetailsModal(true);
  };

  const handleApproveClick = (registration) => {
    setSelectedRegistration(registration);
    setShowApproveConfirm(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedRegistration) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/registrations/${selectedRegistration.student_id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee_status: selectedRegistration.fee_status || 'pending' })
      });
      
      const data = await res.json();
      
      if (data.success) {
        openFeedbackModal('Registration Approved', 'Registration approved successfully!', 'success');
        fetchRegistrations();
        setShowDetailsModal(false);
      } else {
        openFeedbackModal('Approval Failed', `Failed to approve: ${data.message}`, 'danger');
      }
    } catch (error) {
      console.error('Error approving registration:', error);
      openFeedbackModal('Approval Failed', 'Failed to approve registration', 'danger');
    }

    setShowApproveConfirm(false);
    setSelectedRegistration(null);
  };

  const handleRejectClick = (registration) => {
    setSelectedRegistration(registration);
    setShowRejectConfirm(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRegistration) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/registrations/${selectedRegistration.student_id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: 'Rejected by admin' })
      });
      
      const data = await res.json();
      
      if (data.success) {
        openFeedbackModal('Registration Rejected', 'Registration rejected successfully', 'danger');
        fetchRegistrations();
      } else {
        openFeedbackModal('Rejection Failed', `Failed to reject: ${data.message}`, 'danger');
      }
    } catch (error) {
      console.error('Error rejecting registration:', error);
      openFeedbackModal('Rejection Failed', 'Failed to reject registration', 'danger');
    }
    
    setShowRejectConfirm(false);
    setShowDetailsModal(false);
    setSelectedRegistration(null);
  };

  const handleCloseModals = () => {
    setShowDetailsModal(false);
    setShowRejectConfirm(false);
    setShowApproveConfirm(false);
    setSelectedRegistration(null);
  };

  const formatSubmittedDate = (submittedDate) => {
    if (!submittedDate) return 'N/A';
    return new Date(submittedDate).toLocaleDateString('en-GB');
  };

  const getPaymentProofUrl = (paymentProofUrl) => {
    if (!paymentProofUrl) return null;
    if (paymentProofUrl.startsWith('http://') || paymentProofUrl.startsWith('https://')) {
      return paymentProofUrl;
    }
    return `http://localhost:5000${paymentProofUrl}`;
  };

  return (
    <div className="admin-registrations-page">
      {/* Page Header */}
      <div className="page-header page-header-card">
        <div className="header-content page-header-text">
          <h1 className="page-title">Student Registration Review</h1>
          <p className="page-subtitle">Verify and approve new student registrations</p>
        </div>
      </div>

      {/* Search & Filter Section */}
      <div className="search-filter-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select
          className="filter-select"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="All">All Branches</option>
          <option value="CSE">CSE</option>
          <option value="ECE">ECE</option>
          <option value="ME">Mechanical</option>
          <option value="EE">Electrical</option>
          <option value="Civil">Civil</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Results Info */}
      <div className="results-info">
        Showing {filteredRegistrations.length} of {registrations.length} registrations
      </div>

      {/* Registrations Table or Empty State */}
      {loading ? (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading registrations...</h3>
            <p>Fetching data from database</p>
          </div>
        </div>
      ) : filteredRegistrations.length > 0 ? (
        <>
          <div className="table-container registrations-desktop-table">
            <table className="registrations-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Branch</th>
                  <th>Year</th>
                  <th>Phone</th>
                  <th>Submitted Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.map((reg) => (
                  <tr key={reg.student_id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar">
                          {reg.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="student-info">
                          <span className="student-name">{reg.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="roll-number">{reg.roll_number}</span>
                    </td>
                    <td>
                      <span className="branch-badge">{reg.branch || 'N/A'}</span>
                    </td>
                    <td>{reg.year || 'N/A'}</td>
                    <td>{reg.phone || 'N/A'}</td>
                    <td>{formatSubmittedDate(reg.submitted_date)}</td>
                    <td>
                      <span className={`status-badge status-${reg.registration_status.toLowerCase()}`}>
                        {reg.registration_status.charAt(0).toUpperCase() + reg.registration_status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn-action btn-view"
                          onClick={() => handleViewDetails(reg)}
                          title="View Details"
                        >
                          👁
                        </button>
                        {reg.registration_status === 'pending' && (
                          <>
                            <button
                              className="btn-action btn-approve"
                              onClick={() => handleApproveClick(reg)}
                              title="Approve"
                            >
                              ✓
                            </button>
                            <button
                              className="btn-action btn-reject"
                              onClick={() => handleRejectClick(reg)}
                              title="Reject"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="registrations-mobile-cards">
            {filteredRegistrations.map((reg) => (
              <article key={reg.student_id} className="registration-mobile-card">
                <div className="registration-mobile-header">
                  <div className="student-cell">
                    <div className="student-avatar">
                      {reg.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="student-info">
                      <span className="student-name">{reg.name}</span>
                      <div className="registration-mobile-meta">
                        <span className="roll-number mobile-roll-pill">{reg.roll_number}</span>
                        <span className={`status-badge status-${reg.registration_status.toLowerCase()}`}>
                          {reg.registration_status.charAt(0).toUpperCase() + reg.registration_status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="registration-mobile-grid">
                  <div>
                    <span className="registration-mobile-label">Branch</span>
                    <span className="branch-badge">{reg.branch || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="registration-mobile-label">Year</span>
                    <span className="registration-mobile-value">{reg.year || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="registration-mobile-label">Phone</span>
                    <span className="registration-mobile-value">{reg.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="registration-mobile-label">Submitted</span>
                    <span className="registration-mobile-value">{formatSubmittedDate(reg.submitted_date)}</span>
                  </div>
                </div>

                <div className="registration-mobile-actions">
                  <button
                    className="btn-action btn-view"
                    onClick={() => handleViewDetails(reg)}
                    title="View Details"
                  >
                    👁
                  </button>
                  {reg.registration_status === 'pending' && (
                    <>
                      <button
                        className="btn-action btn-approve"
                        onClick={() => handleApproveClick(reg)}
                        title="Approve"
                      >
                        ✓
                      </button>
                      <button
                        className="btn-action btn-reject"
                        onClick={() => handleRejectClick(reg)}
                        title="Reject"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Registration Requests</h3>
            <p>
              {searchTerm || branchFilter !== 'All' || statusFilter !== 'All'
                ? 'Try adjusting your filters to see more results'
                : 'No pending registration requests at the moment'}
            </p>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailsModal && selectedRegistration && (
        <div className="modal-overlay" onClick={handleCloseModals}>
          <div className="modal-content modal-details" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registration Details</h2>
              <button className="btn-close" onClick={handleCloseModals}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="view-grid">
                <div className="view-item">
                  <div className="view-label">Full Name</div>
                  <div className="view-value">{selectedRegistration.name}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Roll Number</div>
                  <div className="view-value">{selectedRegistration.roll_number}</div>
                </div>
                <div className="view-item view-item-full">
                  <div className="view-label">Email</div>
                  <div className="view-value">{selectedRegistration.email}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Phone</div>
                  <div className="view-value">{selectedRegistration.phone || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Branch</div>
                  <div className="view-value">{selectedRegistration.branch || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Year</div>
                  <div className="view-value">{selectedRegistration.year || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Blood Group</div>
                  <div className="view-value">{selectedRegistration.blood_group || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Emergency Contact</div>
                  <div className="view-value">{selectedRegistration.emergency_contact || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Parent Name</div>
                  <div className="view-value">{selectedRegistration.parent_name || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Parent Phone</div>
                  <div className="view-value">{selectedRegistration.parent_phone || 'N/A'}</div>
                </div>
                <div className="view-item view-item-full">
                  <div className="view-label">Address</div>
                  <div className="view-value">{selectedRegistration.address || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Fee Status</div>
                  <div className="view-value">
                    <span className={`status-badge status-${selectedRegistration.fee_status}`}>
                      {selectedRegistration.fee_status?.charAt(0).toUpperCase() + selectedRegistration.fee_status?.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="view-item">
                  <div className="view-label">Fee Receipt</div>
                  <div className="view-value">
                    {selectedRegistration.payment_proof_url ? (
                      <a
                        className="receipt-download-link"
                        href={getPaymentProofUrl(selectedRegistration.payment_proof_url)}
                        target="_blank"
                        rel="noreferrer"
                        download
                      >
                        Download Receipt
                      </a>
                    ) : (
                      'Not uploaded'
                    )}
                  </div>
                </div>
                <div className="view-item">
                  <div className="view-label">Registration Status</div>
                  <div className="view-value">
                    <span className={`status-badge status-${selectedRegistration.registration_status.toLowerCase()}`}>
                      {selectedRegistration.registration_status.charAt(0).toUpperCase() + selectedRegistration.registration_status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="view-item view-item-full">
                  <div className="view-label">Submitted On</div>
                  <div className="view-value">{new Date(selectedRegistration.submitted_date).toLocaleString()}</div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModals}>
                Close
              </button>
              {selectedRegistration.registration_status === 'pending' && (
                <>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleRejectClick(selectedRegistration);
                    }}
                  >
                    Reject
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleApproveClick(selectedRegistration)}
                  >
                    Approve Registration
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ContextActionModal
        open={showApproveConfirm && !!selectedRegistration}
        title="Approve Registration"
        message={selectedRegistration ? `Approve registration for ${selectedRegistration.name}?` : ''}
        confirmText="Approve"
        cancelText="Cancel"
        tone="success"
        onConfirm={handleApproveConfirm}
        onClose={handleCloseModals}
      />

      <ContextActionModal
        open={showRejectConfirm && !!selectedRegistration}
        title="Reject Registration"
        message={selectedRegistration ? `Reject registration for ${selectedRegistration.name} (${selectedRegistration.roll_number})? This action cannot be undone.` : ''}
        confirmText="Reject"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleConfirmReject}
        onClose={handleCloseModals}
      />

      <ContextActionModal
        open={feedbackModal.open}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmText="OK"
        tone={feedbackModal.tone}
        hideCancel
        onConfirm={() => setFeedbackModal({ open: false, title: '', message: '', tone: 'primary' })}
        onClose={() => setFeedbackModal({ open: false, title: '', message: '', tone: 'primary' })}
      />
    </div>
  );
};

export default AdminRegistrations;


