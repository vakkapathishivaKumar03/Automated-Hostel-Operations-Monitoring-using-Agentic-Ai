import React, { useMemo, useState, useEffect } from 'react';
import { getCurrentUser } from '../../utils/auth';
import '../../styles/warden-dashboard.css';

const TechnicianAssignedTasks = () => {
  const API_BASE_URL = 'http://localhost:5000';
  const [tasks, setTasks] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('assigned');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionErrors, setActionErrors] = useState({});
  const [hasInitialized, setHasInitialized] = useState(false);
  const currentUser = getCurrentUser();

  // Fetch assigned tasks on mount
  const fetchAssignedTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!currentUser) {
        const message = 'User data not loaded yet. Please wait...';
        console.warn(message);
        setError(message);
        setLoading(false);
        return;
      }

      if (!currentUser?.userId) {
        const message = `User ID not found. Current user: ${JSON.stringify(currentUser)}`;
        console.error(message);
        setError(message);
        setLoading(false);
        return;
      }

      console.log(`🔍 Fetching tasks for technician ID: ${currentUser.userId}`, currentUser);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const apiUrl = `${API_BASE_URL}/api/technician/${currentUser.userId}/complaints`;
      console.log(`📡 API URL: ${apiUrl}`);

      const res = await fetch(apiUrl, { signal: controller.signal });
      
      clearTimeout(timeoutId);

      console.log(`📊 Response status: ${res.status}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ API error: ${res.status} ${res.statusText}`, errorText);
        setError(`Server error: ${res.status} ${res.statusText}`);
        setTasks([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log('✅ Fetched data:', data);

      if (data.success) {
        const allTasks = data.all || [];
        console.log(`📋 Total tasks received: ${allTasks.length}`, allTasks);
        setTasks(allTasks);
        setError(null);
      } else {
        const message = data.message || 'Failed to fetch tasks';
        console.warn('⚠️ Unexpected response:', message, data);
        setError(message);
        setTasks([]);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('⏱️ Request timeout - server took too long to respond');
        setError('Request timeout. Please try again.');
      } else {
        console.error('❌ Error fetching assigned tasks:', error);
        setError(`Error: ${error.message}`);
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch once on component mount
    if (hasInitialized) return;
    if (!currentUser?.userId) return;
    
    console.log('🔄 Initial fetch - Component mounted:', currentUser);
    setHasInitialized(true);
    fetchAssignedTasks();
  }, []); // Empty dependency array - run only once

  const filteredTasks = useMemo(() => {
    return selectedStatus === 'all' ? tasks : tasks.filter((t) => t.status === selectedStatus);
  }, [tasks, selectedStatus]);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      const resolution_notes = status === 'resolved' ? (actionDrafts[id]?.text || '') : null;
      
      const res = await fetch(`http://localhost:5000/api/technician/${id}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution_notes })
      });

      const data = await res.json();

      if (data?.success) {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
        setActionDrafts({ ...actionDrafts, [id]: null });
        fetchAssignedTasks();
      } else {
        const message = data?.message || 'Failed to update task';
        setActionErrors({ ...actionErrors, [id]: message });
      }
    } catch (error) {
      setActionErrors({ ...actionErrors, [id]: 'Request failed' });
      console.error('Error updating task:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const startAction = (id, mode) => {
    setActionDrafts({ ...actionDrafts, [id]: { mode, text: '' } });
    setActionErrors({ ...actionErrors, [id]: null });
  };

  const cancelAction = (id) => {
    setActionDrafts({ ...actionDrafts, [id]: null });
    setActionErrors({ ...actionErrors, [id]: null });
  };

  const updateDraft = (id, text) => {
    const draft = actionDrafts[id];
    setActionDrafts({ ...actionDrafts, [id]: { ...draft, text } });
  };

  const confirmAction = (id) => {
    const draft = actionDrafts[id];
    if (!draft.text.trim()) {
      setActionErrors({ ...actionErrors, [id]: 'Resolution notes are required' });
      return;
    }
    updateStatus(id, 'resolved');
  };

  const getStatusLabel = (status) => {
    const labels = {
      assigned: 'Assigned',
      in_progress: 'In Progress',
      delayed: 'Delayed',
      resolved: 'Resolved',
      pending: 'Pending'
    };
    return labels[status] || status;
  };

  return (
    <div className="leave-page">
      <div className="leave-header">
        <h1>Assigned Tasks</h1>
        <p>Manage your assigned maintenance tasks.</p>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Error loading tasks:</strong> {error}
            <br />
            <small style={{ marginTop: '6px', display: 'block' }}>Check console (F12) for more details</small>
          </div>
          <button 
            onClick={() => fetchAssignedTasks()}
            style={{
              padding: '8px 16px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            🔄 Retry
          </button>
        </div>
      )}

      <div className="leave-filters">
        <button 
          className={`filter-btn ${selectedStatus === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('all')}
        >
          All ({tasks.length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'assigned' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('assigned')}
        >
          Assigned ({tasks.filter(t => t.status === 'assigned').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'in_progress' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('in_progress')}
        >
          In Progress ({tasks.filter(t => t.status === 'in_progress').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'delayed' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('delayed')}
        >
          Delayed ({tasks.filter(t => t.status === 'delayed').length})
        </button>
        <button 
          className={`filter-btn ${selectedStatus === 'resolved' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('resolved')}
        >
          Resolved ({tasks.filter(t => t.status === 'resolved').length})
        </button>
      </div>

      {loading ? (
        <div className="leave-empty">
          <div className="leave-empty-card">
            <div style={{ 
              width: '50px', 
              height: '50px', 
              border: '4px solid #e5e7eb', 
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px'
            }}></div>
            <h3>Loading assigned tasks...</h3>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>Fetching your tasks from the server...</p>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="leave-empty">
          <div className="leave-empty-card">
            <div className="leave-empty-icon" aria-hidden="true">📭</div>
            <h3>No tasks found</h3>
            <p>
              {tasks.length === 0 
                ? 'You have no assigned tasks at this time. Check back later!' 
                : 'No tasks match the selected filter.'}
            </p>
            {tasks.length === 0 && (
              <button 
                onClick={() => fetchAssignedTasks()}
                style={{
                  marginTop: '12px',
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                🔄 Refresh Tasks
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="leave-list">
          {filteredTasks.map((task) => {
            const draft = actionDrafts[task.id];
            const error = actionErrors[task.id];
            return (
              <article className="leave-card" key={task.id}>
                <div className="leave-card-top">
                  <div>
                    <div className="leave-name">{task.title}</div>
                    <div className="leave-meta">#{task.id} - {task.category}</div>
                  </div>
                  <div className="leave-tags">
                    <span className={`tag ${task.status}`}>{getStatusLabel(task.status)}</span>
                    <span className={`tag priority-${task.priority?.toLowerCase() || 'medium'}`}>
                      {task.priority || 'Medium'} Priority
                    </span>
                  </div>
                </div>

                <div className="leave-grid">
                  <div>
                    <div className="leave-label">Student</div>
                    <div className="leave-value">{task.student_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="leave-label">Roll Number</div>
                    <div className="leave-value">{task.roll_number || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="leave-label">Room</div>
                    <div className="leave-value">{task.room_number || 'N/A'} - {task.block_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="leave-label">Request Date</div>
                    <div className="leave-value">{task.created_at ? new Date(task.created_at).toLocaleDateString('en-GB') : 'N/A'}</div>
                  </div>
                </div>

                {task.description && (
                  <div className="leave-reason">
                    <div className="leave-label">Description</div>
                    <div className="leave-value">{task.description}</div>
                  </div>
                )}

                {task.location && (
                  <div className="leave-reason">
                    <div className="leave-label">Location</div>
                    <div className="leave-value">{task.location}</div>
                  </div>
                )}

                {task.resolution_notes && (
                  <div className="leave-reason">
                    <div className="leave-label">Resolution Notes</div>
                    <div className="leave-value">{task.resolution_notes}</div>
                  </div>
                )}

                {error && <div className="leave-error">{error}</div>}

                <div className="leave-actions">
                  {(task.status === 'assigned' || task.status === 'delayed') && (
                    <button
                      className="action-btn approve"
                      onClick={() => startAction(task.id, 'start')}
                      disabled={updatingId === task.id}
                    >
                      ▶️ Start Working
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <button
                      className="action-btn"
                      onClick={() => startAction(task.id, 'resolve')}
                      disabled={updatingId === task.id}
                    >
                      ✅ Mark as Resolved
                    </button>
                  )}
                </div>

                {draft && draft.mode === 'start' && (task.status === 'assigned' || task.status === 'delayed') && (
                  <>
                    <button
                      className="action-btn primary"
                      onClick={() => updateStatus(task.id, 'in_progress')}
                      disabled={updatingId === task.id}
                    >
                      {updatingId === task.id ? 'Updating...' : 'Confirm Start'}
                    </button>
                    <button
                      className="action-btn ghost"
                      onClick={() => cancelAction(task.id)}
                    >
                      Cancel
                    </button>
                  </>
                )}

                {draft && draft.mode === 'resolve' && task.status === 'in_progress' && (
                  <div className="leave-action-panel">
                    <textarea
                      placeholder="Enter resolution notes..."
                      value={draft.text}
                      onChange={(e) => updateDraft(task.id, e.target.value)}
                      style={{ minHeight: '80px' }}
                    ></textarea>
                    <div className="leave-action-buttons">
                      <button
                        className="action-btn ghost"
                        onClick={() => cancelAction(task.id)}
                      >
                        Cancel
                      </button>
                      <button
                        className="action-btn primary"
                        onClick={() => confirmAction(task.id)}
                        disabled={updatingId === task.id || !draft.text.trim()}
                      >
                        {updatingId === task.id ? 'Resolving...' : 'Resolve Task'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TechnicianAssignedTasks;



