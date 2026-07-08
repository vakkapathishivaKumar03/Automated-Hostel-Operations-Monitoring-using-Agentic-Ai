import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../utils/auth';
import ChangePassword from './ChangePassword';
import ProfileModal from './ProfileModal';
import '../styles/top-navbar.css';

const TopNavbar = ({ role }) => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const menuRef = useRef(null);

  const profile = useMemo(() => {
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';

    return {
      initial: user?.name?.charAt(0).toUpperCase() || roleLabel.charAt(0),
      name: user?.name || roleLabel,
      subtitle: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : roleLabel,
    };
  }, [user, role]);

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const hasTopModalOpen = showProfile || showChangePassword;

    if (hasTopModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showProfile, showChangePassword]);

  return (
    <header className="top-navbar">
      <div className="top-navbar-actions" ref={menuRef}>
        <button
          type="button"
          className="top-navbar-menu-btn"
          onClick={() => window.dispatchEvent(new Event('hostel:toggle-mobile-sidebar'))}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          ☰
        </button>

        <button
          className="top-navbar-profile-trigger"
          onClick={() => setIsPanelOpen((prev) => !prev)}
        >
          <span className="top-navbar-avatar">{profile.initial}</span>
          <span className="top-navbar-user-text">
            <strong>{profile.name}</strong>
            <small>{profile.subtitle}</small>
          </span>
          <span className={`top-navbar-chevron ${isPanelOpen ? 'open' : ''}`} aria-hidden="true">⌄</span>
        </button>

        <button className="top-navbar-logout-inline" onClick={handleSignOut}>
          Logout
        </button>

        {isPanelOpen && (
          <div className="top-navbar-profile-panel">
            <div className="top-profile-card">
              <div className="top-avatar-circle">{profile.initial}</div>
              <div className="top-profile-info">
                <div className="top-profile-name">{profile.name}</div>
                <div className="top-profile-subtitle">{profile.subtitle}</div>
              </div>
            </div>

            <button
              className="top-view-profile-btn"
              onClick={() => {
                setShowProfile(true);
                setIsPanelOpen(false);
              }}
            >
              <span className="top-action-icon">👤</span>
              <span>View Profile</span>
            </button>

            <button
              className="top-change-password-btn"
              onClick={() => {
                setShowChangePassword(true);
                setIsPanelOpen(false);
              }}
            >
              <span className="top-action-icon">🔒</span>
              <span>Change Password</span>
            </button>

            <button className="top-logout-btn" onClick={handleSignOut}>
              <span className="top-action-icon">⎋</span>
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {showChangePassword && (
        <ChangePassword
          userId={user?.userId}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </header>
  );
};

export default TopNavbar;