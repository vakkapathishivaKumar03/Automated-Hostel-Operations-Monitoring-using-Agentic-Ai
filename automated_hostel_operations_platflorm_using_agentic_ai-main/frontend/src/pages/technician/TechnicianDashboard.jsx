import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/technician-dashboard.css';

const TechnicianDashboard = () => {
  const [viewMode, setViewMode] = useState('board');
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Get logged-in technician's user ID
  const currentUser = getCurrentUser();
  const technicianUserId = currentUser?.userId;

  useEffect(() => {
    const fetchComplaints = async () => {
      if (!technicianUserId) {
        console.error('No technician user ID found');
        setLoading(false);
        return;
      }

      try {
        // Fetch complaints assigned to this technician only
        const res = await fetch(`http://localhost:5000/api/technician/${technicianUserId}/complaints`);
        const data = await res.json();
        
        if (data.success && data.all) {
          // Use 'all' array which contains all complaints assigned to this technician
          const assignedComplaints = data.all;
          setComplaints(assignedComplaints);
          
          // Count by status (assigned and in_progress are "pending" in our dashboard)
          // Map 'assigned' status to 'pending' for the dashboard display
          const pending = assignedComplaints.filter(c => c.status === 'assigned' || c.status === 'pending' || c.status === 'delayed').length;
          const inProgress = assignedComplaints.filter(c => c.status === 'in_progress').length;
          const resolved = assignedComplaints.filter(c => c.status === 'resolved').length;
          
          // Count today's complaints
          const today = new Date().toDateString();
          const todayComplaints = assignedComplaints.filter(c => {
            const complaintDate = new Date(c.complaint_date || c.created_at);
            return complaintDate.toDateString() === today;
          }).length;
          
          setPendingCount(pending);
          setInProgressCount(inProgress);
          setResolvedCount(resolved);
          setTodayCount(todayComplaints);
        } else {
          console.error('Failed to fetch complaints:', data.message);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching complaints:', error);
        setLoading(false);
      }
    };
    
    fetchComplaints();
  }, [technicianUserId]);

  useEffect(() => {
    if (showDetailModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showDetailModal]);

  // Get priority level for complaint (based on age and type)
  const getPriority = (complaint) => {
    if (complaint.priority) return complaint.priority;
    
    // Auto-calculate priority based on age and type
    const ageInHours = complaint.complaint_date 
      ? (Date.now() - new Date(complaint.complaint_date).getTime()) / (1000 * 60 * 60)
      : 0;
    
    const criticalTypes = ['electrical', 'plumbing', 'safety'];
    const isCritical = criticalTypes.some(type => 
      complaint.issue_type?.toLowerCase().includes(type)
    );
    
    if (isCritical || ageInHours > 48) return 'high';
    if (ageInHours > 24) return 'medium';
    return 'low';
  };

  // Filter and sort complaints
  const getFilteredComplaints = () => {
    let filtered = [...complaints];
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.issue_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.room_number || c.location)?.toString().includes(searchQuery) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Status filter - treat 'assigned' and 'pending' as same
    if (filterStatus !== 'all') {
      if (filterStatus === 'pending') {
        filtered = filtered.filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'delayed');
      } else {
        filtered = filtered.filter(c => c.status === filterStatus);
      }
    }
    
    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(c => getPriority(c) === filterPriority);
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.complaint_date || b.created_at) - new Date(a.complaint_date || a.created_at);
      } else if (sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[getPriority(b)] - priorityOrder[getPriority(a)];
      }
      return 0;
    });
    
    return filtered;
  };

  // Update complaint status
  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      setUpdatingId(complaintId);
      
      // Use the update-status endpoint for status changes
      const res = await fetch(`http://localhost:5000/api/technician/${complaintId}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: newStatus,
          resolution_notes: newStatus === 'resolved' ? 'Task completed' : ''
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update local state
        setComplaints(prev => prev.map(c => 
          c.id === complaintId ? { ...c, status: newStatus } : c
        ));
        
        // Recalculate counts
        const updatedComplaints = complaints.map(c => 
          c.id === complaintId ? { ...c, status: newStatus } : c
        );
        setPendingCount(updatedComplaints.filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'delayed').length);
        setInProgressCount(updatedComplaints.filter(c => c.status === 'in_progress').length);
        setResolvedCount(updatedComplaints.filter(c => c.status === 'resolved').length);
      } else {
        console.error('Failed to update status:', data.message);
      }
    } catch (error) {
      console.error('Error updating complaint:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB');
  };

  // View complaint details
  const viewDetails = (complaint) => {
    setSelectedComplaint(complaint);
    setShowDetailModal(true);
  };

  return (
    <>
      {/* HEADER */}
      <header className="tech-header">
        <div className="tech-header-left">
          <h1 className="tech-title-main">My Tasks</h1>
          <p className="tech-subtitle">
            {pendingCount + inProgressCount} active tasks assigned to you
          </p>
        </div>

        <div className="tech-header-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              📋 Board
            </button>
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              📄 List
            </button>
          </div>
        </div>
      </header>

      {/* SUMMARY STATUS CARDS */}
      <section className="tech-summary-cards">
        <div className="tech-status-card pending">
          <div className="status-left">
            <div className="status-label">Pending</div>
            <div className="status-count">{pendingCount}</div>
          </div>
          <div className="status-icon">⏳</div>
        </div>

        <div className="tech-status-card in-progress">
          <div className="status-left">
            <div className="status-label">In Progress</div>
            <div className="status-count">{inProgressCount}</div>
          </div>
          <div className="status-icon">🔄</div>
        </div>

        <div className="tech-status-card resolved">
          <div className="status-left">
            <div className="status-label">Resolved</div>
            <div className="status-count">{resolvedCount}</div>
          </div>
          <div className="status-icon">✅</div>
        </div>

        <div className="tech-status-card today">
          <div className="status-left">
            <div className="status-label">Today's Tasks</div>
            <div className="status-count">{todayCount}</div>
          </div>
          <div className="status-icon">📅</div>
        </div>
      </section>

      {/* SEARCH AND FILTERS */}
      <section className="tech-filters">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by issue, student, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending (Assigned to me)</option>
          <option value="delayed">Delayed</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>

        <select 
          value={filterPriority} 
          onChange={(e) => setFilterPriority(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Priority</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
        >
          <option value="date">Sort by Date</option>
          <option value="priority">Sort by Priority</option>
        </select>
      </section>

      {/* KANBAN BOARD */}
      {viewMode === 'board' && (
        <section className="task-board">
          {/* PENDING COLUMN */}
          <div className="board-column pending-col">
            <div className="column-header">
              <h2 className="column-title">Pending</h2>
              <span className="column-badge">{getFilteredComplaints().filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'delayed').length}</span>
            </div>
            <div className="column-content">
              {loading ? (
                <div className="empty-state">
                  <span className="empty-icon">⏳</span>
                  <p>Loading tasks...</p>
                </div>
              ) : getFilteredComplaints().filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'delayed').length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">⏳</span>
                  <p>No pending tasks assigned to you</p>
                </div>
              ) : (
                getFilteredComplaints().filter(c => c.status === 'pending' || c.status === 'assigned' || c.status === 'delayed').map(complaint => (
                  <div key={complaint.id} className="task-card pending-task">
                    <div className="task-header">
                      <h4 className="task-title">{complaint.issue_type}</h4>
                      <span className={`priority-badge priority-${getPriority(complaint)}`}>
                        {getPriority(complaint)}
                      </span>
                    </div>
                    <p className="task-meta">
                      <span className="task-student">👤 {complaint.student_name || 'Student'}</span>
                      <span className="task-location">📍 Room {complaint.room_number || complaint.location || 'N/A'}</span>
                    </p>
                    <p className="task-time">⏰ {formatDate(complaint.complaint_date || complaint.created_at)}</p>
                    {complaint.description && (
                      <p className="task-description">{complaint.description.substring(0, 80)}...</p>
                    )}
                    <div className="task-actions">
                      <button 
                        onClick={() => viewDetails(complaint)}
                        className="task-btn task-btn-secondary"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => updateComplaintStatus(complaint.id, 'in_progress')}
                        disabled={updatingId === complaint.id}
                        className="task-btn task-btn-primary"
                      >
                        {updatingId === complaint.id ? 'Starting...' : 'Start Work'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="board-column in-progress-col">
            <div className="column-header">
              <h2 className="column-title">In Progress</h2>
              <span className="column-badge">{getFilteredComplaints().filter(c => c.status === 'in_progress').length}</span>
            </div>
            <div className="column-content">
              {getFilteredComplaints().filter(c => c.status === 'in_progress').length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🔄</span>
                  <p>No tasks in progress</p>
                </div>
              ) : (
                getFilteredComplaints().filter(c => c.status === 'in_progress').map(complaint => (
                  <div key={complaint.id} className="task-card inprogress-task">
                    <div className="task-header">
                      <h4 className="task-title">{complaint.issue_type}</h4>
                      <span className={`priority-badge priority-${getPriority(complaint)}`}>
                        {getPriority(complaint)}
                      </span>
                    </div>
                    <p className="task-meta">
                      <span className="task-student">👤 {complaint.student_name || 'Student'}</span>
                      <span className="task-location">📍 Room {complaint.room_number || complaint.location || 'N/A'}</span>
                    </p>
                    <p className="task-time">⏰ {formatDate(complaint.complaint_date || complaint.created_at)}</p>
                    {complaint.description && (
                      <p className="task-description">{complaint.description.substring(0, 80)}...</p>
                    )}
                    <div className="task-actions">
                      <button 
                        onClick={() => viewDetails(complaint)}
                        className="task-btn task-btn-secondary"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => updateComplaintStatus(complaint.id, 'resolved')}
                        disabled={updatingId === complaint.id}
                        className="task-btn task-btn-success"
                      >
                        {updatingId === complaint.id ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RESOLVED COLUMN */}
          <div className="board-column resolved-col">
            <div className="column-header">
              <h2 className="column-title">Resolved</h2>
              <span className="column-badge">{getFilteredComplaints().filter(c => c.status === 'resolved').length}</span>
            </div>
            <div className="column-content">
              {getFilteredComplaints().filter(c => c.status === 'resolved').length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">✅</span>
                  <p>No resolved tasks yet</p>
                </div>
              ) : (
                getFilteredComplaints().filter(c => c.status === 'resolved').map(complaint => (
                  <div key={complaint.id} className="task-card resolved-task">
                    <div className="task-header">
                      <h4 className="task-title completed">{complaint.issue_type}</h4>
                      <span className="status-badge-resolved">✓</span>
                    </div>
                    <p className="task-meta">
                      <span className="task-student">👤 {complaint.student_name || 'Student'}</span>
                      <span className="task-location">📍 Room {complaint.room_number || complaint.location || 'N/A'}</span>
                    </p>
                    <p className="task-time">⏰ {formatDate(complaint.complaint_date || complaint.created_at)}</p>
                    {complaint.description && (
                      <p className="task-description">{complaint.description.substring(0, 80)}...</p>
                    )}
                    <div className="task-actions">
                      <button 
                        onClick={() => viewDetails(complaint)}
                        className="task-btn task-btn-secondary"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <section className="task-list">
          {loading ? (
            <div className="loading-cell list-state-card">
              <div className="spinner"></div>
              <span>Loading tasks...</span>
            </div>
          ) : getFilteredComplaints().length === 0 ? (
            <div className="empty-cell list-state-card">
              <span className="empty-icon">📋</span>
              <p>No tasks assigned to you</p>
            </div>
          ) : (
            <div className="task-list-cards">
              {getFilteredComplaints().map((complaint) => (
                <article key={complaint.id} className="task-list-card">
                  <div className="task-list-card-top">
                    <h4 className="task-list-issue">{complaint.issue_type}</h4>
                    <span className={`priority-badge priority-${getPriority(complaint)}`}>
                      {getPriority(complaint)}
                    </span>
                  </div>

                  <div className="task-list-meta-grid">
                    <div className="task-meta-item">
                      <span className="meta-label">Student</span>
                      <span className="meta-value">{complaint.student_name || 'N/A'}</span>
                    </div>
                    <div className="task-meta-item">
                      <span className="meta-label">Location</span>
                      <span className="meta-value">Room {complaint.room_number || complaint.location || 'N/A'}</span>
                    </div>
                    <div className="task-meta-item">
                      <span className="meta-label">Status</span>
                      <span className={`status-badge status-${complaint.status === 'assigned' || complaint.status === 'delayed' ? 'pending' : complaint.status}`}>
                        {complaint.status === 'assigned' ? 'Pending' : complaint.status === 'delayed' ? 'Delayed' : complaint.status === 'in_progress' ? 'In Progress' : complaint.status}
                      </span>
                    </div>
                    <div className="task-meta-item">
                      <span className="meta-label">Updated</span>
                      <span className="meta-value">{formatDate(complaint.complaint_date || complaint.created_at)}</span>
                    </div>
                  </div>

                  {complaint.description && (
                    <p className="task-list-description">{complaint.description}</p>
                  )}

                  <div className="task-list-actions">
                    {(complaint.status === 'pending' || complaint.status === 'assigned' || complaint.status === 'delayed') && (
                      <button
                        onClick={() => updateComplaintStatus(complaint.id, 'in_progress')}
                        disabled={updatingId === complaint.id}
                        className="action-btn btn-start"
                      >
                        {updatingId === complaint.id ? 'Starting...' : 'Start'}
                      </button>
                    )}
                    {complaint.status === 'in_progress' && (
                      <button
                        onClick={() => updateComplaintStatus(complaint.id, 'resolved')}
                        disabled={updatingId === complaint.id}
                        className="action-btn btn-resolve"
                      >
                        {updatingId === complaint.id ? 'Resolving...' : 'Resolve'}
                      </button>
                    )}
                    <button
                      onClick={() => viewDetails(complaint)}
                      className="action-btn btn-view"
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedComplaint && (
        <div className="detail-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Complaint Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Issue Type:</span>
                <span className="detail-value">{selectedComplaint.issue_type}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Priority:</span>
                <span className={`priority-badge priority-${getPriority(selectedComplaint)}`}>
                  {getPriority(selectedComplaint).toUpperCase()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`status-badge status-${selectedComplaint.status === 'assigned' || selectedComplaint.status === 'delayed' ? 'pending' : selectedComplaint.status}`}>
                  {selectedComplaint.status === 'assigned' ? 'Pending (Assigned to me)' : selectedComplaint.status === 'delayed' ? 'Delayed' : selectedComplaint.status === 'in_progress' ? 'In Progress' : selectedComplaint.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Student:</span>
                <span className="detail-value">{selectedComplaint.student_name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Location:</span>
                <span className="detail-value">Room {selectedComplaint.room_number || selectedComplaint.location || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Submitted:</span>
                <span className="detail-value">
                  {new Date(selectedComplaint.complaint_date || selectedComplaint.created_at).toLocaleString()}
                </span>
              </div>
              {selectedComplaint.description && (
                <div className="detail-row full-width">
                  <span className="detail-label">Description:</span>
                  <p className="detail-description">{selectedComplaint.description}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {(selectedComplaint.status === 'pending' || selectedComplaint.status === 'assigned' || selectedComplaint.status === 'delayed') && (
                <button
                  onClick={() => {
                    updateComplaintStatus(selectedComplaint.id, 'in_progress');
                    setShowDetailModal(false);
                  }}
                  className="modal-btn btn-primary"
                >
                  Start Work
                </button>
              )}
              {selectedComplaint.status === 'in_progress' && (
                <button
                  onClick={() => {
                    updateComplaintStatus(selectedComplaint.id, 'resolved');
                    setShowDetailModal(false);
                  }}
                  className="modal-btn btn-success"
                >
                  Mark as Resolved
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="modal-btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TechnicianDashboard;


