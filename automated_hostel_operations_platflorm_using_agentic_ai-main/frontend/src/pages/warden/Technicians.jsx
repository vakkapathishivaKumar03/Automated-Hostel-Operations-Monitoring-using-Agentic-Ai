import { useEffect, useMemo, useState } from 'react';
import { getAuthHeaders } from '../../utils/auth';
import '../../styles/warden-technicians.css';

const Technicians = () => {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit' | 'view'
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    staff_id: '',
    specialization: '',
    phone: '',
    availability_status: 'available'
  });
  const [formError, setFormError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/warden/technicians', {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        const normalized = data.data.map((tech) => {
          const availability = (tech.availability_status || '').toLowerCase();
          const isActive = availability === 'available' || availability === 'busy';
          return {
            id: tech.id,
            name: tech.name || 'N/A',
            staff_id: tech.staff_id || 'N/A',
            role: tech.specialization || 'General',
            phone: tech.phone || 'N/A',
            email: tech.email || 'N/A',
            assignedComplaints: tech.assigned_complaints || 0,
            status: isActive ? 'Active' : 'Inactive',
            availabilityStatus: availability || 'unknown'
          };
        });
        setTechnicians(normalized);
      } else {
        setError('Failed to load technicians data');
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
      setError(`Failed to load technicians: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      email: '',
      password: '',
      staff_id: '',
      specialization: '',
      phone: '',
      availability_status: 'available'
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (tech) => {
    setModalMode('edit');
    setSelectedTech(tech);
    setFormData({
      name: tech.name,
      email: tech.email,
      password: '',
      staff_id: tech.staff_id || '',
      specialization: tech.role,
      phone: tech.phone,
      availability_status: tech.availabilityStatus
    });
    setFormError('');
    setShowModal(true);
  };

  const openViewModal = (tech) => {
    setModalMode('view');
    setSelectedTech(tech);
    setFormData({
      name: tech.name,
      email: tech.email,
      password: '',
      staff_id: tech.staff_id || '',
      specialization: tech.role,
      phone: tech.phone,
      availability_status: tech.availabilityStatus
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTech(null);
    setFormError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const url = modalMode === 'add'
        ? 'http://localhost:5000/api/warden/technicians'
        : `http://localhost:5000/api/warden/technicians/${selectedTech.id}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const payload = modalMode === 'add' ? formData : {
        name: formData.name,
        email: formData.email,
        specialization: formData.specialization,
        phone: formData.phone,
        availability_status: formData.availability_status
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

      if (response.ok && data?.success) {
        await fetchTechnicians();
        closeModal();
      } else {
        setFormError(data?.message || `Operation failed (HTTP ${response.status})`);
      }
    } catch (error) {
      setFormError('Request failed: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteConfirm = (tech) => {
    setDeleteConfirm({ open: true, id: tech.id, name: tech.name || 'this technician' });
  };

  const openPasswordModal = (tech) => {
    setSelectedTech(tech);
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
    if (!selectedTech) return;

    setSubmitting(true);
    setPasswordError('');
    try {
      const response = await fetch(`http://localhost:5000/api/warden/technicians/${selectedTech.id}/password`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ password: passwordFormData.password })
      });

      const data = await response.json();
      if (response.ok && data?.success) {
        setShowPasswordConfirm(false);
        setShowPasswordModal(false);
        setSelectedTech(null);
        setPasswordFormData({ password: '', confirmPassword: '' });
      } else {
        setPasswordError(data?.message || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError(error?.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, id: null, name: '' });
  };

  const handleDelete = async (techId) => {
    setDeletingId(techId);
    try {
      const response = await fetch(`http://localhost:5000/api/warden/technicians/${techId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (data.success) {
        await fetchTechnicians();
        closeDeleteConfirm();
      } else {
        alert('Failed to delete technician: ' + data.message);
      }
    } catch (error) {
      alert('Request failed: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusToggle = async (techId, currentStatus) => {
    const newStatus = currentStatus === 'available' ? 'off_duty' : 'available';

    try {
      const response = await fetch(`http://localhost:5000/api/warden/technicians/${techId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ availability_status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        await fetchTechnicians();
      } else {
        alert('Failed to update status: ' + data.message);
      }
    } catch (error) {
      alert('Request failed: ' + error.message);
    }
  };

  const roles = useMemo(() => {
    const uniqueRoles = Array.from(new Set(technicians.map((tech) => tech.role)));
    return ['All', ...uniqueRoles];
  }, [technicians]);

  // Filter technicians
  const getFilteredTechnicians = () => {
    return technicians.filter((tech) => {
      const query = searchTerm.toLowerCase();
      const searchMatch =
        tech.name.toLowerCase().includes(query) ||
        tech.email.toLowerCase().includes(query) ||
        tech.phone.toLowerCase().includes(query);
      const roleMatch = roleFilter === 'All' || tech.role === roleFilter;
      return searchMatch && roleMatch;
    });
  };

  const filteredTechnicians = getFilteredTechnicians();
  const isViewMode = modalMode === 'view';

  if (loading) {
    return (
      <div className="technicians-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading technicians...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="technicians-page">
      {/* Page Header */}
      <div className="page-header-card">
        <div className="page-header-text">
          <h2>Technicians</h2>
          <p>Manage hostel maintenance staff</p>
        </div>
        <button className="add-btn page-header-action" onClick={openAddModal}>
          Add Technician
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="error-alert">
          <p>{error}</p>
        </div>
      )}

      {/* Search & Filter Section */}
      <div className="search-filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="role-filter">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            {roles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Technicians List */}
      {filteredTechnicians.length > 0 ? (
        <div>
          <div className="technicians-table-container technicians-desktop-table">
            <table className="technicians-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Complaints</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTechnicians.map((tech) => (
                  <tr key={tech.id}>
                    <td className="staff-id-cell" data-label="Staff ID">
                      <span className="staff-id-badge">{tech.staff_id}</span>
                    </td>
                    <td className="cell-name" data-label="Name">
                      <div className="name-cell">
                        <div className="avatar">{tech.name.charAt(0)}</div>
                        <span className="name">{tech.name}</span>
                      </div>
                    </td>
                    <td data-label="Role">
                      <span className="role-badge">{tech.role}</span>
                    </td>
                    <td data-label="Phone">{tech.phone}</td>
                    <td className="email-cell" data-label="Email">{tech.email}</td>
                    <td data-label="Complaints">
                      <span className="complaint-badge">{tech.assignedComplaints}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`status-badge ${tech.status.toLowerCase()}`}>
                        {tech.status}
                      </span>
                    </td>
                    <td className="actions-cell" data-label="Actions">
                      <button 
                        className="btn-action btn-view" 
                        onClick={() => openViewModal(tech)}
                        title="View details"
                      >
                        👁️
                      </button>
                      <button 
                        className="btn-action btn-edit" 
                        onClick={() => openEditModal(tech)}
                        title="Edit technician"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-action btn-password" 
                        onClick={() => openPasswordModal(tech)}
                        title="Change Password"
                      >
                        🔐
                      </button>
                      <button 
                        className="btn-action btn-status" 
                        onClick={() => handleStatusToggle(tech.id, tech.availabilityStatus)}
                        title={tech.availabilityStatus === 'available' ? 'Deactivate' : 'Activate'}
                      >
                        {tech.availabilityStatus === 'available' ? '🔴' : '🟢'}
                      </button>
                      <button 
                        className="btn-action btn-delete" 
                        onClick={() => openDeleteConfirm(tech)}
                        title="Delete technician"
                        disabled={deletingId === tech.id}
                      >
                        {deletingId === tech.id ? '⏳' : '🗑️'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="technicians-card-grid technicians-mobile-cards">
            {filteredTechnicians.map((tech) => (
              <article key={tech.id} className="technician-card">
                <div className="technician-card-header">
                  <div className="name-cell">
                    <div className="avatar">{tech.name.charAt(0)}</div>
                    <div className="tech-name-stack">
                      <span className="name">{tech.name}</span>
                      <div className="tech-id-status-row">
                        <span className="staff-id-badge">{tech.staff_id}</span>
                        <span className={`status-badge ${tech.status.toLowerCase()}`}>
                          {tech.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="technician-card-details">
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Role</span>
                    <span className="role-badge">{tech.role}</span>
                  </div>
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Phone</span>
                    <span>{tech.phone}</span>
                  </div>
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Email</span>
                    <span className="email-cell">{tech.email}</span>
                  </div>
                  <div className="tech-detail-row">
                    <span className="tech-detail-label">Complaints</span>
                    <span className="complaint-badge">{tech.assignedComplaints}</span>
                  </div>
                </div>

                <div className="actions-cell tech-card-actions">
                  <button
                    className="tech-action-btn tech-action-view"
                    onClick={() => openViewModal(tech)}
                    aria-label="View technician details"
                    title="View details"
                  >
                    👁️
                  </button>
                  <button
                    className="tech-action-btn tech-action-edit"
                    onClick={() => openEditModal(tech)}
                    aria-label="Edit technician"
                    title="Edit technician"
                  >
                    ✏️
                  </button>
                  <button
                    className="tech-action-btn tech-action-password"
                    onClick={() => openPasswordModal(tech)}
                    aria-label="Change technician password"
                    title="Change Password"
                  >
                    🔐
                  </button>
                  <button
                    className="tech-action-btn tech-action-toggle"
                    onClick={() => handleStatusToggle(tech.id, tech.availabilityStatus)}
                    aria-label={tech.availabilityStatus === 'available' ? 'Deactivate technician' : 'Activate technician'}
                    title={tech.availabilityStatus === 'available' ? 'Deactivate' : 'Activate'}
                  >
                    {tech.availabilityStatus === 'available' ? '🔴' : '🟢'}
                  </button>
                  <button
                    className="tech-action-btn tech-action-delete"
                    onClick={() => openDeleteConfirm(tech)}
                    aria-label="Delete technician"
                    title="Delete technician"
                    disabled={deletingId === tech.id}
                  >
                    {deletingId === tech.id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔧</div>
          <h3>No technicians found</h3>
          <p>{searchTerm || roleFilter !== 'All' ? 'No technicians match your search or filter.' : 'No technicians available. Add one to get started.'}</p>
          <button className="add-btn" onClick={openAddModal}>Add First Technician</button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay technician-modal-overlay" onClick={closeModal}>
          <div
            className={`modal-content technician-modal ${isViewMode ? 'view-mode' : ''} ${modalMode !== 'add' ? 'corner-close-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{modalMode === 'add' ? 'Add New Technician' : modalMode === 'edit' ? 'Edit Technician' : 'Technician Details'}</h2>
              <button className="modal-close close-btn" onClick={closeModal}>×</button>
            </div>
            {isViewMode ? (
              <>
                <div className="modal-body">
                  <div className="tech-view-grid">
                    <div className="tech-view-item">
                      <div className="tech-view-label">Name</div>
                      <div className="tech-view-value">{formData.name || 'N/A'}</div>
                    </div>
                    <div className="tech-view-item">
                      <div className="tech-view-label">Email</div>
                      <div className="tech-view-value">{formData.email || 'N/A'}</div>
                    </div>
                    <div className="tech-view-item">
                      <div className="tech-view-label">Staff ID</div>
                      <div className="tech-view-value">{formData.staff_id || 'N/A'}</div>
                    </div>
                    <div className="tech-view-item">
                      <div className="tech-view-label">Specialization</div>
                      <div className="tech-view-value">{formData.specialization || 'N/A'}</div>
                    </div>
                    <div className="tech-view-item">
                      <div className="tech-view-label">Phone</div>
                      <div className="tech-view-value">{formData.phone || 'N/A'}</div>
                    </div>
                    <div className="tech-view-item">
                      <div className="tech-view-label">Availability</div>
                      <div className="tech-view-value">{formData.availability_status || 'N/A'}</div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="modal-body">
                {formError && <div className="form-error">{formError}</div>}

                <div className="form-grid">
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {modalMode === 'add' ? (
                    <>
                      <div className="form-group">
                        <label>Password *</label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="form-group">
                    <label>Specialization *</label>
                    <select
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Specialization</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Carpentry">Carpentry</option>
                      <option value="HVAC">HVAC (Heating/Cooling)</option>
                      <option value="WiFi">WiFi</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Availability Status</label>
                    <select
                      name="availability_status"
                      value={formData.availability_status}
                      onChange={handleInputChange}
                    >
                      <option value="available">Available</option>
                      <option value="busy">Busy</option>
                      <option value="on_leave">On Leave</option>
                      <option value="off_duty">Off Duty</option>
                    </select>
                  </div>

                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting && <span className="btn-spinner" />}
                    {submitting ? 'Saving...' : (modalMode === 'add' ? 'Add Technician' : 'Save Changes')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {deleteConfirm.open && (
        <div className="modal-overlay technician-modal-overlay" onClick={closeDeleteConfirm}>
          <div
            className="modal-content technician-modal"
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Delete Technician</h2>
              <button className="modal-close close-btn" onClick={closeDeleteConfirm}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeDeleteConfirm}
                disabled={deletingId === deleteConfirm.id}
              >
                Cancel
              </button>
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

      {showPasswordModal && selectedTech && (
        <div className="modal-overlay technician-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content technician-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Change Password</h2>
              <button className="modal-close close-btn" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0, marginBottom: '12px', color: '#334155' }}>
                Changing password for <strong>{selectedTech.name}</strong>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPasswordModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={requestPasswordChange} disabled={submitting}>
                {submitting ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordConfirm && selectedTech && (
        <div className="modal-overlay technician-modal-overlay" onClick={() => setShowPasswordConfirm(false)}>
          <div className="modal-content technician-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Password Change</h2>
              <button className="modal-close close-btn" onClick={() => setShowPasswordConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
                Change password for <strong>{selectedTech.name}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPasswordConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
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

export default Technicians;



