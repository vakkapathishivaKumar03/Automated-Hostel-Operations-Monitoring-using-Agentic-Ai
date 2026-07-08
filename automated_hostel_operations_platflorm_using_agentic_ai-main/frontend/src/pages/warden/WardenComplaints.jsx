import React, { useEffect, useState } from 'react';
import { getAuthHeaders } from '../../utils/auth';
import '../../styles/warden-complaints.css';

const WardenComplaints = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [complaintToAssign, setComplaintToAssign] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    fetchComplaints();
    fetchTechnicians();
  }, []);

  const fetchComplaints = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/warden/complaints/all', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setComplaints(data.data);
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/warden/technicians', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setTechnicians(data.data);
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  // Get complaint counts by status
  const getStatusCounts = () => {
    return {
      all: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      assigned: complaints.filter(c => c.status === 'assigned').length,
      in_progress: complaints.filter(c => c.status === 'in_progress').length,
      resolved: complaints.filter(c => c.status === 'resolved').length
    };
  };

  const statusCounts = getStatusCounts();

  // Filter complaints based on search and status
  const filteredComplaints = complaints.filter((complaint) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (complaint.student_name || '').toLowerCase().includes(query) ||
      (complaint.roll_number || '').toLowerCase().includes(query) ||
      String(complaint.room_number || '').includes(query) ||
      (complaint.title || complaint.description || '').toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'all' || (complaint.status || '').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // View complaint details
  const handleViewDetails = (complaint) => {
    setSelectedComplaint(complaint);
    setIsDetailsModalOpen(true);
  };

  // Open assign technician modal
  const handleAssignTechnician = (complaint) => {
    setComplaintToAssign(complaint);
    setSelectedTechnician('');
    setIsAssignModalOpen(true);
  };

  // Assign technician
  const handleAssignSubmit = async () => {
    if (!selectedTechnician || !complaintToAssign) return;
    setAssigningId(complaintToAssign.id);
    try {
      const response = await fetch(`http://localhost:5000/api/technician/complaint/${complaintToAssign.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_id: Number(selectedTechnician) })
      });
      const data = await response.json();
      if (data.success) {
        await fetchComplaints();
        setIsAssignModalOpen(false);
        setSelectedTechnician('');
        setComplaintToAssign(null);
      } else {
        alert('Failed to assign technician: ' + data.message);
      }
    } catch (error) {
      console.error('Error assigning technician:', error);
      alert('Error assigning technician');
    } finally {
      setAssigningId(null);
    }
  };

  // Mark as resolved
  const handleMarkResolved = async (complaintId) => {
    setResolvingId(complaintId);
    try {
      const response = await fetch(`http://localhost:5000/api/technician/complaint/${complaintId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: 'Resolved by warden' })
      });
      const data = await response.json();
      if (data.success) {
        await fetchComplaints();
      } else {
        alert('Failed to resolve complaint: ' + data.message);
      }
    } catch (error) {
      console.error('Error resolving complaint:', error);
      alert('Error resolving complaint');
    } finally {
      setResolvingId(null);
    }
  };

  // Get status badge class
  const getStatusClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-assigned';
      case 'resolved': return 'status-resolved';
      default: return '';
    }
  };

  // Get priority badge class
  const getPriorityClass = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="complaints-main">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="complaints-main">
      {/* Page Header */}
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Student Complaints</h2>
          <p>Monitor and manage student complaints</p>
        </div>
      </div>

      {/* Filter Buttons */}
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
          className={`filter-btn ${statusFilter === 'assigned' ? 'active' : ''}`}
          onClick={() => setStatusFilter('assigned')}
        >
          Assigned ({statusCounts.assigned})
        </button>
        <button
          className={`filter-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setStatusFilter('in_progress')}
        >
          In Progress ({statusCounts.in_progress})
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
          className="search-input"
          placeholder="Search by student name, roll number, or room..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Complaints List */}
      {filteredComplaints.length > 0 ? (
        <div className="complaints-grid">
          {filteredComplaints.map((complaint) => (
            <div key={complaint.id} className="complaint-card">
              {/* Card Header */}
              <div className="card-header">
                <div className="header-left">
                  <h3>{complaint.title || complaint.description?.substring(0, 50) || 'Complaint'}</h3>
                  <p className="complaint-id">ID #{complaint.id}</p>
                </div>
                <span className={`status-badge ${getStatusClass(complaint.status)}`}>
                  {(complaint.status || 'pending').replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </span>
              </div>

              {/* Card Body */}
              <div className="card-body">
                {/* Student Info */}
                <div className="student-info">
                  <div className="student-avatar">
                    {(complaint.student_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="student-name">{complaint.student_name || 'N/A'}</div>
                    <div className="student-details">
                      Room {complaint.room_number || 'N/A'}{complaint.block_name ? ` (${complaint.block_name})` : ''} - {complaint.roll_number || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Meta Information */}
                <div className="complaint-meta">
                  <span className="meta-badge category-badge">
                    {getCategoryIcon(complaint.category)} {(complaint.category || 'other').charAt(0).toUpperCase() + (complaint.category || 'other').slice(1)}
                  </span>
                  {complaint.priority && (
                    <span className={`meta-badge priority-badge ${getPriorityClass(complaint.priority)}`} style={getPriorityStyle(complaint.priority)}>
                      {(complaint.priority || '').charAt(0).toUpperCase() + (complaint.priority || '').slice(1)}
                    </span>
                  )}
                </div>

                {/* Description */}
                <div className="complaint-description">
                  {complaint.description}
                </div>

                {/* Assigned Technician Info */}
                {complaint.technician_name && (
                  <div className="assigned-info">
                    <strong>Assigned to:</strong> {complaint.technician_name}
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="card-actions">
                <button 
                  className="btn-view"
                  onClick={() => handleViewDetails(complaint)}
                >
                  View Details
                </button>
                {complaint.status !== 'resolved' && (
                  <button 
                    className="btn-assign"
                    onClick={() => handleAssignTechnician(complaint)}
                    disabled={assigningId === complaint.id}
                  >
                    {assigningId === complaint.id && <span className="btn-spinner" />}
                    {assigningId === complaint.id ? 'Processing...' : (complaint.status === 'assigned' || complaint.status === 'in_progress' ? 'Reassign' : 'Assign')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No complaints found</h3>
          <p>
            {searchTerm 
              ? 'No complaints match your search criteria.'
              : `No ${statusFilter === 'all' ? '' : statusFilter} complaints at this time.`
            }
          </p>
        </div>
      )}

      {/* View Details Modal */}
      {isDetailsModalOpen && selectedComplaint && (
        <div className="modal-overlay" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complaint Details</h2>
              <button className="modal-close" onClick={() => setIsDetailsModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Overview</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Complaint ID</span>
                    <span className="value">#{selectedComplaint.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Status</span>
                    <span className={`status-badge ${getStatusClass(selectedComplaint.status)}`}>
                      {(selectedComplaint.status || 'pending').replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Priority</span>
                    <span className="value">{(selectedComplaint.priority || '').charAt(0).toUpperCase() + (selectedComplaint.priority || '').slice(1)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Category</span>
                    <span className="value">
                      {getCategoryIcon(selectedComplaint.category)} {(selectedComplaint.category || 'other').charAt(0).toUpperCase() + (selectedComplaint.category || 'other').slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Student Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Name</span>
                    <span className="value">{selectedComplaint.student_name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Roll Number</span>
                    <span className="value">{selectedComplaint.roll_number || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Room Number</span>
                    <span className="value">{selectedComplaint.room_number || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Block</span>
                    <span className="value">{selectedComplaint.block_name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Timeline</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Submitted</span>
                    <span className="value">{formatDate(selectedComplaint.created_at)}</span>
                  </div>
                  {selectedComplaint.assigned_at && (
                    <div className="detail-item">
                      <span className="label">Assigned</span>
                      <span className="value">{formatDate(selectedComplaint.assigned_at)}</span>
                    </div>
                  )}
                  {selectedComplaint.resolved_at && (
                    <div className="detail-item">
                      <span className="label">Resolved</span>
                      <span className="value">{formatDate(selectedComplaint.resolved_at)}</span>
                    </div>
                  )}
                  {selectedComplaint.technician_name && (
                    <div className="detail-item">
                      <span className="label">Technician</span>
                      <span className="value">{selectedComplaint.technician_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Description</h3>
                <p>{selectedComplaint.description}</p>
              </div>

              {selectedComplaint.resolution_notes && (
                <div className="detail-section">
                  <h3>Resolution Notes</h3>
                  <p>{selectedComplaint.resolution_notes}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Technician Modal */}
      {isAssignModalOpen && complaintToAssign && (
        <div className="modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Technician</h2>
              <button className="modal-close" onClick={() => setIsAssignModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="complaint-summary">
                <h4>Complaint Details</h4>
                <p><strong>ID:</strong> #{complaintToAssign.id}</p>
                <p><strong>Category:</strong> {getCategoryIcon(complaintToAssign.category)} {(complaintToAssign.category || 'other').charAt(0).toUpperCase() + (complaintToAssign.category || 'other').slice(1)}</p>
                <p><strong>Student:</strong> {complaintToAssign.student_name || 'N/A'}</p>
                <p><strong>Room:</strong> {complaintToAssign.room_number || 'N/A'}</p>
              </div>

              <div className="form-group">
                <label htmlFor="technician-select">Select Technician</label>
                <select 
                  id="technician-select"
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="form-input"
                >
                  <option value="">-- Choose a technician --</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.user_id}>
                      {tech.name} ({tech.specialization || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleAssignSubmit}
                disabled={!selectedTechnician || assigningId}
              >
                {assigningId && <span className="btn-spinner" />}
                {assigningId ? 'Assigning...' : 'Assign Technician'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get category icon
const getCategoryIcon = (category) => {
  const icons = {
    electrical: '⚡',
    plumbing: '🚰',
    internet: '📡',
    furniture: '🪑',
    cleaning: '🧹',
    security: '🔒',
    other: '🔧'
  };
  return icons[(category || '').toLowerCase()] || '🔧';
};

// Helper function to get priority style
const getPriorityStyle = (priority) => {
  const styles = {
    urgent: { background: '#fee2e2', color: '#991b1b' },
    high: { background: '#fed7aa', color: '#9a3412' },
    medium: { background: '#fef3c7', color: '#b45309' },
    low: { background: '#dbeafe', color: '#1e40af' }
  };
  return styles[(priority || 'medium').toLowerCase()] || styles.medium;
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
};

export default WardenComplaints;



