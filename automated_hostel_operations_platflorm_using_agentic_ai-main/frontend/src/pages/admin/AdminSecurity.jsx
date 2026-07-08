import { useEffect, useMemo, useState } from 'react';
import { getAuthHeaders } from '../../utils/auth';
import '../../styles/warden-technicians.css';

const AdminSecurity = () => {
  const [securityStaff, setSecurityStaff] = useState([]);
  const [hostelBlocks, setHostelBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [selectedStaff, setSelectedStaff] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });
  const [deletingId, setDeletingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gate: '',
    shift: '',
    status: 'active'
  });

  useEffect(() => {
    fetchSecurityStaff();
    fetchHostelBlocks();
  }, []);

  const fetchHostelBlocks = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/hostel-blocks', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok && data?.success && Array.isArray(data.data)) {
        setHostelBlocks(data.data);
      }
    } catch {
      // Non-blocking for this screen.
    }
  };

  const fetchSecurityStaff = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/admin/users?role=security', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const normalized = data.data.map((staff) => {
          const statusKey = (staff.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
          const staffId = staff.security_employee_id || staff.employee_id || staff.staff_id || '';
          return {
            id: staff.id,
            name: staff.name || 'N/A',
            email: staff.email || 'N/A',
            staff_id: staffId || 'N/A',
            phone: staff.security_phone || staff.phone || 'N/A',
            gate: staff.gate_assigned || staff.gate || 'N/A',
            shift: staff.shift_timing || staff.shift || 'N/A',
            statusKey,
            status: statusKey === 'active' ? 'Active' : 'Inactive'
          };
        });
        setSecurityStaff(normalized);
      } else {
        setError(data?.message || 'Failed to load security staff');
      }
    } catch (err) {
      setError(`Failed to load security staff: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      gate: '',
      shift: '',
      status: 'active'
    });
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedStaff(null);
    resetForm();
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (staff) => {
    setModalMode('edit');
    setSelectedStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: '',
      phone: staff.phone === 'N/A' ? '' : staff.phone,
      gate: staff.gate === 'N/A' ? '' : staff.gate,
      shift: staff.shift === 'N/A' ? '' : staff.shift,
      status: staff.statusKey
    });
    setFormError('');
    setShowModal(true);
  };

  const openViewModal = (staff) => {
    setModalMode('view');
    setSelectedStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: '',
      phone: staff.phone === 'N/A' ? '' : staff.phone,
      gate: staff.gate === 'N/A' ? '' : staff.gate,
      shift: staff.shift === 'N/A' ? '' : staff.shift,
      status: staff.statusKey
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedStaff(null);
    setFormError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const isAdd = modalMode === 'add';
      const url = isAdd
        ? 'http://localhost:5000/api/admin/user'
        : `http://localhost:5000/api/admin/user/${selectedStaff.id}`;
      const method = isAdd ? 'POST' : 'PUT';

      const payload = isAdd
        ? {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: 'security',
            phone: formData.phone,
            gate: formData.gate,
            shift: formData.shift
          }
        : {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            gate: formData.gate,
            shift: formData.shift
          };

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`HTTP ${response.status}: Invalid server response`);
      }

      if (!response.ok || !data?.success) {
        setFormError(data?.message || `Operation failed (HTTP ${response.status})`);
        return;
      }

      const targetStatus = formData.status;
      const currentStatus = isAdd ? 'active' : selectedStaff.statusKey;

      if (targetStatus !== currentStatus) {
        await fetch(`http://localhost:5000/api/admin/user/${isAdd ? data.id : selectedStaff.id}/status`, {
          method: 'PUT',
          headers: getAuthHeaders(true),
          body: JSON.stringify({ status: targetStatus })
        });
      }

      await fetchSecurityStaff();
      closeModal();
    } catch (err) {
      setFormError('Request failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openPasswordModal = (staff) => {
    setSelectedStaff(staff);
    setPasswordError('');
    setPasswordFormData({ password: '', confirmPassword: '' });
    setShowPasswordConfirm(false);
    setShowPasswordModal(true);
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordFormData((prev) => ({ ...prev, [name]: value }));
    if (passwordError) {
      setPasswordError('');
    }
  };

  const requestPasswordChange = () => {
    if (!passwordFormData.password || !passwordFormData.confirmPassword) {
      setPasswordError('Please enter password in both fields');
      return;
    }
    if (passwordFormData.password !== passwordFormData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (passwordFormData.password.length < 4) {
      setPasswordError('Password must be at least 4 characters long');
      return;
    }
    setShowPasswordConfirm(true);
  };

  const handlePasswordChange = async () => {
    if (!selectedStaff) return;

    setSubmitting(true);
    setPasswordError('');

    try {
      const response = await fetch(`http://localhost:5000/api/admin/user/${selectedStaff.id}/password`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ password: passwordFormData.password })
      });

      const data = await response.json();
      if (response.ok && data?.success) {
        setShowPasswordConfirm(false);
        setShowPasswordModal(false);
        setSelectedStaff(null);
        setPasswordFormData({ password: '', confirmPassword: '' });
      } else {
        setPasswordError(data?.message || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError(err?.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteConfirm = (staff) => {
    setDeleteConfirm({ open: true, id: staff.id, name: staff.name || 'this staff member' });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, id: null, name: '' });
  };

  const handleDelete = async (staffId) => {
    setDeletingId(staffId);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/user/${staffId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (data.success) {
        await fetchSecurityStaff();
        closeDeleteConfirm();
      } else {
        setError('Failed to delete staff: ' + data.message);
      }
    } catch (err) {
      setError('Request failed: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusToggle = async (staff) => {
    const newStatus = staff.statusKey === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`http://localhost:5000/api/admin/user/${staff.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (data.success) {
        await fetchSecurityStaff();
      } else {
        setError('Failed to update status: ' + data.message);
      }
    } catch (err) {
      setError('Request failed: ' + err.message);
    }
  };

  const shifts = useMemo(() => {
    const unique = Array.from(new Set(securityStaff.map((staff) => staff.shift).filter((v) => v && v !== 'N/A')));
    return ['All', ...unique];
  }, [securityStaff]);

  const filteredSecurityStaff = securityStaff.filter((staff) => {
    const query = searchTerm.toLowerCase();
    const searchMatch =
      staff.name.toLowerCase().includes(query) ||
      staff.email.toLowerCase().includes(query) ||
      String(staff.staff_id).toLowerCase().includes(query) ||
      staff.phone.toLowerCase().includes(query);

    const shiftMatch = shiftFilter === 'All' || staff.shift === shiftFilter;
    const statusMatch = statusFilter === 'All' || staff.status === statusFilter;

    return searchMatch && shiftMatch && statusMatch;
  });

  const isViewMode = modalMode === 'view';

  if (loading) {
    return (
      <div className="technicians-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading security staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="technicians-page admin-security-page">
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Admin Security Staff</h2>
          <p>Manage hostel security personnel</p>
        </div>
        <button className="add-btn page-header-action" onClick={openAddModal}>
          Add Security Staff
        </button>
      </div>

      {error && (
        <div className="error-alert">
          <p>{error}</p>
        </div>
      )}

      <div className="search-filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, staff ID, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="role-filter">
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="filter-select"
          >
            {shifts.map((shift) => (
              <option key={shift} value={shift}>{shift === 'All' ? 'All Shifts' : shift}</option>
            ))}
          </select>
        </div>

        <div className="role-filter">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {filteredSecurityStaff.length > 0 ? (
        <div>
          <div className="technicians-table-container technicians-desktop-table">
            <table className="technicians-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name</th>
                  <th>Gate/Area</th>
                  <th>Shift</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSecurityStaff.map((staff) => (
                  <tr key={staff.id}>
                    <td className="staff-id-cell" data-label="Staff ID">
                      <span className="staff-id-badge">{staff.staff_id}</span>
                    </td>
                    <td className="cell-name" data-label="Name">
                      <div className="name-cell">
                        <div className="avatar">{staff.name.charAt(0)}</div>
                        <span className="name">{staff.name}</span>
                      </div>
                    </td>
                    <td data-label="Gate/Area">
                      <span className="role-badge security-gate-badge">{staff.gate}</span>
                    </td>
                    <td data-label="Shift">
                      <span className="complaint-badge security-shift-badge">{staff.shift}</span>
                    </td>
                    <td data-label="Phone">{staff.phone}</td>
                    <td className="email-cell" data-label="Email">{staff.email}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${staff.status.toLowerCase()}`}>{staff.status}</span>
                    </td>
                    <td className="actions-cell" data-label="Actions">
                      <button className="btn-action btn-view" onClick={() => openViewModal(staff)} title="View details">{'\u{1F441}\uFE0F'}</button>
                      <button className="btn-action btn-edit" onClick={() => openEditModal(staff)} title="Edit staff">{'\u{1F58A}\uFE0F'}</button>
                      <button className="btn-action btn-password" onClick={() => openPasswordModal(staff)} title="Change Password">{'\u{1F512}'}</button>
                      <button
                        className="btn-action btn-status"
                        onClick={() => handleStatusToggle(staff)}
                        title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}
                      >
                        {staff.status === 'Active' ? '\u{1F534}' : '\u{1F7E2}'}
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => openDeleteConfirm(staff)}
                        title="Delete staff"
                        disabled={deletingId === staff.id}
                      >
                        {deletingId === staff.id ? '...' : '\u{1F5D1}\uFE0F'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="technicians-card-grid technicians-mobile-cards">
            {filteredSecurityStaff.map((staff) => (
              <article key={staff.id} className="technician-card">
                <div className="technician-card-header">
                  <div className="name-cell">
                    <div className="avatar">{staff.name.charAt(0)}</div>
                    <div className="tech-name-stack">
                      <span className="name">{staff.name}</span>
                      <div className="tech-id-status-row">
                        <span className="staff-id-badge">{staff.staff_id}</span>
                        <span className={`status-badge ${staff.status.toLowerCase()}`}>{staff.status}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="technician-card-details">
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Gate/Area</span>
                    <span className="role-badge security-gate-badge">{staff.gate}</span>
                  </div>
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Shift</span>
                    <span className="complaint-badge security-shift-badge">{staff.shift}</span>
                  </div>
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Phone</span>
                    <span>{staff.phone}</span>
                  </div>
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Email</span>
                    <span className="email-cell security-email-value">{staff.email}</span>
                  </div>
                </div>

                <div className="actions-cell tech-card-actions">
                  <button className="tech-action-btn tech-action-view" onClick={() => openViewModal(staff)} title="View details">{'\u{1F441}\uFE0F'}</button>
                  <button className="tech-action-btn tech-action-edit" onClick={() => openEditModal(staff)} title="Edit staff">{'\u{1F58A}\uFE0F'}</button>
                  <button className="tech-action-btn tech-action-password" onClick={() => openPasswordModal(staff)} title="Change Password">{'\u{1F512}'}</button>
                  <button
                    className="tech-action-btn tech-action-toggle"
                    onClick={() => handleStatusToggle(staff)}
                    title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}
                  >
                    {staff.status === 'Active' ? '\u{1F534}' : '\u{1F7E2}'}
                  </button>
                  <button
                    className="tech-action-btn tech-action-delete"
                    onClick={() => openDeleteConfirm(staff)}
                    title="Delete staff"
                    disabled={deletingId === staff.id}
                  >
                    {deletingId === staff.id ? '...' : '\u{1F5D1}\uFE0F'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">SEC</div>
          <h3>No security staff found</h3>
          <p>{searchTerm || shiftFilter !== 'All' || statusFilter !== 'All' ? 'No staff match your search or filters.' : 'No security staff available. Add one to get started.'}</p>
          <button className="add-btn" onClick={openAddModal}>Add First Security Staff</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay technician-modal-overlay" onClick={closeModal}>
          <div
            className={`modal-content technician-modal ${isViewMode ? 'view-mode' : ''} ${modalMode !== 'add' ? 'corner-close-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{modalMode === 'add' ? 'Add Security Staff' : modalMode === 'edit' ? 'Edit Security Staff' : 'Security Staff Details'}</h2>
              <button className="modal-close close-btn" onClick={closeModal}>x</button>
            </div>

            {isViewMode ? (
              <>
                <div className="modal-body">
                  <div className="tech-view-grid">
                    <div className="tech-view-item"><div className="tech-view-label">Name</div><div className="tech-view-value">{formData.name || 'N/A'}</div></div>
                    <div className="tech-view-item"><div className="tech-view-label">Email</div><div className="tech-view-value">{formData.email || 'N/A'}</div></div>
                    <div className="tech-view-item"><div className="tech-view-label">Staff ID</div><div className="tech-view-value">{selectedStaff?.staff_id || 'N/A'}</div></div>
                    <div className="tech-view-item"><div className="tech-view-label">Phone</div><div className="tech-view-value">{formData.phone || 'N/A'}</div></div>
                    <div className="tech-view-item"><div className="tech-view-label">Gate/Area</div><div className="tech-view-value">{formData.gate || 'N/A'}</div></div>
                    <div className="tech-view-item"><div className="tech-view-label">Shift</div><div className="tech-view-value">{formData.shift || 'N/A'}</div></div>
                    <div className="tech-view-item"><div className="tech-view-label">Status</div><div className="tech-view-value">{formData.status === 'active' ? 'Active' : 'Inactive'}</div></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={closeModal}>Close</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="modal-body">
                {formError && <div className="form-error">{formError}</div>}

                <div className="form-grid">
                  <div className="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                  </div>

                  {modalMode === 'add' && (
                    <div className="form-group">
                      <label>Password *</label>
                      <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required />
                  </div>

                  <div className="form-group">
                    <label>Gate/Area *</label>
                    <select name="gate" value={formData.gate} onChange={handleInputChange} required>
                      <option value="">Select Gate/Area</option>
                      {hostelBlocks.map((block) => (
                        <option key={block.id} value={block.block_name}>{block.block_name}</option>
                      ))}
                      <option value="Main Gate">Main Gate</option>
                      <option value="Hostel Perimeter">Hostel Perimeter</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Shift *</label>
                    <select name="shift" value={formData.shift} onChange={handleInputChange} required>
                      <option value="">Select Shift</option>
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting && <span className="btn-spinner" />}
                    {submitting ? 'Saving...' : (modalMode === 'add' ? 'Add Security Staff' : 'Save Changes')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {deleteConfirm.open && (
        <div className="modal-overlay technician-modal-overlay" onClick={closeDeleteConfirm}>
          <div className="modal-content technician-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Security Staff</h2>
              <button className="modal-close close-btn" onClick={closeDeleteConfirm}>x</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeDeleteConfirm} disabled={deletingId === deleteConfirm.id}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={deletingId === deleteConfirm.id}
              >
                {deletingId === deleteConfirm.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && selectedStaff && (
        <div className="modal-overlay technician-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content technician-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Change Password</h2>
              <button className="modal-close close-btn" onClick={() => setShowPasswordModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0, marginBottom: '12px', color: '#334155' }}>
                Changing password for <strong>{selectedStaff.name}</strong>
              </p>
              {passwordError && <div className="form-error">{passwordError}</div>}

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="password"
                  value={passwordFormData.password}
                  onChange={handlePasswordFormChange}
                  placeholder="Enter new password"
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordFormData.confirmPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Re-enter password"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowPasswordModal(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="btn-primary" onClick={requestPasswordChange} disabled={submitting}>
                {submitting ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordConfirm && selectedStaff && (
        <div className="modal-overlay technician-modal-overlay" onClick={() => setShowPasswordConfirm(false)}>
          <div className="modal-content technician-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Password Change</h2>
              <button className="modal-close close-btn" onClick={() => setShowPasswordConfirm(false)}>x</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
                Change password for <strong>{selectedStaff.name}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowPasswordConfirm(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handlePasswordChange} disabled={submitting}>
                {submitting ? 'Changing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSecurity;
