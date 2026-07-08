import React, { useState, useMemo, useEffect } from 'react';
import '../../styles/admin-students.css';

const AdminStudents = () => {
  // State for students data from database
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hostelBlocks, setHostelBlocks] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);

  // Fetch students from database on component mount
  useEffect(() => {
    fetchStudents();
    fetchHostelBlocks();
    fetchAcademicSettings();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/users?role=student');
      const data = await res.json();
      
      if (data.success && Array.isArray(data.data)) {
        setStudents(data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching students:', error);
      alert('Failed to fetch students from database');
      setLoading(false);
    }
  };

  const fetchHostelBlocks = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/hostel-blocks');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setHostelBlocks(data.data);
      }
    } catch (error) {
      console.error('Error fetching hostel blocks:', error);
    }
  };

  const fetchRoomsByBlock = async (blockId) => {
    if (!blockId) {
      setAvailableRooms([]);
      return;
    }
    
    setRoomLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/rooms/${blockId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableRooms(data.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert('Failed to fetch rooms');
    } finally {
      setRoomLoading(false);
    }
  };

  const fetchAcademicSettings = async () => {
    try {
      const [collegesRes, branchesRes] = await Promise.all([
        fetch('http://localhost:5000/api/settings/colleges?includeInactive=true'),
        fetch('http://localhost:5000/api/settings/branches?includeInactive=true')
      ]);
      const [collegesData, branchesData] = await Promise.all([
        collegesRes.json(),
        branchesRes.json()
      ]);

      if (collegesData.success && Array.isArray(collegesData.data)) {
        setColleges(collegesData.data);
      }
      if (branchesData.success && Array.isArray(branchesData.data)) {
        setBranches(branchesData.data);
      }
    } catch (error) {
      console.error('Error fetching academic settings:', error);
    }
  };

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    collegeName: '',
    collegeOther: '',
    branch: '',
    year: '',
    email: '',
    phone: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    block: '',
    room: ''
  });

  // Password form data
  const [passwordFormData, setPasswordFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Format year to ensure consistent display
  const formatYear = (year) => {
    if (!year) return 'N/A';
    if (year.includes('Year')) return year;
    return `${year} Year`;
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = 
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.roll_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBranch = branchFilter === 'All' || student.branch === branchFilter;
      const matchesYear = yearFilter === 'All' || student.year?.toString() === yearFilter;
      
      let matchesStatus = true;
      if (statusFilter === 'Active') {
        matchesStatus = student.status === 'active';
      } else if (statusFilter === 'Inactive') {
        matchesStatus = student.status === 'inactive';
      }
      
      return matchesSearch && matchesBranch && matchesYear && matchesStatus;
    });
  }, [students, searchTerm, branchFilter, yearFilter, statusFilter]);

  // Handlers
  const handleViewProfile = (student) => {
    setSelectedStudent(student);
    setShowProfileModal(true);
  };

  const handleEditStudent = async (student) => {
    const blockName = student.block_name || '';
    const blockId = student.block_id || hostelBlocks.find(b => b.block_name === blockName)?.id || '';
    const collegeValue = student.college_name || '';
    const collegeMatch = colleges.find(c => c.name === collegeValue);

    setSelectedStudent(student);
    setFormData({
      name: student.name,
      rollNumber: student.roll_number,
      collegeName: collegeMatch ? collegeValue : (collegeValue ? 'Other' : ''),
      collegeOther: collegeMatch ? '' : collegeValue,
      branch: student.branch,
      year: student.year,
      email: student.email,
      phone: student.phone,
      parentName: student.parent_name || '',
      parentEmail: student.parent_email || '',
      parentPhone: student.parent_phone || '',
      block: blockName,
      room: student.room_id || ''
    });
    // If student already has a room assigned, fetch rooms for their block
    if (blockId) {
      await fetchRoomsByBlock(blockId);
    }
    setShowEditModal(true);
  };

  const handleDeleteClick = (student) => {
    setSelectedStudent(student);
    setShowDeleteConfirm(true);
  };

  const handleChangePasswordClick = (student) => {
    setSelectedStudent(student);
    setPasswordFormData({ password: '', confirmPassword: '' });
    setShowPasswordConfirm(false);
    setShowPasswordModal(true);
  };

  const handleRequestPasswordChange = () => {
    if (!passwordFormData.password || !passwordFormData.confirmPassword) {
      alert('Please enter password in both fields');
      return;
    }

    if (passwordFormData.password !== passwordFormData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (passwordFormData.password.length < 4) {
      alert('Password must be at least 4 characters long');
      return;
    }

    setShowPasswordConfirm(true);
  };

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChangePassword = async () => {
    if (!passwordFormData.password || !passwordFormData.confirmPassword) {
      alert('Please enter password in both fields');
      return;
    }

    if (passwordFormData.password !== passwordFormData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (passwordFormData.password.length < 4) {
      alert('Password must be at least 4 characters long');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/user/${selectedStudent.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordFormData.password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        setShowPasswordConfirm(false);
        setShowPasswordModal(false);
        setSelectedStudent(null);
        setPasswordFormData({ password: '', confirmPassword: '' });
      } else {
        alert(data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };


  const handleToggleStatus = async (student) => {
    try {
      const newStatus = student.status === 'active' ? 'inactive' : 'active';
      const res = await fetch(`http://localhost:5000/api/admin/user/${student.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchStudents(); // Refresh list
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to update status');
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'collegeName' && value !== 'Other' ? { collegeOther: '' } : {})
    }));
    
    // When block is selected, fetch rooms for that block
    if (name === 'block' && value) {
      const selectedBlock = hostelBlocks.find(b => b.block_name === value);
      if (selectedBlock) {
        fetchRoomsByBlock(selectedBlock.id);
        // Reset room selection when block changes
        setFormData(prev => ({
          ...prev,
          room: ''
        }));
      }
    }
  };

  const handleSaveStudent = async () => {
    if (!formData.name || !formData.rollNumber) {
      alert('Please fill in name and roll number');
      return;
    }

    if (!formData.collegeName) {
      alert('Please select a college');
      return;
    }

    if (formData.collegeName === 'Other' && !formData.collegeOther.trim()) {
      alert('Please specify the college name');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        parentName: formData.parentName,
        parentEmail: formData.parentEmail,
        parentPhone: formData.parentPhone,
        rollNumber: formData.rollNumber,
        collegeName: formData.collegeName === 'Other' ? formData.collegeOther.trim() : formData.collegeName,
        branch: formData.branch,
        year: formData.year
      };

      // Add room ID if a room is selected
      if (formData.room) {
        payload.roomId = parseInt(formData.room);
      }

      const res = await fetch(`http://localhost:5000/api/admin/user/${selectedStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        alert(`Updated ${formData.name} successfully!`);
        await fetchStudents(); // Refresh list
        setShowEditModal(false);
        resetForm();
      } else {
        alert(data.message || 'Failed to update student');
      }
    } catch (error) {
      console.error('Error saving student:', error);
      alert('Failed to save student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/user/${selectedStudent.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        alert(`${selectedStudent.name} has been deleted successfully`);
        await fetchStudents(); // Refresh list
        setShowDeleteConfirm(false);
        setSelectedStudent(null);
      } else {
        alert(data.message || 'Failed to delete student');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Failed to delete student');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      rollNumber: '',
      collegeName: '',
      collegeOther: '',
      branch: '',
      year: '',
      email: '',
      phone: '',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      block: '',
      room: ''
    });
    setAvailableRooms([]);
    setSelectedStudent(null);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    resetForm();
  };

  return (
    <div className="admin-students-page">
      {/* Page Header */}
      <div className="page-header page-header-card">
        <div className="header-content page-header-text">
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">Manage hostel student accounts</p>
        </div>
      </div>

      {/* Search & Filter Section */}
      <div className="search-filter-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name or roll number..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="filter-select"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="All">All Branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.name}>
              {branch.name}
            </option>
          ))}
        </select>

        <select 
          className="filter-select"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="All">All Years</option>
          <option value="1st Year">1st Year</option>
          <option value="2nd Year">2nd Year</option>
          <option value="3rd Year">3rd Year</option>
          <option value="4th Year">4th Year</option>
        </select>

        <select 
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Pending Verification">Pending Verification</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Results Info */}
      <div className="results-info">
        Showing {filteredStudents.length} of {students.length} students
      </div>

      {/* Students Table or Empty State */}
      {loading ? (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading students...</h3>
            <p>Fetching data from database</p>
          </div>
        </div>
      ) : filteredStudents.length > 0 ? (
        <div>
          <div className="table-container students-desktop-table">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Branch</th>
                  <th>Year</th>
                  <th>Fee Status</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar">
                          {student.name.charAt(0)}
                        </div>
                        <div className="student-info">
                          <div className="student-name">{student.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="roll-number">{student.roll_number || 'N/A'}</td>
                    <td>
                      <span className="branch-badge">{student.branch || 'N/A'}</span>
                    </td>
                    <td>{formatYear(student.year)}</td>
                    <td>
                      <span className="fee-status-badge">
                        {student.fee_status || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${student.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                        {student.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button 
                          className="btn-action btn-view"
                          onClick={() => handleViewProfile(student)}
                          title="View Profile"
                        >
                          👁️
                        </button>
                        <button 
                          className="btn-action btn-edit"
                          onClick={() => handleEditStudent(student)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-action btn-password"
                          onClick={() => handleChangePasswordClick(student)}
                          title="Change Password"
                        >
                          🔐
                        </button>
                        <button 
                          className={`btn-action ${student.status === 'active' ? 'btn-deactivate' : 'btn-activate'}`}
                          onClick={() => handleToggleStatus(student)}
                          title={student.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {student.status === 'active' ? '⏸️' : '▶️'}
                        </button>
                        <button 
                          className="btn-action btn-delete"
                          onClick={() => handleDeleteClick(student)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="students-mobile-cards">
            {filteredStudents.map((student) => (
              <article key={student.id} className="student-mobile-card">
                <div className="student-mobile-header">
                  <div className="student-cell">
                    <div className="student-avatar">
                      {student.name.charAt(0)}
                    </div>
                    <div className="student-info">
                      <div className="student-name">{student.name}</div>
                      <div className="student-mobile-meta">
                        <div className="student-id">{student.roll_number || 'N/A'}</div>
                        <span className={`status-badge ${student.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                          {student.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="student-mobile-grid">
                  <div className="student-mobile-item">
                    <span className="student-mobile-label">Branch</span>
                    <span className="student-mobile-value"><span className="branch-badge">{student.branch || 'N/A'}</span></span>
                  </div>
                  <div className="student-mobile-item">
                    <span className="student-mobile-label">Year</span>
                    <span className="student-mobile-value">{formatYear(student.year)}</span>
                  </div>
                  <div className="student-mobile-item">
                    <span className="student-mobile-label">Fee Status</span>
                    <span className="student-mobile-value"><span className="fee-status-badge">{student.fee_status || 'N/A'}</span></span>
                  </div>
                  <div className="student-mobile-item full-width">
                    <span className="student-mobile-label">Email</span>
                    <span className="student-mobile-value">{student.email || 'N/A'}</span>
                  </div>
                </div>

                <div className="student-mobile-actions">
                  <button 
                    className="btn-action btn-view"
                    onClick={() => handleViewProfile(student)}
                    title="View Profile"
                  >
                    👁️
                  </button>
                  <button 
                    className="btn-action btn-edit"
                    onClick={() => handleEditStudent(student)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    className="btn-action btn-password"
                    onClick={() => handleChangePasswordClick(student)}
                    title="Change Password"
                  >
                    🔐
                  </button>
                  <button 
                    className={`btn-action ${student.status === 'active' ? 'btn-deactivate' : 'btn-activate'}`}
                    onClick={() => handleToggleStatus(student)}
                    title={student.status === 'active' ? 'Deactivate' : 'Activate'}
                  >
                    {student.status === 'active' ? '⏸️' : '▶️'}
                  </button>
                  <button 
                    className="btn-action btn-delete"
                    onClick={() => handleDeleteClick(student)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state-container">
          <div className="empty-state">
            <div className="empty-icon">🎓</div>
            <h3>No students found</h3>
            <p>
              {searchTerm || branchFilter !== 'All' || yearFilter !== 'All' || statusFilter !== 'All'
                ? 'Try adjusting your filters'
                : 'No students registered yet'}
            </p>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content modal-profile" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Student Profile</h2>
              <button className="btn-close" onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="view-grid">
                <div className="view-item">
                  <div className="view-label">Name</div>
                  <div className="view-value">{selectedStudent.name || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Roll Number</div>
                  <div className="view-value">{selectedStudent.roll_number || 'N/A'}</div>
                </div>
                <div className="view-item view-item-full">
                  <div className="view-label">Email</div>
                  <div className="view-value">{selectedStudent.email || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Phone</div>
                  <div className="view-value">{selectedStudent.phone || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Parent / Guardian Name</div>
                  <div className="view-value">{selectedStudent.parent_name || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Parent / Guardian Email</div>
                  <div className="view-value">{selectedStudent.parent_email || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Parent / Guardian Phone</div>
                  <div className="view-value">{selectedStudent.parent_phone || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Branch</div>
                  <div className="view-value">{selectedStudent.branch || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Year</div>
                  <div className="view-value">{formatYear(selectedStudent.year)}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Room Number</div>
                  <div className="view-value">{selectedStudent.room_number || 'N/A'}</div>
                </div>
                <div className="view-item">
                  <div className="view-label">Fee Status</div>
                  <div className="view-value">
                    <span className={`fee-badge ${selectedStudent.fee_status === 'paid' ? 'fee-paid' : 'fee-pending'}`}>
                      {selectedStudent.fee_status || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="view-item">
                  <div className="view-label">Registration</div>
                  <div className="view-value">
                    <span className={`status-badge ${selectedStudent.registration_status === 'approved' ? 'badge-active' : selectedStudent.registration_status === 'rejected' ? 'badge-inactive' : 'badge-pending'}`}>
                      {selectedStudent.registration_status || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="view-item">
                  <div className="view-label">Account Status</div>
                  <div className="view-value">
                    <span className={`status-badge ${selectedStudent.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                      {selectedStudent.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </div>
                </div>
                <div className="view-item view-item-full">
                  <div className="view-label">Joined On</div>
                  <div className="view-value">
                    {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString('en-GB', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowProfileModal(false)}>
                Close
              </button>
              <button className="btn-primary" onClick={() => {
                setShowProfileModal(false);
                handleEditStudent(selectedStudent);
              }}>
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Student Details</h2>
              <button className="btn-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Enter student name"
                  />
                </div>
                <div className="form-group">
                  <label>Roll Number *</label>
                  <input
                    type="text"
                    name="rollNumber"
                    className="form-input"
                    value={formData.rollNumber}
                    onChange={handleFormChange}
                    placeholder="Enter roll number"
                  />
                </div>
              </div>
              
              <div className="form-group-row">
                <div className="form-group">
                  <label>College *</label>
                  <select
                    name="collegeName"
                    className="form-select"
                    value={formData.collegeName}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select College</option>
                    {colleges.map((college) => (
                      <option key={college.id} value={college.name}>
                        {college.name}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Branch *</label>
                  <select
                    name="branch"
                    className="form-select"
                    value={formData.branch}
                    onChange={handleFormChange}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year *</label>
                  <select
                    name="year"
                    className="form-select"
                    value={formData.year}
                    onChange={handleFormChange}
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              {formData.collegeName === 'Other' && (
                <div className="form-group-row">
                  <div className="form-group">
                    <label>Specify College *</label>
                    <input
                      type="text"
                      name="collegeOther"
                      className="form-input"
                      value={formData.collegeOther}
                      onChange={handleFormChange}
                      placeholder="Enter college name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group-row">
                <div className="form-group">
                  <label>Hostel Block</label>
                  <select
                    name="block"
                    className="form-select"
                    value={formData.block}
                    onChange={handleFormChange}
                  >
                    <option value="">Select Block (Optional)</option>
                    {hostelBlocks.map(block => (
                      <option key={block.id} value={block.block_name}>
                        {block.block_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Room</label>
                  <select
                    name="room"
                    className="form-select"
                    value={formData.room}
                    onChange={handleFormChange}
                    disabled={!formData.block || roomLoading}
                  >
                    <option value="">Select Room (Optional)</option>
                    {roomLoading ? (
                      <option disabled>Loading rooms...</option>
                    ) : (
                      availableRooms.map(room => (
                        <option key={room.id} value={room.id}>
                          Room {room.room_number} (Capacity: {room.capacity})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    value={formData.email}
                    onChange={handleFormChange}
                    placeholder="email@student.edu"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-input"
                    value={formData.phone}
                    onChange={handleFormChange}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Parent / Guardian Name</label>
                  <input
                    type="text"
                    name="parentName"
                    className="form-input"
                    value={formData.parentName}
                    onChange={handleFormChange}
                    placeholder="Parent / guardian full name"
                  />
                </div>
                <div className="form-group">
                  <label>Parent / Guardian Email</label>
                  <input
                    type="email"
                    name="parentEmail"
                    className="form-input"
                    value={formData.parentEmail}
                    onChange={handleFormChange}
                    placeholder="parent@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Parent / Guardian Phone</label>
                  <input
                    type="tel"
                    name="parentPhone"
                    className="form-input"
                    value={formData.parentPhone}
                    onChange={handleFormChange}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Account Status</label>
                <select
                  name="accountStatus"
                  className="form-select"
                  value={formData.accountStatus}
                  onChange={handleFormChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveStudent}
                disabled={!formData.name || !formData.rollNumber || !formData.branch || !formData.year || submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="btn-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="confirm-icon">⚠️</div>
              <p className="confirm-text">
                Are you sure you want to remove <strong>{selectedStudent.name}</strong> ({selectedStudent.rollNumber})?
              </p>
              <p className="confirm-subtext">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleConfirmDelete}>
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button
                className="btn-close"
                onClick={() => {
                  setShowPasswordConfirm(false);
                  setShowPasswordModal(false);
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-info">Changing password for: <strong>{selectedStudent.name}</strong></p>
              
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
                onClick={() => {
                  setShowPasswordConfirm(false);
                  setShowPasswordModal(false);
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleRequestPasswordChange}
                disabled={submitting || !passwordFormData.password || !passwordFormData.confirmPassword}
              >
                {submitting ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordConfirm && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowPasswordConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Password Change</h2>
              <button className="btn-close" onClick={() => setShowPasswordConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="confirm-icon">🔐</div>
              <p className="confirm-text">
                Change password for <strong>{selectedStudent.name}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowPasswordConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleChangePassword} disabled={submitting}>
                {submitting ? 'Changing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudents;


