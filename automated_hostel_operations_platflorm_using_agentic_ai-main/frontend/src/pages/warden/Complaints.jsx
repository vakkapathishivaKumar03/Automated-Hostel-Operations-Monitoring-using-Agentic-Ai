import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAuthHeaders } from '../../utils/auth';
import '../../styles/warden-complaints.css';

const WardenComplaints = () => {
  // State Management
  const [complaints, setComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTechId, setAssigningTechId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignMessage, setAssignMessage] = useState({ type: '', text: '' });
  const assignCloseTimerRef = useRef(null);

  // Fetch Data on Mount
  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    return () => {
      if (assignCloseTimerRef.current) {
        clearTimeout(assignCloseTimerRef.current);
      }
    };
  }, []);

  // Fetch Complaints and Technicians
  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [complaintsRes, techniciansRes] = await Promise.all([
        fetch('http://localhost:5000/api/warden/complaints/all', { headers: getAuthHeaders() }),
        fetch('http://localhost:5000/api/warden/technicians', { headers: getAuthHeaders() })
      ]);

      if (!complaintsRes.ok || !techniciansRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const complaintsData = await complaintsRes.json();
      const techniciansData = await techniciansRes.json();

      if (complaintsData.success && Array.isArray(complaintsData.data)) {
        setComplaints(complaintsData.data);
      }

      if (techniciansData.success && Array.isArray(techniciansData.data)) {
        setTechnicians(techniciansData.data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Count complaints by status
  const statusCounts = useMemo(() => {
    const hasTechnicianStarted = (complaint) => Boolean(complaint?.last_technician_update_at);

    return {
      all: complaints.length,
      pending: complaints.filter(c =>
        c.status === 'pending' ||
        c.status === 'assigned' ||
        (c.status === 'delayed' && !hasTechnicianStarted(c))
      ).length,
      in_progress: complaints.filter(c =>
        c.status === 'in_progress' ||
        (c.status === 'delayed' && hasTechnicianStarted(c))
      ).length,
      delayed: complaints.filter(c => c.status === 'delayed').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
    };
  }, [complaints]);

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    let filtered = complaints;
    const hasTechnicianStarted = (complaint) => Boolean(complaint?.last_technician_update_at);

    // Filter by status
    if (statusFilter === 'pending') {
      filtered = filtered.filter(c =>
        c.status === 'pending' ||
        c.status === 'assigned' ||
        (c.status === 'delayed' && !hasTechnicianStarted(c))
      );
    } else if (statusFilter === 'in_progress') {
      filtered = filtered.filter(c =>
        c.status === 'in_progress' ||
        (c.status === 'delayed' && hasTechnicianStarted(c))
      );
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.title?.toLowerCase().includes(query)) ||
        (c.description?.toLowerCase().includes(query)) ||
        (c.student_name?.toLowerCase().includes(query)) ||
        (c.roll_number?.toLowerCase().includes(query)) ||
        (c.room_number?.toString().includes(query))
      );
    }

    return filtered;
  }, [complaints, statusFilter, searchQuery]);

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#fbbf24',
      'assigned': '#3b82f6',
      'in_progress': '#8b5cf6',
      'delayed': '#dc2626',
      'resolved': '#34d399',
      'closed': '#6b7280',
    };
    return colors[status] || '#9ca3af';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'urgent': '#dc2626',
    };
    return colors[priority] || '#9ca3af';
  };

  // View complaint details
  const handleViewDetails = (complaint) => {
    setSelectedComplaint(complaint);
    setShowDetailsModal(true);
  };

  // Open assign modal
  const handleAssignClick = (complaint) => {
    setSelectedComplaint(complaint);
    setAssigningTechId('');
    setAssignMessage({ type: '', text: '' });
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    if (assignCloseTimerRef.current) {
      clearTimeout(assignCloseTimerRef.current);
      assignCloseTimerRef.current = null;
    }
    setShowAssignModal(false);
    setSelectedComplaint(null);
    setAssigningTechId('');
    setAssignMessage({ type: '', text: '' });
  };

  // Assign technician
  const handleAssignTechnician = async () => {
    if (!selectedComplaint || !assigningTechId) {
      setAssignMessage({ type: 'error', text: 'Please select a technician' });
      return;
    }

    setAssignSubmitting(true);
    setAssignMessage({ type: '', text: '' });
    try {
      const response = await fetch(
        `http://localhost:5000/api/warden/complaint/${selectedComplaint.id}/assign`,
        {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({ technician_id: parseInt(assigningTechId) })
        }
      );

      const responseText = await response.text();
      let data = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Unexpected server response (status ${response.status})`);
        }
      }

      if (!data) {
        throw new Error(`Empty server response (status ${response.status})`);
      }

      if (data.success) {
        await loadAllData();
        setAssignMessage({ type: 'success', text: 'Complaint assigned successfully!' });
        if (assignCloseTimerRef.current) {
          clearTimeout(assignCloseTimerRef.current);
        }
        assignCloseTimerRef.current = setTimeout(() => {
          closeAssignModal();
        }, 1500);
      } else {
        setAssignMessage({ type: 'error', text: data.message || 'Failed to assign complaint' });
      }
    } catch (err) {
      console.error('Error:', err);
      setAssignMessage({ type: 'error', text: err.message || 'Failed to assign complaint' });
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Render
  return (
    <main className="complaints-main">
        {/* Header */}
        <div className="page-header-card">
          <div className="page-header-text">
            <h2>Complaint Management</h2>
            <p>View, manage, and assign maintenance complaints</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="error-alert">
            <p>{error}</p>
            <button onClick={loadAllData} className="retry-btn">Retry</button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading complaints...</p>
          </div>
        ) : (
          <>
            {/* Status Filter Buttons */}
            <div className="filter-buttons">
              <button
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({statusCounts.all})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                Pending ({statusCounts.pending})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
                onClick={() => setStatusFilter('in_progress')}
              >
                In Progress ({statusCounts.in_progress})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'delayed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('delayed')}
              >
                Delayed ({statusCounts.delayed})
              </button>
              <button
                className={`filter-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('resolved')}
              >
                Resolved ({statusCounts.resolved})
              </button>
            </div>

            {/* Search Section */}
            <div className="search-section">
              <input
                type="text"
                placeholder="Search by student name, roll number, room, or issue title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Complaints List */}
            {filteredComplaints.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No complaints found</h3>
                <p>
                  {searchQuery || statusFilter !== 'all'
                    ? 'No complaints match your search or filter.'
                    : 'No complaints available.'}
                </p>
              </div>
            ) : (
              <div className="complaints-grid">
                {filteredComplaints.map((complaint) => (
                  <div key={complaint.id} className="complaint-card">
                    <div className="card-header">
                      <div className="header-left">
                        <h3>{complaint.title}</h3>
                        <p className="complaint-id">#{complaint.id}</p>
                      </div>
                      <div className="header-badges">
                        <span
                          className={`status-badge status-${complaint.status}`}
                          style={{ backgroundColor: getStatusColor(complaint.status) }}
                        >
                          {complaint.status?.replace('_', ' ').toUpperCase()}
                        </span>
                        <span
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(complaint.priority) }}
                        >
                          {complaint.priority?.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="card-body">
                      <div className="student-info">
                        <div className="student-avatar">
                          {complaint.student_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="student-name">{complaint.student_name}</div>
                          <div className="student-details">
                            {complaint.roll_number} - Room {complaint.room_number} - {complaint.block_name}
                          </div>
                        </div>
                      </div>

                      <div className="complaint-meta">
                        <span className="category-badge">{complaint.category}</span>
                      </div>

                      {complaint.description && (
                        <div className="complaint-description">
                          {complaint.description}
                        </div>
                      )}

                      {complaint.technician_name && (
                        <div className="assigned-info">
                          👤 Assigned to: <strong>{complaint.technician_name}</strong>
                        </div>
                      )}
                    </div>

                    <div className="card-actions">
                      <button
                        className="btn-view"
                        onClick={() => handleViewDetails(complaint)}
                      >
                        View Details
                      </button>
                      {complaint.status === 'pending' && (
                        <button
                          className="btn-assign"
                          onClick={() => handleAssignClick(complaint)}
                        >
                          ✓ Assign
                        </button>
                      )}
                      {(complaint.status === 'delayed' && !complaint.technician_name) && (
                        <button
                          className="btn-assign"
                          onClick={() => handleAssignClick(complaint)}
                        >
                          ! Urgent Assign
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedComplaint && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Complaint Details</h2>
                <button className="modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
              </div>

              <div className="modal-body">
                <div className="detail-section">
                  <h3>Complaint Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">ID:</span>
                      <span className="value">#{selectedComplaint.id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Category:</span>
                      <span className="value">{selectedComplaint.category?.toUpperCase()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Priority:</span>
                      <span className="value" style={{ color: getPriorityColor(selectedComplaint.priority) }}>
                        {selectedComplaint.priority?.toUpperCase()}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Status:</span>
                      <span className="value" style={{ color: getStatusColor(selectedComplaint.status) }}>
                        {selectedComplaint.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Student Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Name:</span>
                      <span className="value">{selectedComplaint.student_name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Roll Number:</span>
                      <span className="value">{selectedComplaint.roll_number}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Room:</span>
                      <span className="value">{selectedComplaint.room_number || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Block:</span>
                      <span className="value">{selectedComplaint.block_name || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Issue Description</h3>
                  <p>{selectedComplaint.description}</p>
                </div>

                {selectedComplaint.technician_name && (
                  <div className="detail-section">
                    <h3>Assignment</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="label">Assigned to:</span>
                        <span className="value">{selectedComplaint.technician_name}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Assigned Date:</span>
                        <span className="value">
                          {selectedComplaint.assigned_at && new Date(selectedComplaint.assigned_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedComplaint.resolution_notes && (
                  <div className="detail-section">
                    <h3>Resolution Notes</h3>
                    <p>{selectedComplaint.resolution_notes}</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && selectedComplaint && (
          <div className="modal-overlay" onClick={closeAssignModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Assign Complaint to Technician</h2>
                <button className="modal-close" onClick={closeAssignModal}>×</button>
              </div>

              <div className="modal-body">
                <div className="complaint-summary">
                  <h4>{selectedComplaint.title}</h4>
                  <p>Category: {selectedComplaint.category?.toUpperCase()}</p>
                  <p>Room: {selectedComplaint.room_number || 'N/A'}</p>
                  <p>Student: {selectedComplaint.student_name}</p>
                </div>

                <div className="form-group">
                  <label htmlFor="technician">Select Technician *</label>
                  <select
                    id="technician-select"
                    value={assigningTechId}
                    onChange={(e) => setAssigningTechId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Choose a technician --</option>
                    {technicians.map((tech) => (
                      <option key={tech.user_id || tech.id} value={tech.user_id || tech.id}>
                        {tech.name} ({tech.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                {assignMessage.text && (
                  <div
                    role="alert"
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${assignMessage.type === 'success' ? '#16a34a' : '#dc2626'}`,
                      background: assignMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                      color: assignMessage.type === 'success' ? '#166534' : '#991b1b',
                      fontWeight: 600,
                    }}
                  >
                    {assignMessage.text}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={closeAssignModal}
                  disabled={assignSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAssignTechnician}
                  disabled={assignSubmitting || !assigningTechId}
                >
                  {assignSubmitting ? 'Assigning...' : 'Assign Complaint'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
};

export default WardenComplaints;



