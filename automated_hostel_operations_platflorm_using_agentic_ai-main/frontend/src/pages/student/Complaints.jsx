import React, { useState, useEffect } from 'react';
import RaiseComplaintModal from '../../components/complaints/RaiseComplaintModal';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/student-complaints.css';

const Complaints = () => {
  const currentUser = getCurrentUser();
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomNumber, setRoomNumber] = useState('');
  const [blockInfo, setBlockInfo] = useState({ blockId: null, blockName: '' });

  // Fetch complaints from API on component mount
  useEffect(() => {
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

    const fetchRoomNumber = async () => {
      try {
        if (!currentUser?.userId) return;

        const res = await fetch(`http://localhost:5000/api/student/room/${currentUser.userId}`);
        const data = await res.json();

        if (data.success && data.data?.room) {
          setRoomNumber(data.data.room.room_number);
          setBlockInfo({
            blockId: data.data.room.block_id,
            blockName: data.data.room.block_name
          });
        }
      } catch (error) {
        console.error('Error fetching room number:', error);
      }
    };

    fetchComplaints();
    fetchRoomNumber();
  }, [currentUser?.userId]);

  const handleAddComplaint = async (newComplaintData) => {
    try {
      const res = await fetch('http://localhost:5000/api/student/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: currentUser.userId,
          issue_type: newComplaintData.category,
          description: newComplaintData.description,
          location: newComplaintData.location,
          block_id: newComplaintData.block_id || blockInfo.blockId,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Add new complaint to list
        const newComplaint = {
          id: data.id || Date.now(),
          issue_type: newComplaintData.categoryLabel || newComplaintData.category,
          category: newComplaintData.categoryLabel || newComplaintData.category,
          description: newComplaintData.description,
          location: newComplaintData.location,
          block_id: newComplaintData.block_id || blockInfo.blockId,
          block_name: blockInfo.blockName,
          status: data.status || 'pending',
          title: newComplaintData.title || newComplaintData.categoryLabel || newComplaintData.category,
          created_at: new Date().toISOString(),
        };
        setComplaints([newComplaint, ...complaints]);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
    }
  };

  // Map backend status values to display format
  const getDisplayStatus = (status) => {
    const statusMap = {
      'pending': 'Pending',
      'assigned': 'In Progress',
      'in_progress': 'In Progress',
      'resolved': 'Resolved',
    };
    return statusMap[status] || status;
  };

  const activeCount = complaints.filter((c) => c.status === 'pending' || c.status === 'assigned' || c.status === 'in_progress').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;

  const getDisplayCategory = (category) => {
    const normalized = (category || '').toString().toLowerCase();
    const categoryMap = {
      electrical: 'Electrical',
      plumbing: 'Plumbing',
      carpentry: 'Carpentry',
      hvac: 'HVAC',
      wifi: 'WiFi',
      other: 'Other'
    };
    return categoryMap[normalized] || category || 'Other';
  };

  const filteredComplaints = selectedStatus === 'all' 
    ? complaints
    : selectedStatus === 'active'
    ? complaints.filter((c) => c.status === 'pending' || c.status === 'assigned' || c.status === 'in_progress')
    : complaints.filter((c) => c.status === 'resolved');
  return (
    <>
      <div className="leave-page">
        <header className="page-header-card leave-header">
          <div className="page-header-text">
            <h2>Maintenance Complaints</h2>
            <p>Track and manage your hostel maintenance issues</p>
          </div>
          <button className="primary-action-btn complaints-raise-btn" onClick={() => setShowModal(true)}>
            + Raise Complaint
          </button>
        </header>

        <div className="complaints-actions">
          <div className="leave-filters">
            <button 
              className={`filter-btn ${selectedStatus === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('all')}
            >
              All ({complaints.length})
            </button>
            <button 
              className={`filter-btn ${selectedStatus === 'active' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('active')}
            >
              Active ({activeCount})
            </button>
            <button 
              className={`filter-btn ${selectedStatus === 'resolved' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('resolved')}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="leave-empty">
            <div className="leave-empty-card">
              <div className="empty-text">Loading complaints...</div>
            </div>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="leave-empty">
            <div className="leave-empty-card">
              <div className="leave-empty-icon">📋</div>
              <h3>No complaints found</h3>
              <p>
                {selectedStatus === 'active'
                  ? 'No active complaints. Your hostel is all good!'
                  : selectedStatus === 'resolved' 
                  ? 'No resolved complaints yet.'
                  : 'You haven\'t raised any complaints yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="leave-list">
            {filteredComplaints.map((complaint) => (
              <article className="leave-card" key={complaint.id}>
                <div className="leave-card-top">
                  <div>
                    <div className="leave-name">{complaint.title || complaint.issue_type}</div>
                    <div className="leave-meta">
                      {getDisplayCategory(complaint.issue_type || complaint.category)} - {complaint.location}
                      {complaint.student_name && <span style={{marginLeft: '8px', color: '#667eea', fontWeight: '600'}}>👤 {complaint.student_name}</span>}
                    </div>
                  </div>
                  <div className="leave-tags">
                    <span className={`tag ${getDisplayStatus(complaint.status).toLowerCase().replace(' ', '-')}`}>
                      {getDisplayStatus(complaint.status)}
                    </span>
                  </div>
                </div>

                <div className="leave-grid">
                  <div>
                    <div className="leave-label">Category</div>
                    <div className="leave-value">{getDisplayCategory(complaint.issue_type || complaint.category)}</div>
                  </div>
                  <div>
                    <div className="leave-label">Location</div>
                    <div className="leave-value">
                      {complaint.location}
                      {complaint.block_name && ` (${complaint.block_name})`}
                    </div>
                  </div>
                  <div>
                    <div className="leave-label">Status</div>
                    <div className="leave-value">{getDisplayStatus(complaint.status)}</div>
                  </div>
                  <div>
                    <div className="leave-label">Date Raised</div>
                    <div className="leave-value">
                      {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString('en-GB') : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="leave-reason">
                  <div className="leave-label">Description</div>
                  <div className="leave-value">{complaint.description}</div>
                </div>

                {complaint.technician_name && (
                  <div className="leave-reason">
                    <div className="leave-label">Assigned Technician</div>
                    <div className="leave-value">👤 {complaint.technician_name}</div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      {showModal && (
        <RaiseComplaintModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddComplaint}
          roomNumber={roomNumber}
          blockInfo={blockInfo}
        />
      )}
    </>
  );
};

export default Complaints;



