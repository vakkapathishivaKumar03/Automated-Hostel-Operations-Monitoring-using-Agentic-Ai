import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../utils/auth';
import '../styles/profile-modal.css';

/**
 * ProfileModal Component
 * Universal profile viewer for all user roles
 * Fetches and displays user-specific details based on role
 */
const ProfileModal = ({ onClose }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const API_BASE_URL = 'http://localhost:5000';
  
  const user = getCurrentUser();
  const userId = user?.userId || user?.id;
  const userRole = user?.role;

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    if (!userId || !userRole) {
      setLoading(false);
      setError('User session is invalid. Please login again.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      let endpoint = '';
      
      // Determine API endpoint based on role
      switch(userRole) {
        case 'student':
          endpoint = `${API_BASE_URL}/api/student/profile/${userId}`;
          break;
        case 'warden':
          endpoint = `${API_BASE_URL}/api/warden/profile/${userId}`;
          break;
        case 'security':
          endpoint = `${API_BASE_URL}/api/security/profile/${userId}`;
          break;
        case 'technician':
          endpoint = `${API_BASE_URL}/api/technician/profile/${userId}`;
          break;
        case 'admin':
          endpoint = `${API_BASE_URL}/api/admin/profile/${userId}`;
          break;
        default:
          throw new Error('Invalid user role');
      }

      const response = await fetch(endpoint);
      const data = await response.json();

      if (response.ok && data.success) {
        setProfileData(data.data);
      } else {
        setError(data.message || 'Failed to load profile');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const renderProfileFields = () => {
    if (!profileData) return null;

    // Common fields for all roles
    const commonFields = [
      { label: 'Name', value: profileData.name },
      { label: 'Email', value: profileData.email },
      { label: 'Status', value: profileData.status, isStatus: true },
    ];

    // Role-specific fields
    let roleSpecificFields = [];

    switch(userRole) {
      case 'student':
        roleSpecificFields = [
          { label: 'Roll Number', value: profileData.roll_number },
          { label: 'College', value: profileData.college_name },
          { label: 'Branch', value: profileData.branch },
          { label: 'Year', value: profileData.year },
          { label: 'Room', value: profileData.room_number ? `${profileData.room_number} - ${profileData.block_name}` : 'Not Assigned' },
          { label: 'Phone', value: profileData.phone },
          { label: 'Parent Name', value: profileData.parent_name },
          { label: 'Parent Phone', value: profileData.parent_phone },
          { label: 'Blood Group', value: profileData.blood_group },
          { label: 'Emergency Contact', value: profileData.emergency_contact },
          { label: 'Fee Status', value: profileData.fee_status, isBadge: true },
          { label: 'Registration Status', value: profileData.registration_status, isBadge: true },
        ];
        break;

      case 'warden':
        roleSpecificFields = [
          { label: 'Staff ID', value: profileData.staff_id },
          { label: 'Phone', value: profileData.phone },
          { label: 'Assigned Block', value: profileData.block_name || 'Not Assigned' },
          { label: 'Joined On', value: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('en-GB') : 'N/A' },
        ];
        break;

      case 'security':
        roleSpecificFields = [
          { label: 'Staff ID', value: profileData.staff_id },
          { label: 'Employee ID', value: profileData.employee_id },
          { label: 'Phone', value: profileData.phone },
          { label: 'Assigned Gate/Area', value: profileData.gate_assigned || 'Not Assigned' },
          { label: 'Shift Timing', value: profileData.shift_timing || 'Not Assigned' },
          { label: 'Joined On', value: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('en-GB') : 'N/A' },
        ];
        break;

      case 'technician':
        roleSpecificFields = [
          { label: 'Staff ID', value: profileData.staff_id },
          { label: 'Employee ID', value: profileData.employee_id },
          { label: 'Phone', value: profileData.phone },
          { label: 'Specialization', value: profileData.specialization },
          { label: 'Active Complaints', value: profileData.active_complaints || 0 },
          { label: 'Resolved Complaints', value: profileData.resolved_complaints || 0 },
          { label: 'Joined On', value: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('en-GB') : 'N/A' },
        ];
        break;

      case 'admin':
        roleSpecificFields = [
          { label: 'Admin Level', value: 'System Administrator' },
          { label: 'Joined On', value: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('en-GB') : 'N/A' },
        ];
        break;
    }

    return (
      <div className="profile-fields">
        {commonFields.map((field, index) => (
          <div key={index} className="profile-field">
            <span className="field-label">{field.label}</span>
            <span className={`field-value ${field.isStatus ? 'status-badge' : ''} ${field.isStatus && profileData.status === 'active' ? 'status-active' : 'status-inactive'}`}>
              {field.value || 'N/A'}
            </span>
          </div>
        ))}
        
        <div className="profile-divider"></div>
        
        {roleSpecificFields.map((field, index) => (
          <div key={index} className="profile-field">
            <span className="field-label">{field.label}</span>
            <span className={`field-value ${field.isBadge ? 'badge' : ''}`}>
              {field.value || 'N/A'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>My Profile</h2>
          <button className="profile-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="profile-modal-body">
          {loading ? (
            <div className="profile-loading">
              <div className="spinner"></div>
              <p>Loading profile...</p>
            </div>
          ) : error ? (
            <div className="profile-error">
              <p className="error-message">⚠️ {error}</p>
              <button onClick={fetchProfileData} className="retry-btn">Retry</button>
            </div>
          ) : (
            <>
              <div className="profile-header-section">
                <div className="profile-avatar-large">
                  {profileData?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="profile-main-info">
                  <h3>{profileData?.name}</h3>
                  <p className="profile-role">{userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}</p>
                </div>
              </div>

              {renderProfileFields()}
            </>
          )}
        </div>

        <div className="profile-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;


