import React, { useEffect, useState } from 'react';
import '../../styles/academic-settings.css';

const AcademicSettings = () => {
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCollege, setNewCollege] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [editingCollege, setEditingCollege] = useState(null);
  const [editingBranch, setEditingBranch] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    type: null,
    id: null,
    name: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [collegesRes, branchesRes] = await Promise.all([
        fetch('http://localhost:5000/api/settings/colleges?includeInactive=true'),
        fetch('http://localhost:5000/api/settings/branches?includeInactive=true')
      ]);
      const [collegesData, branchesData] = await Promise.all([
        collegesRes.json(),
        branchesRes.json()
      ]);

      if (collegesData.success) setColleges(collegesData.data || []);
      if (branchesData.success) setBranches(branchesData.data || []);
    } catch (error) {
      console.error('Error fetching academic settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCollege = async () => {
    const name = newCollege.trim();
    if (!name) return;
    try {
      const res = await fetch('http://localhost:5000/api/settings/colleges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        setNewCollege('');
        fetchSettings();
      } else {
        alert(data.message || 'Failed to add college');
      }
    } catch (error) {
      console.error('Error adding college:', error);
    }
  };

  const addBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    try {
      const res = await fetch('http://localhost:5000/api/settings/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        setNewBranch('');
        fetchSettings();
      } else {
        alert(data.message || 'Failed to add branch');
      }
    } catch (error) {
      console.error('Error adding branch:', error);
    }
  };

  const startEditCollege = (college) => {
    setEditingCollege({ id: college.id, name: college.name, status: college.status });
  };

  const startEditBranch = (branch) => {
    setEditingBranch({ id: branch.id, name: branch.name, status: branch.status });
  };

  const saveCollege = async () => {
    if (!editingCollege) return;
    try {
      const res = await fetch(`http://localhost:5000/api/settings/colleges/${editingCollege.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCollege.name, status: editingCollege.status })
      });
      const data = await res.json();
      if (data.success) {
        setEditingCollege(null);
        fetchSettings();
      } else {
        alert(data.message || 'Failed to update college');
      }
    } catch (error) {
      console.error('Error updating college:', error);
    }
  };

  const saveBranch = async () => {
    if (!editingBranch) return;
    try {
      const res = await fetch(`http://localhost:5000/api/settings/branches/${editingBranch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingBranch.name, status: editingBranch.status })
      });
      const data = await res.json();
      if (data.success) {
        setEditingBranch(null);
        fetchSettings();
      } else {
        alert(data.message || 'Failed to update branch');
      }
    } catch (error) {
      console.error('Error updating branch:', error);
    }
  };

  const deleteCollege = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/settings/colleges/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm({ open: false, type: null, id: null, name: '' });
        fetchSettings();
      } else {
        alert(data.message || 'Failed to delete college');
      }
    } catch (error) {
      console.error('Error deleting college:', error);
    }
  };

  const deleteBranch = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/settings/branches/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm({ open: false, type: null, id: null, name: '' });
        fetchSettings();
      } else {
        alert(data.message || 'Failed to delete branch');
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
    }
  };

  const requestDeleteCollege = (college) => {
    setDeleteConfirm({
      open: true,
      type: 'college',
      id: college.id,
      name: college.name
    });
  };

  const requestDeleteBranch = (branch) => {
    setDeleteConfirm({
      open: true,
      type: 'branch',
      id: branch.id,
      name: branch.name
    });
  };

  const confirmDelete = () => {
    if (!deleteConfirm.id || !deleteConfirm.type) return;
    if (deleteConfirm.type === 'college') {
      deleteCollege(deleteConfirm.id);
      return;
    }
    deleteBranch(deleteConfirm.id);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, type: null, id: null, name: '' });
  };

  if (loading) {
    return (
      <div className="academic-settings-page">
        <p>Loading academic settings...</p>
      </div>
    );
  }

  return (
    <div className="academic-settings-page">
      <div className="academic-header page-header-card">
        <div className="page-header-text">
          <h1>Academic Settings</h1>
          <p>Manage colleges and branches used in student registration and profiles.</p>
        </div>
      </div>

      <div className="academic-grid">
        <section className="academic-card">
          <div className="card-header">
            <h2>Colleges</h2>
            <span className="count-badge">{colleges.length}</span>
          </div>

          <div className="add-row">
            <input
              type="text"
              placeholder="Add college name"
              value={newCollege}
              onChange={(e) => setNewCollege(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCollege()}
            />
            <button onClick={addCollege} disabled={!newCollege.trim()}>Add</button>
          </div>

          <div className="list">
            {colleges.length === 0 ? (
              <div className="empty">No colleges yet</div>
            ) : (
              colleges.map((college) => (
                <div
                  key={college.id}
                  className={`list-row ${editingCollege && editingCollege.id === college.id ? 'editing' : ''}`}
                >
                  {editingCollege && editingCollege.id === college.id ? (
                    <>
                      <input
                        type="text"
                        value={editingCollege.name}
                        onChange={(e) => setEditingCollege({ ...editingCollege, name: e.target.value })}
                      />
                      <select
                        value={editingCollege.status}
                        onChange={(e) => setEditingCollege({ ...editingCollege, status: e.target.value })}
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                      <div className="row-actions">
                        <button className="primary" onClick={saveCollege}>Save</button>
                        <button onClick={() => setEditingCollege(null)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="row-title">{college.name}</div>
                      <span className={`status ${college.status}`}>{college.status}</span>
                      <div className="row-actions">
                        <button onClick={() => startEditCollege(college)}>Edit</button>
                        <button className="danger" onClick={() => requestDeleteCollege(college)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="academic-card">
          <div className="card-header">
            <h2>Branches</h2>
            <span className="count-badge">{branches.length}</span>
          </div>

          <div className="add-row">
            <input
              type="text"
              placeholder="Add branch name"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBranch()}
            />
            <button onClick={addBranch} disabled={!newBranch.trim()}>Add</button>
          </div>

          <div className="list">
            {branches.length === 0 ? (
              <div className="empty">No branches yet</div>
            ) : (
              branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`list-row ${editingBranch && editingBranch.id === branch.id ? 'editing' : ''}`}
                >
                  {editingBranch && editingBranch.id === branch.id ? (
                    <>
                      <input
                        type="text"
                        value={editingBranch.name}
                        onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                      />
                      <select
                        value={editingBranch.status}
                        onChange={(e) => setEditingBranch({ ...editingBranch, status: e.target.value })}
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                      <div className="row-actions">
                        <button className="primary" onClick={saveBranch}>Save</button>
                        <button onClick={() => setEditingBranch(null)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="row-title">{branch.name}</div>
                      <span className={`status ${branch.status}`}>{branch.status}</span>
                      <div className="row-actions">
                        <button onClick={() => startEditBranch(branch)}>Edit</button>
                        <button className="danger" onClick={() => requestDeleteBranch(branch)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {deleteConfirm.open && (
        <div className="academic-confirm-overlay" onClick={closeDeleteConfirm}>
          <div className="academic-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="academic-confirm-header">
              <h3>Confirm Delete</h3>
              <button type="button" className="academic-confirm-close" onClick={closeDeleteConfirm}>×</button>
            </div>
            <div className="academic-confirm-body">
              <p>
                Delete this {deleteConfirm.type} <strong>{deleteConfirm.name}</strong>?
              </p>
              <p className="academic-confirm-subtext">This action cannot be undone.</p>
            </div>
            <div className="academic-confirm-actions">
              <button type="button" onClick={closeDeleteConfirm}>Cancel</button>
              <button type="button" className="danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicSettings;

