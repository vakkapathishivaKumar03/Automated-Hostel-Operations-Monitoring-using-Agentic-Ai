import React, { useMemo, useState } from 'react';

const initialRequests = [
  { id: 1, name: 'Aisha Khan', roll: 'CS2019', reason: 'Medical', date: '2026-02-05', status: 'pending' },
  { id: 2, name: 'Rahul Mehta', roll: 'EE2020', reason: 'Family', date: '2026-02-04', status: 'approved' },
  { id: 3, name: 'Sita Sharma', roll: 'ME2021', reason: 'Funeral', date: '2026-02-06', status: 'pending' },
];

const Outpass = () => {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const visible = useMemo(() => {
    return requests.filter((r) => {
      if (filter !== 'All' && r.status !== filter.toLowerCase()) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.roll.toLowerCase().includes(q);
    });
  }, [requests, filter, query]);

  const updateStatus = (id, status) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <div>
      <h1>Outpass Approvals</h1>
      <p>Manage student outpass requests.</p>

      <div className="outpass-controls" style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0' }}>
        <div style={{ fontWeight: 700 }}>{pendingCount} pending</div>
        <input placeholder="Search name or roll" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          <option>pending</option>
          <option>approved</option>
          <option>rejected</option>
        </select>
      </div>

      <div className="outpass-table">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Roll</th>
              <th>Reason</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.roll}</td>
                <td>{r.reason}</td>
                <td>{r.date}</td>
                <td>
                  <span className={`tag ${r.status}`}>{r.status}</span>
                </td>
                <td>
                  <button onClick={() => updateStatus(r.id, 'approved')} disabled={r.status !== 'pending'}>Approve</button>
                  <button onClick={() => updateStatus(r.id, 'rejected')} disabled={r.status !== 'pending'} style={{ marginLeft: 8 }}>Reject</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                  No requests match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Outpass;
