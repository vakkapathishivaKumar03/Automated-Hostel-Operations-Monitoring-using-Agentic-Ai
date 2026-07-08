import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/technician-task-history.css';

const TechnicianTaskHistory = () => {
  const currentUser = getCurrentUser();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    if (currentUser?.userId) {
      fetchTaskHistory();
    }
  }, [currentUser?.userId]);

  const fetchTaskHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`http://localhost:5000/api/technician/${currentUser.userId}/complaints`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch task history`);
      }

      const data = await response.json();

      if (data.success && data.all) {
        // Filter only resolved and closed tasks
        const historyTasks = data.all.filter(task => 
          task.status === 'resolved' || task.status === 'closed'
        );
        setTasks(historyTasks);
      } else {
        setError('Failed to load task history');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching task history:', err);
      setError(err.message || 'Failed to load task history');
      setLoading(false);
    }
  };

  const getPriorityStyle = (priority) => {
    const styles = {
      urgent: { backgroundColor: '#ff6b6b', color: 'white' },
      high: { backgroundColor: '#ffa94d', color: 'white' },
      medium: { backgroundColor: '#74c0fc', color: 'white' },
      low: { backgroundColor: '#a6e3a1', color: 'white' },
    };
    return styles[priority] || styles.medium;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      electrical: '⚡',
      plumbing: '🚰',
      carpentry: '🔨',
      hvac: '❄️',
      wifi: '📡',
      furniture: '🪑',
      internet: '📡',
      cleaning: '🧹',
      security: '🔒',
      other: '📋',
    };
    return icons[category] || '📋';
  };

  const filteredTasks = selectedFilter === 'all' 
    ? tasks 
    : tasks.filter(task => task.status === selectedFilter);

  const resolvedCount = tasks.filter(t => t.status === 'resolved').length;
  const closedCount = tasks.filter(t => t.status === 'closed').length;

  return (
    <div className="task-history-page">
      <div className="history-header">
        <div className="header-content">
          <h1>📜 Task History</h1>
          <p>Your completed and resolved maintenance tasks</p>
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <div className="error-message">⚠️ {error}</div>
          <button onClick={fetchTaskHistory} className="retry-button">Retry</button>
        </div>
      )}

      <div className="history-controls">
        <div className="filter-group">
          <button
            className={`filter-button ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('all')}
          >
            <span className="filter-icon">📋</span>
            All <span className="count-badge">{tasks.length}</span>
          </button>
          <button
            className={`filter-button ${selectedFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('resolved')}
          >
            <span className="filter-icon">✅</span>
            Resolved <span className="count-badge">{resolvedCount}</span>
          </button>
          <button
            className={`filter-button ${selectedFilter === 'closed' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('closed')}
          >
            <span className="filter-icon">🔒</span>
            Closed <span className="count-badge">{closedCount}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading task history...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-container">
          <div className="empty-illustration">📭</div>
          <h3>No task history yet</h3>
          <p>Your completed tasks will appear here</p>
        </div>
      ) : (
        <div className="tasks-container">
          {filteredTasks.map((task) => (
            <div key={task.id} className="history-card">
              <div className="card-top">
                <div className="card-title-section">
                  <div className="task-title">
                    <h3>{task.title || `Task #${task.id}`}</h3>
                    <div className="task-subtitle">
                      Category: {getCategoryIcon(task.category)} <span className="category-name">{(task.category || 'other').charAt(0).toUpperCase() + (task.category || 'other').slice(1)}</span>
                    </div>
                  </div>
                </div>
                <div className="card-badges">
                  <span className={`status-badge status-${task.status}`}>
                    {task.status === 'resolved' ? '✅ Resolved' : '🔒 Closed'}
                  </span>
                  <span className="priority-badge" style={getPriorityStyle(task.priority)}>
                    {(task.priority || 'medium').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="card-info-grid">
                <div className="info-cell">
                  <label>Student</label>
                  <div className="info-content">👤 {task.student_name || 'N/A'}</div>
                </div>
                <div className="info-cell">
                  <label>Roll Number</label>
                  <div className="info-content">{task.roll_number || 'N/A'}</div>
                </div>
                <div className="info-cell">
                  <label>Location</label>
                  <div className="info-content">
                    Room {task.room_number || 'N/A'}{task.block_name ? ` (${task.block_name})` : ''}
                  </div>
                </div>
                <div className="info-cell">
                  <label>Date Assigned</label>
                  <div className="info-content">
                    {task.created_at ? new Date(task.created_at).toLocaleDateString('en-GB') : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="card-description">
                <label>📝 Description</label>
                <p>{task.description || 'No description provided'}</p>
              </div>

              {task.resolution_notes && (
                <div className="card-resolution">
                  <label>✍️ Resolution Notes</label>
                  <p>{task.resolution_notes}</p>
                </div>
              )}

              {task.resolved_at && (
                <div className="card-completion">
                  <label>✅ Completed On</label>
                  <div className="completion-time">
                    {new Date(task.resolved_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TechnicianTaskHistory;


