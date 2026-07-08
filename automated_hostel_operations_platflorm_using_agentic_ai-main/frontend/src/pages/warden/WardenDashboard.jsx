import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders, getCurrentUser } from '../../utils/auth';
import '../../styles/warden-dashboard.css';

const WardenDashboard = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const wardenName = currentUser?.name?.trim() || 'Warden';
  const [activeTab, setActiveTab] = useState('outpass');
  const [pendingOutpass, setPendingOutpass] = useState(0);
  const [outpasses, setOutpasses] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState(0);
  const [activeComplaints, setActiveComplaints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [recentActivities, setRecentActivities] = useState([]);
  const [securitySummary, setSecuritySummary] = useState({
    high_priority_alerts: 0,
    missing_students: 0,
    unauthorized_exit_attempts: 0,
    high_risk_students: 0
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch pending outpasses
        const outpassRes = await fetch('http://localhost:5000/api/warden/outpasses/pending', {
          headers: getAuthHeaders()
        });
        const outpassData = await outpassRes.json();
        if (outpassData.success && Array.isArray(outpassData.data)) {
          setOutpasses(outpassData.data);
          setPendingOutpass(outpassData.data.length);
        }
        
        // Fetch recent activities
        const activitiesRes = await fetch('http://localhost:5000/api/warden/recent-activities', {
          headers: getAuthHeaders()
        });
        const activitiesData = await activitiesRes.json();
        if (activitiesData.success && Array.isArray(activitiesData.data)) {
          setRecentActivities(activitiesData.data);
        }

        const securityRes = await fetch('http://localhost:5000/api/warden/security/agentic-monitor', {
          headers: getAuthHeaders()
        });
        const securityData = await securityRes.json();
        if (securityData.success && securityData.data) {
          setSecuritySummary(securityData.data.status_summary || {});
        }
        
        // Fetch warden dashboard stats for summary
        const dashRes = await fetch('http://localhost:5000/api/warden/dashboard', {
          headers: getAuthHeaders()
        });
        const dashData = await dashRes.json();
        if (dashData.success && dashData.data) {
          setLeaveRequests(dashData.data.pending_leaves || 0);
          setActiveComplaints(dashData.data.active_complaints || 0);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    const poller = setInterval(fetchData, 60000);
    fetchData();
    return () => clearInterval(poller);
  }, []);

  return (
    <div>
      <header className="page-header-card">
        <div className="page-header-text">
          <h1 className="warden-welcome">{greeting}, {wardenName} 👋</h1>
          <p className="warden-sub">Here's what's happening in your hostel today</p>
        </div>
        <div className="page-header-action-group">
          <div className="last-updated">Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </header>

      <section className="monitor-cards">
        <div className="monitor-card orange" onClick={() => navigate('/warden/outpass')} role="button">
          <div className="monitor-left">
            <div className="monitor-title">Pending Outpasses</div>
            <div className="monitor-value">{pendingOutpass}</div>
            <div className="monitor-sub">{pendingOutpass > 0 ? 'Requires action' : 'All cleared'}</div>
          </div>
          <div className="monitor-icon">🛂</div>
        </div>

        <div className="monitor-card blue" onClick={() => navigate('/warden/leave')} role="button">
          <div className="monitor-left">
            <div className="monitor-title">Leave Requests</div>
            <div className="monitor-value">{leaveRequests}</div>
            <div className="monitor-sub">{leaveRequests > 0 ? 'Pending approval' : 'All processed'}</div>
          </div>
          <div className="monitor-icon">📝</div>
        </div>

        <div className="monitor-card red" onClick={() => navigate('/warden/complaints')} role="button">
          <div className="monitor-left">
            <div className="monitor-title">Active Complaints</div>
            <div className="monitor-value">{activeComplaints}</div>
            <div className="monitor-sub">{activeComplaints > 0 ? 'Need attention' : 'No issues'}</div>
          </div>
          <div className="monitor-icon">⚠️</div>
        </div>

        <div className="monitor-card red" onClick={() => navigate('/warden/agentic-alerts')} role="button">
          <div className="monitor-left">
            <div className="monitor-title">Security Alerts</div>
            <div className="monitor-value">{securitySummary.high_priority_alerts || 0}</div>
            <div className="monitor-sub">
              {securitySummary.missing_students || 0} missing - {securitySummary.high_risk_students || 0} high-risk
            </div>
          </div>
          <div className="monitor-icon">🛡️</div>
        </div>

      </section>

      <div className="dashboard-row">
        <section className="recent-activity">
          <div className="section-header">
            <h2>⏱️ Recent Activity</h2>
          </div>
          <div className="activity-list">
            {recentActivities.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                No recent activities yet
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div className="activity-item" key={activity.id}>
                  <div className="activity-icon">{activity.icon}</div>
                  <div className="activity-content">
                    <div className="activity-action">{activity.action}</div>
                    <div className="activity-meta">{activity.student} - {activity.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="management-cards">
        <div className="section-header-main">
          <div className="section-left">
            <div className="section-icon-badge">⚡</div>
            <div>
              <h2 className="section-title">Quick Actions</h2>
              <p className="section-subtitle">Commonly used management tools</p>
            </div>
          </div>
        </div>
        <div className="management-grid">
          <div className="manage-card purple-card" onClick={() => navigate('/warden/registrations')} role="button">
            <div className="card-top">
              <div className="manage-icon-container purple">
                <span className="manage-icon">🧾</span>
              </div>
              <div className="card-arrow">→</div>
            </div>
            <div className="manage-content">
              <div className="manage-title">Verify Registrations</div>
              <div className="manage-desc">Approve or reject new student registrations</div>
            </div>
          </div>

          <div className="manage-card orange-card" onClick={() => navigate('/warden/mess')} role="button">
            <div className="card-top">
              <div className="manage-icon-container orange">
                <span className="manage-icon">🍽️</span>
              </div>
              <div className="card-arrow">→</div>
            </div>
            <div className="manage-content">
              <div className="manage-title">Mess Menu</div>
              <div className="manage-desc">Update mess schedule and meals</div>
            </div>
          </div>

          <div className="manage-card blue-card" onClick={() => navigate('/warden/rooms')} role="button">
            <div className="card-top">
              <div className="manage-icon-container blue">
                <span className="manage-icon">🛏️</span>
              </div>
              <div className="card-arrow">→</div>
            </div>
            <div className="manage-content">
              <div className="manage-title">Room Allocation</div>
              <div className="manage-desc">Manage room allotments and availability</div>
            </div>
          </div>

          <div className="manage-card green-card" onClick={() => navigate('/warden/technicians')} role="button">
            <div className="card-top">
              <div className="manage-icon-container green">
                <span className="manage-icon">🔧</span>
              </div>
              <div className="card-arrow">→</div>
            </div>
            <div className="manage-content">
              <div className="manage-title">Technicians</div>
              <div className="manage-desc">Assign maintenance tasks and technicians</div>
            </div>
          </div>
        </div>
      </section>

      <section className="request-management">
        <div className="section-header">
          <h2>📋 Recent Requests Overview</h2>
          <button className="view-all-btn" onClick={() => navigate(`/warden/${activeTab}`)}>
            View All →
          </button>
        </div>
        <div className="request-controls">
          <div className="tabs">
            <button
              className={activeTab === 'outpass' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('outpass')}
            >
              🛂 Outpass
            </button>
            <button
              className={activeTab === 'leave' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('leave')}
            >
              📝 Leave
            </button>
            <button
              className={activeTab === 'complaints' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('complaints')}
            >
              ⚠️ Complaints
            </button>
          </div>

          <div className="request-actions">
            <input className="search" placeholder="🔍 Search by name, roll no..." />
            <select className="filter">
              <option>All Status</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
        </div>

        <div className="request-list-preview">
          {activeTab === 'outpass' ? (
            outpasses.length === 0 ? (
              <div className="empty-state-modern">
                <div className="empty-icon-large">📭</div>
                <h3>No outpass requests yet</h3>
                <p>When students submit outpass requests, they will appear here.</p>
              </div>
            ) : (
              <div className="request-preview-list">
                {outpasses.slice(0, 5).map(op => (
                  <div key={op.id} className="request-preview-card">
                    <div className="request-preview-card-header">
                      <div className="request-preview-main">
                        <div className="request-preview-title">{op.destination}</div>
                        <div className="request-preview-meta">
                          {op.student_name || 'Student'} - {op.departure_date && new Date(op.departure_date).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                      <span className="request-preview-status">
                        {op.status || 'PENDING'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="empty-state-modern">
              <div className="empty-icon-large">📭</div>
              <h3>No {activeTab} requests yet</h3>
              <p>When students submit {activeTab} requests, they will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default WardenDashboard;



