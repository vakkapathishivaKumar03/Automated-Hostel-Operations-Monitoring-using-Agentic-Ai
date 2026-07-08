import React, { useState, useEffect } from 'react';
import StudentLayout from '../../components/StudentLayout';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/student-complaints.css';

const StudentComplaints = () => {
  const currentUser = getCurrentUser();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    category: 'electrical',
    title: '',
    description: '',
    location: '',
    priority: 'medium',
  });

  const categories = [
    { value: 'electrical', label: '⚡ Electrical' },
    { value: 'plumbing', label: '🚰 Plumbing' },
    { value: 'carpentry', label: '🪚 Carpentry' },
    { value: 'hvac', label: '🌡️ HVAC' },
    { value: 'wifi', label: '📡 WiFi' },
    { value: 'other', label: '📋 Other' },
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: '#10b981' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'high', label: 'High', color: '#ef4444' },
    { value: 'urgent', label: 'Urgent', color: '#dc2626' },
  ];

  const statuses = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  // Fetch complaints
  useEffect(() => {
    fetchComplaints();
  }, [currentUser?.userId]);

  const fetchComplaints = async () => {
    try {
      if (!currentUser?.userId) return;
      
      const res = await fetch(`http://localhost:5000/api/student/complaints/${currentUser.userId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setComplaints(data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/student/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: currentUser.userId,
          issue_type: formData.category,
          category: formData.category,
          title: formData.title,
          description: formData.description,
          location: formData.location,
          priority: formData.priority,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        alert('Complaint submitted successfully' + (data.assigned ? ' and assigned to technician!' : ''));
        setFormData({
          category: 'electrical',
          title: '',
          description: '',
          location: '',
          priority: 'medium',
        });
        setShowForm(false);
        await fetchComplaints();
      } else {
        alert(data.message || 'Error submitting complaint');
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      alert('Error submitting complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#fbbf24',
      'assigned': '#3b82f6',
      'in_progress': '#8b5cf6',
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

  // Filter complaints
  const filteredComplaints = complaints.filter(complaint => {
    if (selectedStatus === 'all') return true;
    return complaint.status === selectedStatus;
  });

  // Count by status
  const countByStatus = (status) => {
    if (status === 'all') return complaints.length;
    return complaints.filter(c => c.status === status).length;
  };

  return (
    <StudentLayout>
      <main className="student-main">
        {/* Header */}
        <div className="complaints-header">
          <div>
            <h1>My Complaints</h1>
            <p className="complaints-subtitle">Report and track hostel maintenance issues</p>
          </div>
          <button
            className="new-complaint-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ Cancel' : '+ New Complaint'}
          </button>
        </div>

        {/* Form Section */}
        {showForm && (
          <section className="complaint-form-section">
            <h2>Raise a Complaint</h2>
            <form className="complaint-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="form-input"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="form-input"
                  >
                    {priorities.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">Issue Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    className="form-input"
                    placeholder="e.g., Broken ceiling light"
                    value={formData.title}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location/Room *</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    className="form-input"
                    placeholder="e.g., Room 101 or Common Area"
                    value={formData.location}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  name="description"
                  className="form-textarea"
                  placeholder="Describe the issue in detail..."
                  rows="4"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Filter Section */}
        <div className="filter-buttons">
          {statuses.map(status => (
            <button
              key={status.value}
              className={`filter-btn ${selectedStatus === status.value ? 'active' : ''}`}
              onClick={() => setSelectedStatus(status.value)}
            >
              {status.label} ({countByStatus(status.value)})
            </button>
          ))}
        </div>

        {/* Complaints List */}
        <section className="complaints-list-section">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading complaints...</p>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="empty-state">
              <p>No complaints {selectedStatus !== 'all' ? 'with ' + selectedStatus + ' status' : ''}yet.</p>
              <p>Click 'New Complaint' to create one.</p>
            </div>
          ) : (
            <div className="complaints-grid">
              {filteredComplaints.map((complaint) => (
                <div key={complaint.id} className="complaint-card">
                  <div className="card-header">
                    <div>
                      <h3>{complaint.title}</h3>
                      <p className="complaint-id">Complaint #{complaint.id}</p>
                    </div>
                    <div className="badge-group">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(complaint.status) }}
                      >
                        {complaint.status?.replace('_', ' ').toUpperCase()}
                      </span>
                      {complaint.priority && (
                        <span 
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(complaint.priority) }}
                        >
                          {complaint.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-details">
                    <div className="detail-row">
                      <span className="label">Category:</span>
                      <span className="value">{complaint.category?.toUpperCase()}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Location:</span>
                      <span className="value">{complaint.location || 'N/A'}</span>
                    </div>
                    {complaint.description && (
                      <div className="detail-row full-width">
                        <span className="label">Description:</span>
                        <span className="value">{complaint.description}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">
                        {complaint.created_at && new Date(complaint.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  {complaint.technician_name && (
                    <div className="assigned-section">
                      <span className="assigned-label">👤 Assigned to:</span>
                      <span className="assigned-name">{complaint.technician_name}</span>
                    </div>
                  )}

                  {complaint.resolution_notes && (
                    <div className="resolution-section">
                      <span className="resolution-label">✓ Resolution:</span>
                      <span className="resolution-text">{complaint.resolution_notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </StudentLayout>
  );
};

export default StudentComplaints;



