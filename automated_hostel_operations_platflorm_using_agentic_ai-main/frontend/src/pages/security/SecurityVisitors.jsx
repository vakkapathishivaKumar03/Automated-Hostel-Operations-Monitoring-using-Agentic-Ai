import React, { useState, useEffect } from 'react';
import { getAuthHeaders, getCurrentUser } from '../../utils/auth';
import '../../styles/security-dashboard.css';

const SecurityVisitors = () => {
  const currentUser = getCurrentUser();
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [visitorHistory, setVisitorHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOutId, setCheckingOutId] = useState(null);
  const [addingVisitor, setAddingVisitor] = useState(false);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    visitorName: '',
    phone: '',
    studentSearch: '',
    studentId: null,
    studentName: '',
    roomNumber: '',
    purpose: ''
  });

  useEffect(() => {
    fetchVisitors();
    fetchStudents();
  }, []);

  useEffect(() => {
    if (showDetails) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showDetails]);

  const fetchStudents = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/security/students', {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      // Fetch active visitors
      const activeRes = await fetch('http://localhost:5000/api/security/visitors/active');
      const activeData = await activeRes.json();
      if (activeData.success && Array.isArray(activeData.data)) {
        const formattedActive = activeData.data.map((v) => ({
          id: v.id,
          visitorName: v.visitor_name,
          phone: v.phone,
          idType: v.id_type?.charAt(0).toUpperCase() + v.id_type?.slice(1) || 'Other',
          idNumber: v.id_number,
          studentName: v.student_name,
          studentRoll: v.roll_number,
          roomNumber: v.room_number || 'N/A',
          purpose: v.purpose || 'Not specified',
          entryTime: v.entry_time ? new Date(v.entry_time).toLocaleString() : 'N/A',
          status: 'Inside'
        }));
        setActiveVisitors(formattedActive);
      }

      // Fetch visitor history
      const historyRes = await fetch('http://localhost:5000/api/security/visitors/history');
      const historyData = await historyRes.json();
      if (historyData.success && Array.isArray(historyData.data)) {
        const formattedHistory = historyData.data.map((v) => {
          const entryTime = new Date(v.entry_time);
          const exitTime = v.exit_time ? new Date(v.exit_time) : null;
          const duration = exitTime ? 
            Math.floor((exitTime - entryTime) / 60000) + ' mins' : 
            'N/A';
          
          return {
            id: v.id,
            visitorName: v.visitor_name,
            studentName: v.student_name,
            entryTime: entryTime.toLocaleString(),
            exitTime: exitTime ? exitTime.toLocaleString() : 'N/A',
            duration: duration
          };
        });
        setVisitorHistory(formattedHistory);
      }
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (visitor) => {
    setSelectedVisitor(visitor);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedVisitor(null);
  };

  const handleMarkExit = async (id) => {
    if (checkingOutId === id) return;
    setCheckingOutId(id);
    try {
      const response = await fetch(`http://localhost:5000/api/security/visitor/${id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Visitor checked out successfully');
        await fetchVisitors();
      } else {
        alert('Failed to check out visitor: ' + data.message);
      }
    } catch (error) {
      console.error('Error marking exit:', error);
      alert('Failed to mark exit');
    } finally {
      setCheckingOutId(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStudentSearch = (e) => {
    const searchValue = e.target.value;
    setFormData(prev => ({ ...prev, studentSearch: searchValue }));
    
    if (searchValue.trim()) {
      const filtered = students.filter(s => 
        s.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(searchValue.toLowerCase())
      );
      setFilteredStudents(filtered);
      setShowStudentDropdown(true);
    } else {
      setFilteredStudents([]);
      setShowStudentDropdown(false);
    }
  };

  const handleStudentSelect = (student) => {
    setFormData(prev => ({
      ...prev,
      studentSearch: `${student.name} (${student.roll_number})`,
      studentId: student.id,
      studentName: student.name,
      roomNumber: student.room_number || ''
    }));
    setShowStudentDropdown(false);
  };

  const handleAllowEntry = async () => {
    if (addingVisitor) return;

    // Validation
    if (!formData.visitorName.trim()) {
      alert('Please enter visitor name');
      return;
    }
    if (!formData.phone.trim()) {
      alert('Please enter phone number');
      return;
    }
    if (!formData.studentId) {
      alert('Please select a student');
      return;
    }
    if (!formData.purpose.trim()) {
      alert('Please enter purpose of visit');
      return;
    }

    setAddingVisitor(true);
    try {
      const response = await fetch('http://localhost:5000/api/security/visitor/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_name: formData.visitorName,
          phone: formData.phone,
          student_id: formData.studentId,
          purpose: formData.purpose,
          security_guard_id: currentUser.userId
        })
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Visitor entry recorded successfully');
        handleCancel();
        await fetchVisitors();
      } else {
        alert('Failed to record entry: ' + data.message);
      }
    } catch (error) {
      console.error('Error recording entry:', error);
      alert('Failed to record visitor entry');
    } finally {
      setAddingVisitor(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      visitorName: '',
      phone: '',
      studentSearch: '',
      studentId: null,
      studentName: '',
      roomNumber: '',
      purpose: ''
    });
    setShowStudentDropdown(false);
  };

  const activeInside = activeVisitors.filter((item) => item.status === 'Inside');
  const historyCount = visitorHistory.length;
  const visitorsExitedToday = visitorHistory.filter((visitor) => {
    if (!visitor.exitTime || visitor.exitTime === 'N/A') return false;
    const exitDate = new Date(visitor.exitTime);
    const now = new Date();
    return exitDate.toDateString() === now.toDateString();
  }).length;

  return (
    <>
      <header className="visitor-header">
            <div className="header-content">
              <h1 className="security-title-main">Visitor Entry Management</h1>
              <p className="security-subtitle">Register and track hostel visitors</p>
            </div>
          </header>

          <section className="visitor-summary-cards">
            <div className="visitor-summary-card">
              <span className="card-label">Inside</span>
              <strong className="card-value">{activeInside.length}</strong>
              <span className="card-subtitle">Visitors currently inside</span>
            </div>
            <div className="visitor-summary-card visitor-summary-history">
              <span className="card-label">History</span>
              <strong className="card-value">{historyCount}</strong>
              <span className="card-subtitle">Recorded visitor entries</span>
            </div>
            <div className="visitor-summary-card visitor-summary-exit">
              <span className="card-label">Exited Today</span>
              <strong className="card-value">{visitorsExitedToday}</strong>
              <span className="card-subtitle">Checkouts completed today</span>
            </div>
          </section>

          <section className="visitor-form">
            <div className="form-row">
              <div className="form-group">
                <label>Visitor Name *</label>
                <input 
                  type="text" 
                  name="visitorName"
                  value={formData.visitorName}
                  onChange={handleInputChange}
                  placeholder="e.g. Ravi Patel" 
                />
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input 
                  type="text" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="e.g. 98765 43210" 
                />
              </div>
              <div className="form-group visitor-student-search">
                <label>Visiting Student *</label>
                <input 
                  type="text" 
                  name="studentSearch"
                  value={formData.studentSearch}
                  onChange={handleStudentSearch}
                  placeholder="Search by Name or Roll Number"
                  autoComplete="off"
                />
                {showStudentDropdown && filteredStudents.length > 0 && (
                  <div className="visitor-student-dropdown">
                    {filteredStudents.map(student => (
                      <div
                        key={student.id}
                        onClick={() => handleStudentSelect(student)}
                        className="visitor-student-option"
                      >
                        <div className="visitor-student-name">{student.name}</div>
                        <div className="visitor-student-meta">
                          {student.roll_number} - Room {student.room_number || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Room Number</label>
                <input 
                  type="text" 
                  name="roomNumber"
                  value={formData.roomNumber}
                  readOnly
                  placeholder="Auto-filled from student" 
                  className="readonly-input"
                />
              </div>
              <div className="form-group">
                <label>Purpose of Visit *</label>
                <input 
                  type="text" 
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  placeholder="e.g. Documents, Meeting" 
                />
              </div>
              <div className="form-group">
                <label>Entry Date & Time</label>
                <input 
                  type="text" 
                  value={new Date().toLocaleString('en-IN', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                  readOnly
                  className="readonly-input"
                />
              </div>
            </div>
            <div className="form-actions">
              <button 
                className="btn-action primary" 
                onClick={handleAllowEntry}
                disabled={addingVisitor}
              >
                {addingVisitor ? (
                  <>
                    <span className="btn-spinner"></span>
                    Processing...
                  </>
                ) : (
                  'Allow Entry'
                )}
              </button>
              <button 
                className="btn-action" 
                onClick={handleCancel}
                disabled={addingVisitor}
              >
                Cancel
              </button>
            </div>
          </section>

          <section className="visitor-panel">
            <div className="panel-header">
              <h3>Active Visitors</h3>
              <span className="panel-pill">{activeInside.length} inside</span>
            </div>
            {loading ? (
              <div className="outpass-loading">Loading active visitors...</div>
            ) : activeInside.length > 0 ? (
              <>
              <div className="visitor-table">
                <table>
                  <thead>
                    <tr>
                      <th>Visitor Name</th>
                      <th>Visiting Student</th>
                      <th>Room</th>
                      <th>Entry Time</th>
                      <th>Purpose</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInside.map((visitor) => (
                      <tr key={visitor.id}>
                        <td>
                          <div className="student-name">{visitor.visitorName}</div>
                          <div className="student-id">{visitor.phone}</div>
                        </td>
                        <td>{visitor.studentName}</td>
                        <td>{visitor.roomNumber}</td>
                        <td>{visitor.entryTime}</td>
                        <td>{visitor.purpose}</td>
                        <td>
                          <span className="status-badge status-inside">Inside</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-action" onClick={() => handleViewDetails(visitor)}>
                              View Details
                            </button>
                            <button
                              className="btn-action primary"
                              onClick={() => handleMarkExit(visitor.id)}
                              disabled={checkingOutId === visitor.id}
                            >
                              {checkingOutId === visitor.id && <span className="btn-spinner" />}
                              {checkingOutId === visitor.id ? 'Checking out...' : 'Mark Exit'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="visitor-cards-mobile">
                {activeInside.map((visitor) => (
                  <article key={`active-mobile-${visitor.id}`} className="visitor-card-mobile">
                    <div className="visitor-card-head">
                      <div>
                        <div className="student-name">{visitor.visitorName}</div>
                        <div className="student-id">{visitor.phone}</div>
                      </div>
                      <span className="status-badge status-inside">Inside</span>
                    </div>
                    <div className="visitor-card-grid">
                      <div><span>Student</span><strong>{visitor.studentName}</strong></div>
                      <div><span>Room</span><strong>{visitor.roomNumber}</strong></div>
                      <div><span>Entry</span><strong>{visitor.entryTime}</strong></div>
                      <div><span>Purpose</span><strong>{visitor.purpose}</strong></div>
                    </div>
                    <div className="action-buttons">
                      <button className="btn-action" onClick={() => handleViewDetails(visitor)}>View Details</button>
                      <button
                        className="btn-action primary"
                        onClick={() => handleMarkExit(visitor.id)}
                        disabled={checkingOutId === visitor.id}
                      >
                        {checkingOutId === visitor.id && <span className="btn-spinner" />}
                        {checkingOutId === visitor.id ? 'Checking out...' : 'Mark Exit'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              </>
            ) : loading ? null : (
              <div className="empty-state">
                <span className="empty-icon">🚶</span>
                <p className="empty-message">No visitors currently inside the hostel</p>
              </div>
            )}
          </section>

          <section className="visitor-panel">
            <div className="panel-header">
              <h3>Visitor History</h3>
            </div>
            <div className="visitor-table visitor-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Visitor Name</th>
                    <th>Student Name</th>
                    <th>Entry Time</th>
                    <th>Exit Time</th>
                    <th>Visit Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {visitorHistory.map((visitor) => (
                    <tr key={visitor.id}>
                      <td>{visitor.visitorName}</td>
                      <td>{visitor.studentName}</td>
                      <td>{visitor.entryTime}</td>
                      <td>{visitor.exitTime}</td>
                      <td>{visitor.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="visitor-history-cards-mobile">
              {visitorHistory.map((visitor) => (
                <article key={`history-mobile-${visitor.id}`} className="visitor-card-mobile visitor-history-card-mobile">
                  <div className="visitor-card-head">
                    <div>
                      <div className="student-name">{visitor.visitorName}</div>
                      <div className="student-id">{visitor.studentName}</div>
                    </div>
                    <span className="status-badge status-exited">Exited</span>
                  </div>
                  <div className="visitor-card-grid">
                    <div><span>Entry</span><strong>{visitor.entryTime}</strong></div>
                    <div><span>Exit</span><strong>{visitor.exitTime}</strong></div>
                    <div><span>Duration</span><strong>{visitor.duration}</strong></div>
                  </div>
                </article>
              ))}
            </div>
          </section>

      {showDetails && selectedVisitor && (
        <div className="modal-overlay visitor-modal-overlay" onClick={closeDetails}>
          <div className="modal-content visitor-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header visitor-details-header">
              <h2>Visitor Details</h2>
              <button className="modal-close" onClick={closeDetails}>×</button>
            </div>
            <div className="modal-body visitor-details-body">
              <div className="visitor-details-grid">
                <div className="visitor-detail-card">
                  <div className="detail-label">Visitor</div>
                  <div className="detail-value">{selectedVisitor.visitorName}</div>
                  <div className="detail-sub">{selectedVisitor.phone}</div>
                </div>
                <div className="visitor-detail-card">
                  <div className="detail-label">ID</div>
                  <div className="detail-value">{selectedVisitor.idType}</div>
                  <div className="detail-sub">{selectedVisitor.idNumber}</div>
                </div>
                <div className="visitor-detail-card">
                  <div className="detail-label">Student</div>
                  <div className="detail-value">{selectedVisitor.studentName}</div>
                  <div className="detail-sub">{selectedVisitor.studentRoll}</div>
                </div>
                <div className="visitor-detail-card">
                  <div className="detail-label">Room</div>
                  <div className="detail-value">{selectedVisitor.roomNumber}</div>
                  <div className="detail-sub">{selectedVisitor.purpose}</div>
                </div>
              </div>

              <div className="visitor-mini-timeline">
                <div className="visitor-mini-step visitor-mini-step-active">
                  <span>Entry</span>
                  <strong>{selectedVisitor.entryTime}</strong>
                </div>
                <div className="visitor-mini-step">
                  <span>Exit</span>
                  <strong>Pending</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer visitor-details-footer">
              <button className="btn-secondary visitor-details-close" onClick={closeDetails}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityVisitors;


