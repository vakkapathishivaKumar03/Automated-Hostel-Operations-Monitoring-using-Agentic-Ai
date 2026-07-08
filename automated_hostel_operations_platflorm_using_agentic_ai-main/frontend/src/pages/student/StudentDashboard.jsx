import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/student-dashboard.css';

const StudentDashboard = () => {
  const currentUser = getCurrentUser();
  const [studentProfile, setStudentProfile] = useState(null);
  const [activeOutpasses, setActiveOutpasses] = useState(0);
  const [openComplaints, setOpenComplaints] = useState(0);
  const [roomNumber, setRoomNumber] = useState('—');
  const [hostelBlock, setHostelBlock] = useState('—');
  const [pendingParcels, setPendingParcels] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);

  const normalizeParcelStatus = (status) => {
    const normalizedStatus = String(status || '').toLowerCase();
    return normalizedStatus === 'collected' ? 'collected' : 'pending';
  };

  const parseActivityTime = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }

    const normalized = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(raw)
      ? raw.replace(' ', 'T')
      : raw;

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        if (!currentUser?.userId) return;
        
        setLoading(true);
        let currentStudentId = null;
        
        // Fetch student profile
        const profileRes = await fetch(`http://localhost:5000/api/student/profile/${currentUser.userId}`);
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data) {
          setStudentProfile(profileData.data);
          currentStudentId = profileData.data.id;
          setRoomNumber(profileData.data.room_number || '—');
          setHostelBlock(profileData.data.block_name || '—');
        }
        
        // Fetch outpasses
        const outpassRes = await fetch(`http://localhost:5000/api/student/outpasses/${currentUser.userId}`);
        const outpassData = await outpassRes.json();
        if (outpassData.success && Array.isArray(outpassData.data)) {
          const activeCount = outpassData.data.filter(op => op.status === 'approved').length;
          setActiveOutpasses(activeCount);
        }
        
        // Fetch complaints
        const complaintRes = await fetch(`http://localhost:5000/api/student/complaints/${currentUser.userId}`);
        const complaintData = await complaintRes.json();
        if (complaintData.success && Array.isArray(complaintData.data)) {
          const ownComplaints = currentStudentId
            ? complaintData.data.filter((c) => String(c.student_id) === String(currentStudentId))
            : complaintData.data;
          const openCount = ownComplaints.filter(c => c.status !== 'resolved').length;
          setOpenComplaints(openCount);
        }

        // Fetch leaves
        const leaveRes = await fetch(`http://localhost:5000/api/student/leaves/${currentUser.userId}`);
        const leaveData = await leaveRes.json();
        
        // Fetch parcels
        const parcelRes = await fetch(`http://localhost:5000/api/student/parcels/${currentUser.userId}`);
        const parcelData = await parcelRes.json();
        if (parcelData.success && Array.isArray(parcelData.data)) {
          const pendingCount = parcelData.data.filter((parcel) => normalizeParcelStatus(parcel.status) === 'pending').length;
          setPendingParcels(pendingCount);
        }
        
        // Build recent activities from all data sources
        const activities = [];
        
        // Add outpass activities
        if (outpassData.success && Array.isArray(outpassData.data)) {
          outpassData.data.slice(0, 3).forEach(outpass => {
            let icon = '🛂';
            let title = '';
            let desc = `Outpass to ${outpass.destination}`;
            let eventTime = outpass.created_at || outpass.updated_at;
            
            if (['approved', 'approved_otp', 'exited', 'returned'].includes(outpass.status)) {
              icon = '✅';
              title = 'Outpass Approved';
              eventTime = outpass.approved_at || outpass.updated_at || outpass.created_at;
            } else if (outpass.status === 'rejected') {
              icon = '❌';
              title = 'Outpass Rejected';
              eventTime = outpass.approved_at || outpass.updated_at || outpass.created_at;
            } else {
              icon = '⏳';
              title = 'Outpass Requested';
              eventTime = outpass.created_at || outpass.updated_at;
            }
            
            activities.push({
              id: `outpass-${outpass.id}`,
              title,
              desc,
              time: eventTime,
              icon
            });
          });
        }
        
        // Add complaint activities
        if (complaintData.success && Array.isArray(complaintData.data)) {
          const ownComplaints = currentStudentId
            ? complaintData.data.filter((c) => String(c.student_id) === String(currentStudentId))
            : complaintData.data;

          ownComplaints.slice(0, 3).forEach(complaint => {
            let icon = '⚠️';
            let title = '';
            let eventTime = complaint.created_at || complaint.updated_at;
            
            if (complaint.status === 'resolved') {
              icon = '✅';
              title = 'Complaint Resolved';
              eventTime = complaint.resolved_at || complaint.updated_at || complaint.created_at;
            } else if (complaint.status === 'in_progress') {
              icon = '🔧';
              title = 'Complaint In Progress';
              eventTime = complaint.updated_at || complaint.created_at;
            } else {
              icon = '⚠️';
              title = 'Complaint Raised';
              eventTime = complaint.created_at || complaint.updated_at;
            }
            
            activities.push({
              id: `complaint-${complaint.id}`,
              title,
              desc: complaint.description || complaint.issue_type,
              time: eventTime,
              icon
            });
          });
        }

        // Add leave activities
        if (leaveData.success && Array.isArray(leaveData.data)) {
          leaveData.data.slice(0, 3).forEach(leave => {
            let icon = '📝';
            let title = '';
            let eventTime = leave.created_at || leave.updated_at || leave.from_date;

            if (leave.status === 'approved' || leave.status === 'active' || leave.status === 'completed') {
              icon = '✅';
              title = 'Leave Approved';
              eventTime = leave.approved_at || leave.active_at || leave.completed_at || leave.updated_at || leave.created_at || leave.from_date;
            } else if (leave.status === 'rejected' || leave.status === 'cancelled' || leave.status === 'expired') {
              icon = '❌';
              title = 'Leave Rejected';
              eventTime = leave.approved_at || leave.expired_at || leave.updated_at || leave.created_at || leave.from_date;
            } else {
              icon = '⏳';
              title = 'Leave Requested';
              eventTime = leave.created_at || leave.updated_at || leave.from_date;
            }

            activities.push({
              id: `leave-${leave.id}`,
              title,
              desc: leave.leave_reason || `${leave.leave_type || 'Leave'} request`,
              time: eventTime,
              icon
            });
          });
        }
        
        // Add parcel activities
        if (parcelData.success && Array.isArray(parcelData.data)) {
          parcelData.data.slice(0, 2).forEach(parcel => {
            const parcelStatus = normalizeParcelStatus(parcel.status);
            let icon = '📦';
            let title = '';
            let eventTime = parcel.received_at || parcel.received_date;
            
            if (parcelStatus === 'collected') {
              icon = '✅';
              title = 'Parcel Collected';
              eventTime = parcel.collected_at || parcel.received_at || parcel.received_date;
            } else {
              icon = '📦';
              title = 'Parcel Arrived';
              eventTime = parcel.received_at || parcel.received_date;
            }
            
            activities.push({
              id: `parcel-${parcel.id}`,
              title,
              desc: parcel.sender_name ? `From ${parcel.sender_name}` : 'Parcel received',
              time: eventTime,
              icon
            });
          });
        }
        
        // Sort by time (most recent first) and take top 5
        activities.sort((a, b) => {
          const timeA = parseActivityTime(a.time);
          const timeB = parseActivityTime(b.time);
          const valueA = timeA ? timeA.getTime() : 0;
          const valueB = timeB ? timeB.getTime() : 0;
          return valueB - valueA;
        });
        
        setRecentActivities(activities.slice(0, 5));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching student data:', error);
        setLoading(false);
      }
    };
    
    fetchStudentData();
  }, [currentUser?.userId]);
  
  const navigate = useNavigate();

  // Format time to relative (e.g., "2 days ago")
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const now = new Date();
    const activityTime = parseActivityTime(timestamp);
    if (!activityTime) return 'Recently';
    const diffMs = now - activityTime;
    if (diffMs < 0) return activityTime.toLocaleDateString('en-GB');
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return activityTime.toLocaleDateString('en-GB');
  };

  return (
    <div className="dashboard-page student-main">
      <div className="main-content">
      <div className="dashboard-header">
        <div className="header-row">
          <div className="welcome-card">
            <h1 className="welcome">Welcome back, {studentProfile?.name || 'Student'}!</h1>
            <p className="subtext">Here's what's happening with your hostel stay</p>
          </div>
        </div>
      </div>
      <section className="summary-cards">
            <div className="card">
              <div className="card-body">
                <div>
                  <div className="card-title">Active Outpasses</div>
                  <div className="card-value">{activeOutpasses}</div>
                  <div className="card-sub">{activeOutpasses === 0 ? 'No active outpass' : `${activeOutpasses} active`}</div>
                </div>
                <div className="card-icon">🛂</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div>
                  <div className="card-title">Open Complaints</div>
                  <div className="card-value">{openComplaints}</div>
                  <div className="card-sub">{openComplaints > 0 ? 'Pending resolution' : 'No open complaints'}</div>
                </div>
                <div className="card-icon">⚠️</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div>
                  <div className="card-title">Room Number</div>
                  <div className="card-value">{roomNumber}</div>
                  <div className="card-sub">{hostelBlock}</div>
                </div>
                <div className="card-icon">🛏️</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div>
                  <div className="card-title">Pending Parcels</div>
                  <div className="card-value">{pendingParcels}</div>
                  <div className="card-sub">{pendingParcels > 0 ? 'Ready for collection' : 'No pending parcels'}</div>
                </div>
                <div className="card-icon">📦</div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="quick-actions">
            <div className="section-header-main">
              <div className="section-left">
                <div className="section-icon-badge">⚡</div>
                <div>
                  <h2 className="section-title">Quick Actions</h2>
                  <p className="section-subtitle">Commonly used student services</p>
                </div>
              </div>
            </div>
            <div className="actions-grid">
              <div className="action-card blue-card" onClick={() => navigate('/student/outpass')} role="button">
                <div className="card-top">
                  <div className="action-icon-container blue">
                    <span className="action-icon">🛂</span>
                  </div>
                  <div className="card-arrow">→</div>
                </div>
                <div className="action-content">
                  <div className="action-title">Request Outpass</div>
                  <div className="action-desc">Apply for permission to leave the campus</div>
                </div>
              </div>

              <div className="action-card purple-card" onClick={() => navigate('/student/leave')} role="button">
                <div className="card-top">
                  <div className="action-icon-container purple">
                    <span className="action-icon">📝</span>
                  </div>
                  <div className="card-arrow">→</div>
                </div>
                <div className="action-content">
                  <div className="action-title">Leave Request</div>
                  <div className="action-desc">Request leave from college classes</div>
                </div>
              </div>

              <div className="action-card red-card" onClick={() => navigate('/student/complaints')} role="button">
                <div className="card-top">
                  <div className="action-icon-container red">
                    <span className="action-icon">⚠️</span>
                  </div>
                  <div className="card-arrow">→</div>
                </div>
                <div className="action-content">
                  <div className="action-title">Raise Complaint</div>
                  <div className="action-desc">Report maintenance or other issues</div>
                </div>
              </div>

              <div className="action-card orange-card" onClick={() => navigate('/student/mess')} role="button">
                <div className="card-top">
                  <div className="action-icon-container orange">
                    <span className="action-icon">🍽️</span>
                  </div>
                  <div className="card-arrow">→</div>
                </div>
                <div className="action-content">
                  <div className="action-title">View Mess Menu</div>
                  <div className="action-desc">Check today's meals and weekly schedule</div>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="recent-activity">
            <h2 className="section-heading">Recent Activity</h2>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                Loading activities...
              </div>
            ) : recentActivities.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                No recent activities yet
              </div>
            ) : (
              <ul className="activity-list">
                {recentActivities.map((activity) => (
                  <li key={activity.id} className="activity-item">
                    <div className="activity-left">
                      <div className="activity-icon">{activity.icon}</div>
                      <div className="activity-info">
                        <div className="activity-title">{activity.title}</div>
                        <div className="activity-desc">{activity.desc}</div>
                      </div>
                    </div>
                    <div className="activity-time">{getTimeAgo(activity.time)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
      </div>
    </div>
  );
};

export default StudentDashboard;


