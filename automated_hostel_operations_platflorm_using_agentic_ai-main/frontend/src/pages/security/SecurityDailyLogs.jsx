import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/security-dashboard.css';

const SecurityDailyLogs = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityFilter, setActivityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [selectedDate]);

  useEffect(() => {
    if (showDetails) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showDetails]);

  const fetchLogs = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const url = new URL('http://localhost:5000/api/security/logs');
      url.searchParams.append('date', selectedDate);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const formattedLogs = data.data.map((log) => {
          const timestamp = log.timestamp ? new Date(log.timestamp) : new Date();
          const followUpRaw = log.follow_up_required;
          const followUpRequired =
            followUpRaw === true ||
            followUpRaw === 1 ||
            followUpRaw === '1' ||
            String(followUpRaw || '').toLowerCase() === 'yes';

          return {
            id: log.id,
            timestamp,
            time: timestamp.toLocaleTimeString(),
            date: timestamp.toISOString().split('T')[0],
            type: log.activity_type ? log.activity_type.charAt(0).toUpperCase() + log.activity_type.slice(1) : 'Other',
            description: log.description || 'No description',
            person: log.logged_by_name || 'Security Staff',
            status: log.severity ? log.severity.charAt(0).toUpperCase() + log.severity.slice(1) : 'Low',
            location: log.location || 'Not specified',
            actionTaken: log.action_taken || 'No action recorded',
            details: log.location ? `Location: ${log.location}` : (log.action_taken || 'N/A'),
            remarks: followUpRequired ? 'Follow-up required' : 'No follow-up',
            followUpRequired
          };
        });
        setAllLogs(formattedLogs);
      } else {
        console.warn('No data or success flag false:', data);
        setAllLogs([]);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setAllLogs([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Filter logs by date and activity/status filters
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const dateMatch = log.date === selectedDate;
      const activityMatch = activityFilter === 'All' || log.type === activityFilter;
      const statusMatch = statusFilter === 'All' || log.status === statusFilter;
      return dateMatch && activityMatch && statusMatch;
    });
  }, [allLogs, selectedDate, activityFilter, statusFilter]);

  // Calculate summary statistics from filtered logs
  const summaryCards = useMemo(() => {
    return [
      { 
        label: 'Total Outpasses Checked', 
        value: filteredLogs.filter(l => l.type === 'Outpass').length, 
        icon: '🚪' 
      },
      { 
        label: 'Visitors Logged', 
        value: filteredLogs.filter(l => l.type === 'Visitor').length, 
        icon: '🧾' 
      },
      { 
        label: 'Parcels Received', 
        value: filteredLogs.filter(l => l.type === 'Parcel').length, 
        icon: '📦' 
      },
      { 
        label: 'High Priority', 
        value: filteredLogs.filter(l => l.status === 'High' || l.status === 'Critical').length, 
        icon: '⚠️' 
      },
      { 
        label: 'Completed', 
        value: filteredLogs.filter(l => l.status === 'Low' || l.status === 'Medium').length, 
        icon: '✅' 
      }
    ];
  }, [filteredLogs]);

  const hasData = filteredLogs.length > 0;

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedLog(null);
  };

  const getStatusClass = (status) => `log-${status.toLowerCase()}`;

  return (
    <>
      <header className="logs-header">
            <div className="header-content">
              <h1 className="security-title-main">Daily Security Logs</h1>
              <p className="security-subtitle">Overview of hostel security activities</p>
            </div>
            <div className="logs-controls">
              <div className="filter-group">
                <label className="filter-label">Select Date</label>
                <input
                  className="filter-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <button className="btn-action primary" onClick={() => fetchLogs(true)}>
                {refreshing ? 'Refreshing...' : 'Refresh Logs'}
              </button>
            </div>
          </header>

          <section className="log-summary-cards">
            {summaryCards.map((card) => (
              <div key={card.label} className="log-summary-card">
                <div className="card-content">
                  <div className="card-label">{card.label}</div>
                  <div className="card-value">{card.value}</div>
                </div>
                <div className="card-icon">{card.icon}</div>
              </div>
            ))}
          </section>

          <section className="log-filters">
            <div className="filter-group">
              <label className="filter-label">Activity Type</label>
              <select
                className="filter-select"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
              >
                <option>All</option>
                <option>Outpass</option>
                <option>Visitor</option>
                <option>Parcel</option>
                <option>Incident</option>
                <option>Patrol</option>
                <option>Emergency</option>
                <option>Other</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
            <div className="filter-group log-filter-reset-group">
              <label className="filter-label">Quick Actions</label>
              <button
                className="btn-action"
                onClick={() => {
                  setActivityFilter('All');
                  setStatusFilter('All');
                }}
              >
                Reset Filters
              </button>
            </div>
          </section>

          {loading ? (
            <div className="outpass-loading">Loading security logs...</div>
          ) : hasData ? (
            <>
              <section className="log-table">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Activity Type</th>
                      <th>Description</th>
                      <th>Student / Visitor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} onClick={() => handleViewDetails(log)}>
                        <td className="mono">{log.time}</td>
                        <td>{log.type}</td>
                        <td>{log.description}</td>
                        <td>{log.person}</td>
                        <td>
                          <span className={`status-badge ${getStatusClass(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="log-cards-mobile">
                {filteredLogs.map((log) => (
                  <article key={`mobile-${log.id}`} className="log-card-mobile" onClick={() => handleViewDetails(log)}>
                    <div className="log-card-head">
                      <strong>{log.type}</strong>
                      <span className={`status-badge ${getStatusClass(log.status)}`}>{log.status}</span>
                    </div>
                    <p>{log.description}</p>
                    <div className="log-card-meta">
                      <span>{log.time}</span>
                      <span>{log.person}</span>
                    </div>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🗓️</span>
              <p className="empty-message">{loading ? 'Loading...' : 'No security activities recorded for this date'}</p>
            </div>
          )}

      {showDetails && selectedLog && (
        <div className="modal-overlay logs-modal-overlay" onClick={closeDetails}>
          <div className="modal-content logs-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header logs-details-header">
              <h2>Log Details</h2>
              <button className="modal-close" onClick={closeDetails}>×</button>
            </div>
            <div className="modal-body">
              <div className="logs-details-grid">
                <div className="logs-detail-item">
                  <div className="logs-detail-label">Time</div>
                  <div className="logs-detail-value">{selectedLog.time}</div>
                </div>
                <div className="logs-detail-item">
                  <div className="logs-detail-label">Activity</div>
                  <div className="logs-detail-value">{selectedLog.type}</div>
                </div>
                <div className="logs-detail-item">
                  <div className="logs-detail-label">Severity</div>
                  <div className="logs-detail-value">{selectedLog.status}</div>
                </div>
                <div className="logs-detail-item">
                  <div className="logs-detail-label">Log ID</div>
                  <div className="logs-detail-value">#{selectedLog.id}</div>
                </div>
                <div className="logs-detail-item">
                  <div className="logs-detail-label">Person</div>
                  <div className="logs-detail-value">{selectedLog.person}</div>
                </div>
                <div className="logs-detail-item">
                  <div className="logs-detail-label">Location</div>
                  <div className="logs-detail-value">{selectedLog.location}</div>
                </div>
                <div className="logs-detail-item logs-detail-item-full">
                  <div className="logs-detail-label">Description</div>
                  <div className="logs-detail-value">{selectedLog.description}</div>
                </div>
                <div className="logs-detail-item logs-detail-item-full">
                  <div className="logs-detail-label">Action Taken</div>
                  <div className="logs-detail-value">{selectedLog.actionTaken}</div>
                </div>
                <div className="logs-detail-item logs-detail-item-full">
                  <div className="logs-detail-label">Follow-up</div>
                  <div className="logs-detail-value">{selectedLog.remarks}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer logs-details-footer">
              <button className="btn-secondary logs-details-close" onClick={closeDetails}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityDailyLogs;

