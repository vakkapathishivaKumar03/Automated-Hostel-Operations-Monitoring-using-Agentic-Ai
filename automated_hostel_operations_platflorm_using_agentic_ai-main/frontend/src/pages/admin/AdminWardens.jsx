import React, { useState, useMemo, useEffect } from 'react';
import ContextActionModal from '../../components/ContextActionModal';
import { getAuthHeaders } from '../../utils/auth';
import '../../styles/admin-wardens.css';

const AdminWardens = () => {
  // State for warden data fetched from database
  const [wardens, setWardens] = useState([]);
  const [hostelBlocks, setHostelBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch wardens and hostel blocks from database on component mount
  useEffect(() => {
    fetchWardens();
    fetchHostelBlocks();
  }, []);

  const fetchHostelBlocks = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/hostel-blocks', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      
      if (data.success && Array.isArray(data.data)) {
        setHostelBlocks(data.data);
      }
    } catch (error) {
      console.error('Error fetching hostel blocks:', error);
    }
  };

  const fetchWardens = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/users?role=warden', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      
      if (data.success && Array.isArray(data.data)) {
        setWardens(data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching wardens:', error);
      setLoading(false);
    }
  };

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [selectedWarden, setSelectedWarden] = useState(null);
  // In-modal message state
  const [modalMessage, setModalMessage] = useState(null);
  const [modalMessageType, setModalMessageType] = useState('success');
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    block: '',
    status: 'Active',
  });

  // Password form data
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Filter wardens based on search and filters
  const filteredWardens = useMemo(() => {
    let filtered = wardens;
    
    if (statusFilter !== 'All') {
      // Normalize status to lowercase to match database values
      const normalizedStatus = statusFilter.toLowerCase();
      filtered = filtered.filter(warden => warden.status === normalizedStatus);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(warden =>
        warden.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        warden.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        warden.staff_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [searchTerm, statusFilter, wardens]);

  // Helper function to show message in modal with auto-dismiss
  const showMessage = (message, type = 'success') => {
    setModalMessage(message);
    setModalMessageType(type);
    setTimeout(() => setModalMessage(null), 3000);
  };

  // Handle modal actions
  const handleAddWarden = () => {
    resetForm();
    setSelectedWarden(null);
    setShowAddModal(true);
  };

  const handleViewProfile = (warden) => {
    setSelectedWarden(warden);
    setShowProfileModal(true);
  };

  const handleEditWarden = (warden) => {
    setSelectedWarden(warden);
    setFormData({
      name: warden.name,
      email: warden.email,
      phone: warden.phone,
      block: warden.block,
      status: warden.status,
    });
    setShowAddModal(true);
  };

  const handleDeleteClick = (warden) => {
    setSelectedWarden(warden);
    setShowDeleteConfirm(true);
  };

  const handleChangePasswordClick = (warden) => {
    setSelectedWarden(warden);
    setPasswordFormData({ password: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChangePassword = async () => {
    if (!selectedWarden) return;

    setShowPasswordConfirm(false);
    if (!passwordFormData.password || !passwordFormData.confirmPassword) {
      showMessage('Please enter password in both fields', 'error');
      return;
    }

    if (passwordFormData.password !== passwordFormData.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    if (passwordFormData.password.length < 4) {
      showMessage('Password must be at least 4 characters long', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/user/${selectedWarden.id}/password`, {
        method: 'PUT',
          headers: getAuthHeaders(true),
        body: JSON.stringify({ password: passwordFormData.password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showMessage(data.message, 'success');
        setShowPasswordModal(false);
        setSelectedWarden(null);
        setPasswordFormData({ password: '', confirmPassword: '' });
      } else {
        showMessage(data.message || 'Failed to change password', 'error');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showMessage('Failed to change password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveWarden = async () => {
    if (!formData.name || !formData.email) {
      showMessage('Please fill in name and email', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedWarden) {
        // Edit existing warden
        const payload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          block: formData.block
        };

        const res = await fetch(`http://localhost:5000/api/admin/user/${selectedWarden.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(true),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          showMessage(`Updated ${formData.name} successfully!`, 'success');
          await fetchWardens(); // Refresh list
          setShowAddModal(false);
          resetForm();
        } else {
          showMessage(data.message || 'Failed to update warden', 'error');
        }
      } else {
        // Add new warden
        const payload = {
          name: formData.name,
          email: formData.email,
          password: 'warden123', // Default password
          role: 'warden',
          phone: formData.phone || null,
        };

        const res = await fetch('http://localhost:5000/api/admin/user', {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          showMessage(`Added ${formData.name} successfully!`, 'success');
          await fetchWardens(); // Refresh list
          setShowAddModal(false);
          resetForm();
        } else {
          showMessage(data.message || 'Failed to add warden', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving warden:', error);
      showMessage('Failed to save warden', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (warden) => {
    try {
      const newStatus = warden.status === 'active' ? 'inactive' : 'active';
      const res = await fetch(`http://localhost:5000/api/admin/user/${warden.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchWardens(); // Refresh list
      } else {
        showMessage(data.message || 'Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      showMessage('Failed to update status', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/user/${selectedWarden.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (data.success) {
        showMessage(`Deleted ${selectedWarden.name} successfully`, 'success');
        await fetchWardens(); // Refresh list
        setShowDeleteConfirm(false);
        setSelectedWarden(null);
      } else {
        showMessage(data.message || 'Failed to delete warden', 'error');
      }
    } catch (error) {
      console.error('Error deleting warden:', error);
      showMessage('Failed to delete warden', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      block: '',
      status: 'Active',
    });
    setSelectedWarden(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  return (
    <div className="admin-wardens-page">
      <div className="page-header page-header-card">
        <div className="header-content page-header-text">
          <h1 className="page-title">Wardens</h1>
          <p className="page-subtitle">Manage hostel wardens</p>
        </div>
        <div className="page-header-action">
          <button className="btn-primary btn-add" onClick={handleAddWarden}>
            Add Warden
          </button>
        </div>
      </div>

      <div className="search-filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      <div className="results-info">
        <span>Showing {filteredWardens.length} of {wardens.length} wardens</span>
      </div>

      {loading ? (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading wardens...</h3>
            <p>Fetching data from database</p>
          </div>
        </div>
      ) : filteredWardens.length === 0 ? (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">👷</div>
            <h3>No wardens found</h3>
            <p>No wardens match your search criteria</p>
          </div>
        </div>
      ) : (
        <>
          <div className="table-container wardens-desktop-table">
            <table className="wardens-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Staff ID</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Block</th>
                  <th>Joining Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWardens.map((warden) => (
                  <tr key={warden.id}>
                    <td>
                      <div className="warden-cell">
                        <div className="warden-avatar">
                          {warden.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="warden-info">
                          <div className="warden-name">{warden.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="staff-id-cell">{warden.staff_id || 'N/A'}</td>
                    <td>{warden.email}</td>
                    <td>{warden.phone || 'N/A'}</td>
                    <td>
                      <div className="block-badge">{warden.block || 'Not Assigned'}</div>
                    </td>
                    <td>
                      <span className="date-cell">
                        {warden.created_at ? new Date(warden.created_at).toLocaleDateString('en-GB') : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${warden.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                        {warden.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-action btn-view" onClick={() => handleViewProfile(warden)} title="View Profile">
                          👁️
                        </button>
                        <button className="btn-action btn-edit" onClick={() => handleEditWarden(warden)} title="Edit">
                          ✏️
                        </button>
                        <button className="btn-action btn-password" onClick={() => handleChangePasswordClick(warden)} title="Change Password">
                          🔐
                        </button>
                        <button
                          className={`btn-action ${warden.status === 'active' ? 'btn-deactivate' : 'btn-activate'}`}
                          onClick={() => handleToggleStatus(warden)}
                          title={warden.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {warden.status === 'active' ? '⏹️' : '▶️'}
                        </button>
                        <button className="btn-action btn-delete" onClick={() => handleDeleteClick(warden)} title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="wardens-mobile-cards">
            {filteredWardens.map((warden) => (
              <article key={warden.id} className="warden-mobile-card">
                <div className="warden-mobile-header">
                  <div className="warden-cell">
                    <div className="warden-avatar">
                      {warden.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="warden-info">
                      <div className="warden-name">{warden.name}</div>
                      <div className="warden-mobile-meta">
                        <span className="warden-id-pill">{warden.staff_id || 'N/A'}</span>
                        <span className={`status-badge ${warden.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                          {warden.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="warden-mobile-grid">
                  <div>
                    <span className="warden-mobile-label">Email</span>
                    <span className="warden-mobile-value">{warden.email}</span>
                  </div>
                  <div>
                    <span className="warden-mobile-label">Phone</span>
                    <span className="warden-mobile-value">{warden.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="warden-mobile-label">Block</span>
                    <span className="block-badge">{warden.block || 'Not Assigned'}</span>
                  </div>
                  <div>
                    <span className="warden-mobile-label">Joining Date</span>
                    <span className="warden-mobile-value">
                      {warden.created_at ? new Date(warden.created_at).toLocaleDateString('en-GB') : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="warden-mobile-actions">
                  <button className="btn-action btn-view" onClick={() => handleViewProfile(warden)} title="View Profile">
                    👁️
                  </button>
                  <button className="btn-action btn-edit" onClick={() => handleEditWarden(warden)} title="Edit">
                    ✏️
                  </button>
                  <button className="btn-action btn-password" onClick={() => handleChangePasswordClick(warden)} title="Change Password">
                    🔐
                  </button>
                  <button
                    className={`btn-action ${warden.status === 'active' ? 'btn-deactivate' : 'btn-activate'}`}
                    onClick={() => handleToggleStatus(warden)}
                    title={warden.status === 'active' ? 'Deactivate' : 'Activate'}
                  >
                    {warden.status === 'active' ? '⏹️' : '▶️'}
                  </button>
                  <button className="btn-action btn-delete" onClick={() => handleDeleteClick(warden)} title="Delete">
                    🗑️
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Warden Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWarden ? 'Edit Warden' : 'Add New Warden'}</h2>
              <button className="btn-close" onClick={handleCloseModal}>✕</button>
            </div>

            <div className="modal-body">
              {modalMessage && (
                <div className={`modal-message modal-message-${modalMessageType}`}>
                  <span className="message-icon">{modalMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{modalMessage}</span>
                </div>
              )}
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Enter warden's full name"
                  className="form-input"
                />
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    placeholder="Enter email address"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Staff ID</label>
                  <input
                    type="text"
                    value={selectedWarden ? (selectedWarden.staff_id || 'Will be auto-generated') : 'Will be auto-generated'}
                    className="form-input"
                    readOnly
                    disabled
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    placeholder="Enter phone number"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Block *</label>
                <select
                  name="block"
                  value={formData.block}
                  onChange={handleFormChange}
                  className="form-select"
                >
                  <option value="">Select block</option>
                  {hostelBlocks.map(block => (
                    <option key={block.id} value={block.block_name}>
                      {block.block_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="form-select"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={handleCloseModal}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveWarden}
                disabled={!formData.name || !formData.email || submitting}
              >
                {submitting ? 'Creating...' : (selectedWarden ? 'Update Warden' : 'Add Warden')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && selectedWarden && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Warden Profile</h2>
              <button className="btn-close" onClick={() => setShowProfileModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="view-grid">
                <div className="view-item">
                  <div className="view-label">Name</div>
                  <div className="view-value">{selectedWarden.name || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Staff ID</div>
                  <div className="view-value">{selectedWarden.staff_id || 'N/A'}</div>
                </div>
                <div className="view-item view-item-full">
                  <div className="view-label">Email</div>
                  <div className="view-value">{selectedWarden.email || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Phone</div>
                  <div className="view-value">{selectedWarden.phone || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Block</div>
                  <div className="view-value">{selectedWarden.block || 'Not Assigned'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Status</div>
                  <div className="view-value">
                    <span className={`status-badge ${selectedWarden.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                      {selectedWarden.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </div>
                </div>
                <div className="view-item">
                  <div className="view-label">Joined On</div>
                  <div className="view-value">
                    {selectedWarden.created_at ? new Date(selectedWarden.created_at).toLocaleDateString('en-GB') : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedWarden && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="btn-close" onClick={() => setShowDeleteConfirm(false)}>✕</button>
            </div>

            <div className="modal-body">
              {modalMessage && (
                <div className={`modal-message modal-message-${modalMessageType}`}>
                  <span className="message-icon">{modalMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{modalMessage}</span>
                </div>
              )}
              <div className="confirm-icon">⚠️</div>
              <p className="confirm-text">
                Are you sure you want to delete <strong>{selectedWarden.name}</strong>?
              </p>
              <p className="confirm-subtext">This action cannot be undone.</p>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete Warden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && selectedWarden && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="btn-close" onClick={() => setShowPasswordModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {modalMessage && (
                <div className={`modal-message modal-message-${modalMessageType}`}>
                  <span className="message-icon">{modalMessageType === 'success' ? '✓' : '⚠'}</span>
                  <span className="message-text">{modalMessage}</span>
                </div>
              )}
              <p className="modal-info">Changing password for: <strong>{selectedWarden.name}</strong></p>
              
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-input"
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
                  className="form-input"
                  name="confirmPassword"
                  value={passwordFormData.confirmPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Re-enter password"
                />
              </div>

              {passwordFormData.password && passwordFormData.confirmPassword && passwordFormData.password !== passwordFormData.confirmPassword && (
                <div className="error-message">Passwords do not match</div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowPasswordModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={() => setShowPasswordConfirm(true)}
                disabled={submitting || !passwordFormData.password || !passwordFormData.confirmPassword}
              >
                {submitting ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ContextActionModal
        open={showPasswordConfirm && !!selectedWarden}
        title="Change Password"
        message={selectedWarden ? `Change password for ${selectedWarden.name}?` : ''}
        confirmText="Change Password"
        cancelText="Cancel"
        tone="warning"
        onConfirm={handleChangePassword}
        onClose={() => setShowPasswordConfirm(false)}
      />
    </div>
  );
};

export default AdminWardens;




