import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/admin-dashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DASHBOARD_REFRESH_INTERVAL_MS = 15000;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    totalWardens: 0,
    totalTechnicians: 0,
    totalSecurity: 0,
    pendingComplaints: 0,
    totalRooms: 0,
    occupiedRooms: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch dashboard metrics
  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async (showInitialLoader = false) => {
      if (showInitialLoader) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const controller = new AbortController();
        const [dashboardRes, usersRes, activitiesRes, pendingRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/admin/dashboard`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/admin/users`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/admin/dashboard/recent-activities`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/admin/dashboard/pending-approvals`, { signal: controller.signal })
        ]);

        const dashboardData = await dashboardRes.json();
        const usersData = await usersRes.json();
        const activitiesData = await activitiesRes.json();
        const pendingData = await pendingRes.json();

        if (!isMounted) {
          return;
        }
        
        let totalStudents = 0;
        let totalWardens = 0;
        let totalTechnicians = 0;
        let totalSecurity = 0;
        
        if (usersData.success && Array.isArray(usersData.data)) {
          totalStudents = usersData.data.filter(u => u.role === 'student').length;
          totalWardens = usersData.data.filter(u => u.role === 'warden').length;
          totalTechnicians = usersData.data.filter(u => u.role === 'technician').length;
          totalSecurity = usersData.data.filter(u => u.role === 'security').length;
        }
        
        if (dashboardData.success && dashboardData.data) {
          setMetrics({
            totalStudents,
            totalWardens,
            totalTechnicians,
            totalSecurity,
            pendingComplaints: dashboardData.data.active_complaints || 0,
            totalRooms: dashboardData.data.total_rooms || 0,
            occupiedRooms: dashboardData.data.occupied_rooms || 0,
          });
        }

        if (activitiesData.success && Array.isArray(activitiesData.data)) {
          setRecentActivities(activitiesData.data);
        } else {
          setRecentActivities([]);
        }

        if (pendingData.success && Array.isArray(pendingData.data)) {
          setPendingApprovals(pendingData.data);
        } else {
          setPendingApprovals([]);
        }

        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching metrics:', error);
        if (!isMounted) {
          return;
        }
        setRecentActivities([]);
        setPendingApprovals([]);
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchMetrics(true);
    const intervalId = setInterval(() => {
      fetchMetrics(false);
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);
  
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-GB');
  };

  // System status with real data
  const systemStatus = [
    { label: 'Server Status', value: 'Online', color: 'green' },
    { label: 'Active Students', value: metrics.totalStudents.toString(), color: 'blue' },
    { label: 'Pending Complaints', value: metrics.pendingComplaints.toString(), color: metrics.pendingComplaints > 0 ? 'orange' : 'green' },
    { label: 'Room Occupancy', value: `${metrics.occupiedRooms}/${metrics.totalRooms}`, color: 'green' },
  ];

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'approved': return 'badge-approved';
      case 'pending': return 'badge-pending';
      case 'resolved': return 'badge-resolved';
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      case 'low': return 'badge-low';
      default: return 'badge-default';
    }
  };

  const getColorClass = (color) => {
    switch(color) {
      case 'green': return 'status-green';
      case 'blue': return 'status-blue';
      case 'orange': return 'status-orange';
      default: return 'status-gray';
    }
  };

  return (
    <div className="admin-dashboard-page">
      <header className="admin-header page-header-card">
        <div className="header-left page-header-text">
          <h1 className="admin-welcome">Admin Dashboard</h1>
          <p className="admin-sub">System administration and monitoring</p>
        </div>
        <div className="page-header-action-group" style={{ fontSize: '14px', color: '#6b7280', textAlign: 'right' }}>
          {loading ? 'Loading...' : (isRefreshing ? 'Refreshing...' : 'Live data')}
          {lastUpdated && (
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              Last updated: {lastUpdated.toLocaleTimeString('en-GB')}
            </div>
          )}
        </div>
      </header>

      {/* Key Metrics Section */}
      <section className="metrics-section">
        <div className="metrics-grid">
          <div className="metric-card students-card">
            <div className="metric-header">
              <span className="metric-icon">🎓</span>
              <span className="metric-label">Total Students</span>
            </div>
            <div className="metric-value">{metrics.totalStudents}</div>
            <div className="metric-sub">Active registrations</div>
          </div>

          <div className="metric-card wardens-card">
            <div className="metric-header">
              <span className="metric-icon">👨‍💼</span>
              <span className="metric-label">Wardens</span>
            </div>
            <div className="metric-value">{metrics.totalWardens}</div>
            <div className="metric-sub">Managing blocks</div>
          </div>

          <div className="metric-card technicians-card">
            <div className="metric-header">
              <span className="metric-icon">🔧</span>
              <span className="metric-label">Technicians</span>
            </div>
            <div className="metric-value">{metrics.totalTechnicians}</div>
            <div className="metric-sub">Maintenance staff</div>
          </div>

          <div className="metric-card security-card">
            <div className="metric-header">
              <span className="metric-icon">🛡️</span>
              <span className="metric-label">Security</span>
            </div>
            <div className="metric-value">{metrics.totalSecurity}</div>
            <div className="metric-sub">Security personnel</div>
          </div>
        </div>
      </section>

      {/* System Status Section */}
      <section className="system-status-section">
        <h2>System Status</h2>
        <div className="status-grid">
          {systemStatus.map((status, idx) => (
            <div key={idx} className={`status-card ${getColorClass(status.color)}`}>
              <div className="status-label">{status.label}</div>
              <div className="status-value">{status.value}</div>
              <div className={`status-indicator ${getColorClass(status.color)}`}></div>
            </div>
          ))}
        </div>
      </section>

      {/* Management Cards Section */}
      <section className="management-section">
        <h2>Quick Access</h2>
        <div className="management-grid">
          <div className="mgmt-card" onClick={() => navigate('/admin/students')}>
            <div className="mgmt-icon">🎓</div>
            <div className="mgmt-title">Students</div>
            <div className="mgmt-count">{metrics.totalStudents}</div>
            <div className="mgmt-desc">Review & manage</div>
          </div>

          <div className="mgmt-card" onClick={() => navigate('/admin/wardens')}>
            <div className="mgmt-icon">👨‍💼</div>
            <div className="mgmt-title">Wardens</div>
            <div className="mgmt-count">{metrics.totalWardens}</div>
            <div className="mgmt-desc">Add or update</div>
          </div>

          <div className="mgmt-card" onClick={() => navigate('/admin/technicians')}>
            <div className="mgmt-icon">🔧</div>
            <div className="mgmt-title">Technicians</div>
            <div className="mgmt-count">{metrics.totalTechnicians}</div>
            <div className="mgmt-desc">Manage staff</div>
          </div>

          <div className="mgmt-card" onClick={() => navigate('/admin/security')}>
            <div className="mgmt-icon">🔐</div>
            <div className="mgmt-title">Security</div>
            <div className="mgmt-count">{metrics.totalSecurity}</div>
            <div className="mgmt-desc">Manage team</div>
          </div>
        </div>
      </section>

      {/* Recent Activities & Pending Approvals */}
      <section className="activities-section">
        <div className="activity-card">
          <div className="card-header">
            <h3>📊 Recent Activities</h3>
            <span className="header-badge">{recentActivities.length} actions</span>
          </div>
          <div className="activity-list">
            {recentActivities.length === 0 && (
              <div className="activity-item">
                <div className="activity-details">
                  <div className="activity-action">No recent activities available</div>
                </div>
              </div>
            )}
            {recentActivities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">
                  {activity.type === 'complaint' && '⚠️'}
                  {activity.type === 'registration' && '✅'}
                  {activity.type === 'leave' && '📅'}
                  {activity.type === 'outpass' && '🚪'}
                </div>
                <div className="activity-details">
                  <div className="activity-action">{activity.action}</div>
                  <div className="activity-meta">{activity.time}</div>
                </div>
                <span className={`activity-status ${getStatusBadgeClass(activity.status)}`}>
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="activity-card pending-card">
          <div className="card-header">
            <h3>⏳ Pending Approvals</h3>
            <span className="header-badge critical">{pendingApprovals.length} pending</span>
          </div>
          <div className="pending-list">
            {pendingApprovals.length === 0 && (
              <div className="pending-item">
                <div className="pending-info">
                  <div className="pending-name">No pending approvals</div>
                </div>
              </div>
            )}
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="pending-item">
                <div className="pending-type">{approval.type}</div>
                <div className="pending-info">
                  <div className="pending-name">{approval.name || approval.description}</div>
                  <div className="pending-date">{formatDate(approval.date)}</div>
                </div>
                <span className={`pending-priority ${getStatusBadgeClass(approval.priority)}`}>
                  {approval.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;

