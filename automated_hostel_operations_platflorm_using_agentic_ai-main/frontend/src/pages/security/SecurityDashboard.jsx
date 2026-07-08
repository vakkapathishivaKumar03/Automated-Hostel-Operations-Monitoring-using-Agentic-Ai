import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/security-dashboard.css';

const API_BASE = 'http://localhost:5000';

const isValidDate = (value) => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const formatDateTime = (value) => {
  if (!isValidDate(value)) {
    return 'Not available';
  }

  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const formatRelativeTime = (value) => {
  if (!isValidDate(value)) {
    return 'No recent update';
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60000));

  if (deltaMinutes < 60) {
    return `${deltaMinutes} min ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} hr ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays} day${deltaDays > 1 ? 's' : ''} ago`;
};

const normalizeStatus = (status) => {
  if (!status) {
    return 'inside';
  }

  return status.toLowerCase().trim();
};

const getVisitorTone = (status) => {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 'overstayed') {
    return 'alert';
  }

  if (normalizedStatus === 'exited') {
    return 'muted';
  }

  return 'live';
};

const getLogTone = (log) => {
  const descriptor = `${log.action || ''} ${log.details || ''}`.toLowerCase();

  if (descriptor.includes('overstay') || descriptor.includes('alert') || descriptor.includes('late')) {
    return 'alert';
  }

  if (descriptor.includes('checkout') || descriptor.includes('exit')) {
    return 'cool';
  }

  return 'live';
};

const SecurityDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [visitors, setVisitors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const fetchDashboardData = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const [visitorRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/api/security/visitors/active`),
        fetch(`${API_BASE}/api/security/logs`)
      ]);

      const [visitorData, logData] = await Promise.all([visitorRes.json(), logRes.json()]);

      setVisitors(visitorData.success && Array.isArray(visitorData.data) ? visitorData.data : []);
      setLogs(logData.success && Array.isArray(logData.data) ? logData.data : []);
      setLastUpdated(new Date().toISOString());
    } catch (fetchError) {
      console.error('Error fetching security data:', fetchError);
      setError('Unable to load live security activity right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCheckout = async (visitorId) => {
    setCheckingOutId(visitorId);
    try {
      const response = await fetch(`${API_BASE}/api/security/visitor/${visitorId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        await fetchDashboardData({ silent: true });
      } else {
        setError(data.message || 'Unable to complete checkout.');
      }
    } catch (checkoutError) {
      console.error('Error checking out visitor:', checkoutError);
      setError('Unable to complete checkout right now.');
    } finally {
      setCheckingOutId(null);
    }
  };

  const sortedLogs = useMemo(() => {
    return [...logs].sort((left, right) => {
      const leftValue = isValidDate(left.timestamp) ? new Date(left.timestamp).getTime() : 0;
      const rightValue = isValidDate(right.timestamp) ? new Date(right.timestamp).getTime() : 0;
      return rightValue - leftValue;
    });
  }, [logs]);

  const filteredVisitors = useMemo(() => {
    if (!searchQuery.trim()) {
      return visitors;
    }

    const query = searchQuery.toLowerCase();

    return visitors.filter((visitor) =>
      [
        visitor.visitor_name,
        visitor.id_number,
        visitor.student_name,
        visitor.phone,
        visitor.purpose,
        visitor.room_number
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [searchQuery, visitors]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedLogs;
    }

    const query = searchQuery.toLowerCase();
    return sortedLogs.filter((log) =>
      [log.action, log.details, log.timestamp]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [searchQuery, sortedLogs]);

  const insideCount = visitors.filter((visitor) => normalizeStatus(visitor.status) === 'inside').length;
  const overdueCount = visitors.filter((visitor) => normalizeStatus(visitor.status) === 'overstayed').length;
  const recordsToday = sortedLogs.filter((log) => {
    if (!isValidDate(log.timestamp)) {
      return false;
    }

    const logDate = new Date(log.timestamp);
    const now = new Date();

    return logDate.toDateString() === now.toDateString();
  }).length;
  const uniqueHosts = new Set(visitors.map((visitor) => visitor.student_name).filter(Boolean)).size;
  const latestLog = sortedLogs[0];
  const recentEntry = [...visitors]
    .filter((visitor) => isValidDate(visitor.entry_time))
    .sort((left, right) => new Date(right.entry_time).getTime() - new Date(left.entry_time).getTime())[0];

  const renderEmptyState = (title, description) => (
    <div className="secdash-empty">
      <div className="secdash-empty-mark">0</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );

  return (
    <div className="secdash-page">
      <div className="secdash-shell">
        <section className="secdash-hero">
          <div className="secdash-hero-copy">
            <span className="secdash-eyebrow">Security operations</span>
            <h1>Security Dashboard</h1>
            <p>
              Monitor live visitor presence, recent gate activity, and operational handoffs from one place.
            </p>
          </div>

          <div className="secdash-hero-side">
            <div className="secdash-hero-stat">
              <span className="secdash-hero-label">Last sync</span>
              <strong>{lastUpdated ? formatRelativeTime(lastUpdated) : 'Waiting for sync'}</strong>
              <span>{lastUpdated ? formatDateTime(lastUpdated) : 'Connect to the backend to load activity.'}</span>
            </div>

            <button
              type="button"
              className="secdash-refresh-btn"
              onClick={() => fetchDashboardData({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh data'}
            </button>
          </div>
        </section>

        {error && <div className="secdash-alert">{error}</div>}

        <section className="secdash-metrics">
          <article className="secdash-metric secdash-metric-live">
            <span className="secdash-metric-label">Active visitors</span>
            <strong>{insideCount}</strong>
            <p>Currently checked into the hostel.</p>
          </article>

          <article className="secdash-metric secdash-metric-cool">
            <span className="secdash-metric-label">Records today</span>
            <strong>{recordsToday}</strong>
            <p>Gate events captured today.</p>
          </article>

          <article className="secdash-metric secdash-metric-alert">
            <span className="secdash-metric-label">Needs attention</span>
            <strong>{overdueCount}</strong>
            <p>Visitors flagged for delayed exit.</p>
          </article>

          <article className="secdash-metric secdash-metric-neutral">
            <span className="secdash-metric-label">Unique hosts</span>
            <strong>{uniqueHosts}</strong>
            <p>Students currently associated with visits.</p>
          </article>
        </section>

        <section className="secdash-workspace">
          <section className="secdash-panel secdash-panel-primary">
            <div className="secdash-panel-head secdash-panel-head-stack">
              <div>
                <h2>Active Visitors</h2>
                <p>Search by visitor, host, ID, phone, room, or purpose.</p>
              </div>

              <label className="secdash-search">
                <span>Search active roster</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search visitors or logs"
                />
              </label>
            </div>

            {loading ? (
              <div className="secdash-card-grid">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="secdash-skeleton-card" />
                ))}
              </div>
            ) : filteredVisitors.length > 0 ? (
              <div className="secdash-card-grid">
                {filteredVisitors.map((visitor) => {
                  const visitorStatus = normalizeStatus(visitor.status);
                  const showCheckout = visitorStatus === 'inside';

                  return (
                    <article key={visitor.id} className="secdash-visitor-card">
                      <div className="secdash-card-top">
                        <div>
                          <h3>{visitor.visitor_name || 'Unknown visitor'}</h3>
                          <p>
                            {visitor.id_type || 'ID'}
                            {' · '}
                            {visitor.id_number || 'Not recorded'}
                          </p>
                        </div>

                        <span className={`secdash-status-pill secdash-status-${getVisitorTone(visitor.status)}`}>
                          {visitorStatus.replace(/-/g, ' ')}
                        </span>
                      </div>

                      <dl className="secdash-visitor-details">
                        <div>
                          <dt>Host student</dt>
                          <dd>{visitor.student_name || 'Not assigned'}</dd>
                        </div>
                        <div>
                          <dt>Contact</dt>
                          <dd>{visitor.phone || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Purpose</dt>
                          <dd>{visitor.purpose || 'General visit'}</dd>
                        </div>
                        <div>
                          <dt>Entry time</dt>
                          <dd>{formatDateTime(visitor.entry_time)}</dd>
                        </div>
                      </dl>

                      <div className="secdash-card-actions">
                        <span className="secdash-footnote">{formatRelativeTime(visitor.entry_time)}</span>

                        {showCheckout && (
                          <button
                            type="button"
                            className="secdash-action-btn"
                            onClick={() => handleCheckout(visitor.id)}
                            disabled={checkingOutId === visitor.id}
                          >
                            {checkingOutId === visitor.id ? 'Checking out...' : 'Complete checkout'}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              renderEmptyState('No visitors in the roster', 'Active entries will appear here as soon as the gate register receives them.')
            )}
          </section>

          <aside className="secdash-rail">
            <section className="secdash-panel">
              <div className="secdash-panel-head">
                <div>
                  <h2>Recent Security Logs</h2>
                  <p>Latest recorded events from the security desk.</p>
                </div>
                <span className="secdash-inline-count">{filteredLogs.length}</span>
              </div>

              {loading ? (
                <div className="secdash-log-skeletons">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="secdash-log-skeleton" />
                  ))}
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="secdash-log-list">
                  {filteredLogs.slice(0, 8).map((log, index) => (
                    <article key={`${log.timestamp || 'log'}-${index}`} className="secdash-log-item">
                      <span className={`secdash-log-dot secdash-log-${getLogTone(log)}`} />
                      <div className="secdash-log-copy">
                        <h3>{log.action || 'Security log'}</h3>
                        <p>{log.details || 'No additional context available for this event.'}</p>
                        <span>{formatDateTime(log.timestamp)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                renderEmptyState('No recent logs', 'New entries from the gate and desk actions will be listed here.')
              )}
            </section>

            <section className="secdash-panel">
              <div className="secdash-panel-head">
                <div>
                  <h2>Operational Snapshot</h2>
                  <p>Quick reference for the current shift.</p>
                </div>
              </div>

              <div className="secdash-snapshot-list">
                <div className="secdash-snapshot-item">
                  <span>Latest activity</span>
                  <strong>{latestLog ? formatRelativeTime(latestLog.timestamp) : 'No activity recorded'}</strong>
                  <p>{latestLog ? latestLog.action || 'Security log' : 'Awaiting the first event of the shift.'}</p>
                </div>

                <div className="secdash-snapshot-item">
                  <span>Most recent visitor entry</span>
                  <strong>{recentEntry ? recentEntry.visitor_name || 'Unnamed visitor' : 'No live visitors'}</strong>
                  <p>{recentEntry ? formatDateTime(recentEntry.entry_time) : 'No active check-ins right now.'}</p>
                </div>

                <div className="secdash-snapshot-item">
                  <span>Tracked hosts</span>
                  <strong>{uniqueHosts}</strong>
                  <p>Distinct students currently linked to visits.</p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default SecurityDashboard;

