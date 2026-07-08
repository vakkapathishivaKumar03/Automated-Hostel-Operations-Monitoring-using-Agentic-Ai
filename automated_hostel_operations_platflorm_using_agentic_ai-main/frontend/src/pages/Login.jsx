import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, isAuthenticated, getDashboardPath } from '../utils/auth';
import Navbar from '../components/Navbar';
import '../styles/login.css';

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path
      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path
      d="M2 12s3.5-6 10-6c2.3 0 4.2.75 5.78 1.77"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 12s-3.5 6-10 6c-2.3 0-4.2-.75-5.78-1.77"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    <line
      x1="3"
      y1="3"
      x2="21"
      y2="21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState('student'); // 'student' or 'staff'

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(getDashboardPath(), { replace: true });
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleLoginClick = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password) {
      setError(userType === 'student' 
        ? 'Please provide email/roll number and password' 
        : 'Please provide email/staff ID and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call backend login API
      const response = await login(formData.email, formData.password);

      if (response.success) {
        // Login successful - redirect to role-based dashboard
        const dashboardPath = getDashboardPath();
        navigate(dashboardPath, { replace: true });
      } else {
        // Login failed - show error message
        setError(response.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('Unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick login helper (for testing)
  const quickLogin = async (email, password) => {
    // Set userType based on login identifier
    const isStaff = email.includes('@') && !email.includes('student');
    setUserType(isStaff ? 'staff' : 'student');
    
    setFormData({ email, password });
    setLoading(true);
    setError('');

    try {
      const response = await login(email, password);
      if (response.success) {
        navigate(getDashboardPath(), { replace: true });
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    navigate('/student-registration');
  };

  return (
    <div className="login-page">
      <Navbar />

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Login to HostelConnect</h1>
            <p className="login-subtitle">Access your hostel management portal</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleLoginClick}>
            {/* User Type Toggle */}
            <div className="form-group">
              <div className="user-type-toggle" role="tablist" aria-label="Select login type">
                <button
                  type="button"
                  onClick={() => setUserType('student')}
                  disabled={loading}
                  className={`user-type-btn ${userType === 'student' ? 'active' : ''}`}
                  aria-selected={userType === 'student'}
                >
                  👨‍🎓 Student
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('staff')}
                  disabled={loading}
                  className={`user-type-btn ${userType === 'staff' ? 'active' : ''}`}
                  aria-selected={userType === 'staff'}
                >
                  👔 Staff
                </button>
              </div>
            </div>

            {/* Email/Roll Number Field - Conditional based on user type */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {userType === 'student' ? 'Email or Roll Number' : 'Email or Staff ID'}
              </label>
              <input
                type="text"
                id="email"
                name="email"
                className="form-input"
                placeholder={userType === 'student' ? 'Enter your email or roll number' : 'Enter your email or staff ID (e.g., SEC123)'}
                value={formData.email}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Demo Credentials Section */}
          <div className="demo-credentials">
            <button 
              className="demo-toggle-btn"
              onClick={() => setShowDemoInfo(!showDemoInfo)}
              type="button"
            >
              🔑 {showDemoInfo ? 'Hide' : 'Show'} Demo Credentials
            </button>
            
            {showDemoInfo && (
              <div className="demo-info">
                <p className="demo-title">Quick Login (Testing)</p>
                <div className="demo-users">
                  <button 
                    className="demo-user-btn"
                    onClick={() => quickLogin('23R21A6675', 'sathwik')}
                    disabled={loading}
                  >
                    👨‍🎓 Student (Roll)
                  </button>
                  <button 
                    className="demo-user-btn"
                    onClick={() => quickLogin('student@hostel.edu', 'student123')}
                    disabled={loading}
                  >
                    👨‍🎓 Student (Email)
                  </button>
                  <button 
                    className="demo-user-btn"
                    onClick={() => quickLogin('warden@hostel.edu', 'warden123')}
                    disabled={loading}
                  >
                    👔 Warden
                  </button>
                  <button 
                    className="demo-user-btn"
                    onClick={() => quickLogin('admin@hostel.edu', 'admin123')}
                    disabled={loading}
                  >
                    🔧 Admin
                  </button>
                  <button 
                    className="demo-user-btn"
                    onClick={() => quickLogin('technician@hostel.edu', 'tech123')}
                    disabled={loading}
                  >
                    🔨 Technician
                  </button>
                  <button 
                    className="demo-user-btn"
                    onClick={() => quickLogin('security@hostel.edu', 'security123')}
                    disabled={loading}
                  >
                    🛡️ Security
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Register Link */}
          <div className="login-footer">
            <p className="register-text">
              New student?{' '}
              <button
                type="button"
                className="register-link"
                onClick={handleRegisterClick}
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
