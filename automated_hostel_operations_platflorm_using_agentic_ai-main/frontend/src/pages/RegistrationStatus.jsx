import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/registration-status.css';

const RegistrationStatus = () => {
  const navigate = useNavigate();
  const [statusQuery, setStatusQuery] = useState('');
  const [statusResult, setStatusResult] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const handleRegister = () => {
    navigate('/student-registration');
  };

  const handleStatusCheck = async (e) => {
    e.preventDefault();
    const query = statusQuery.trim();

    if (!query) {
      setStatusError('Enter your roll number or email.');
      setStatusResult(null);
      return;
    }

    setStatusLoading(true);
    setStatusError('');
    setStatusResult(null);

    try {
      const param = query.includes('@')
        ? `email=${encodeURIComponent(query)}`
        : `roll_number=${encodeURIComponent(query)}`;
      const response = await fetch(`http://localhost:5000/api/student/registration-status?${param}`);
      const data = await response.json();

      if (data.success) {
        setStatusResult(data.data);
      } else {
        setStatusError(data.message || 'Status not found.');
      }
    } catch (error) {
      console.error('Status check error:', error);
      setStatusError('Unable to check status right now.');
    } finally {
      setStatusLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatLabel = (value) => {
    if (!value) return 'N/A';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  return (
    <div className="registration-status-page">
      <Navbar />
      <main className="status-section">
        <div className="status-container">
          <div className="status-header">
            <h2>Registration Status</h2>
            <p>Track your hostel registration application status</p>
          </div>
          <div className="status-card">
            <div className="status-card-header">
              <div className="status-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h3>Check Your Status</h3>
                <p>Enter your roll number or email to view your registration status</p>
              </div>
            </div>
            <form className="status-form" onSubmit={handleStatusCheck}>
              <input
                type="text"
                className="status-field"
                placeholder="Enter your roll number (e.g., 21CSE001) or email"
                value={statusQuery}
                onChange={(e) => setStatusQuery(e.target.value)}
              />
              <button className="status-search-btn" type="submit" disabled={statusLoading}>
                {statusLoading ? 'Checking...' : 'Search'}
              </button>
            </form>
            {statusError && <p className="status-error">{statusError}</p>}
            {statusResult && (
              <div className="status-details">
                <div className="status-detail">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{statusResult.name || 'N/A'}</span>
                </div>
                <div className="status-detail">
                  <span className="detail-label">Roll Number</span>
                  <span className="detail-value">{statusResult.roll_number || 'N/A'}</span>
                </div>
                <div className="status-detail">
                  <span className="detail-label">Status</span>
                  <span className={`status-badge status-${statusResult.registration_status}`}>
                    {formatLabel(statusResult.registration_status)}
                  </span>
                </div>
                <div className="status-detail">
                  <span className="detail-label">Applied Date</span>
                  <span className="detail-value">{formatDate(statusResult.applied_date)}</span>
                </div>
                <div className="status-detail">
                  <span className="detail-label">Approved Date</span>
                  <span className="detail-value">
                    {statusResult.registration_status === 'approved'
                      ? formatDate(statusResult.approved_date)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="status-footer">
            <span>Haven't registered yet?</span>
            <button className="status-link-btn" type="button" onClick={handleRegister}>
              Apply for hostel registration →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegistrationStatus;

