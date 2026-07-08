import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';
import '../styles/unified-sidebar.css';

/**
 * Unified Sidebar Component
 * 
 * 🎯 Features:
 * - Role-based menu rendering
 * - Reads user info from localStorage
 * - Dynamic profile display
 * - Logout functionality
 * - Active menu highlighting
 * - Responsive design
 * 
 * @param {string} role - User role (optional, auto-detected from localStorage)
 * 
 * @example
 * <Sidebar role="admin" />
 * // or
 * <Sidebar /> // Auto-detects role from localStorage
 */
const Sidebar = ({ role: propRole }) => {
  const user = getCurrentUser();
  const role = propRole || user?.role;
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const width = isCollapsed ? '88px' : '280px';
    document.documentElement.style.setProperty('--sidebar-width', width);
    localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
  }, [isCollapsed]);

  // Remove backdrop on unmount (e.g. logout)
  useEffect(() => {
    return () => {
      const backdrop = document.getElementById('mobile-sidebar-backdrop');
      if (backdrop) backdrop.remove();
    };
  }, []);

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (backdrop) backdrop.remove();
  };

  const openMobileSidebar = () => {
    setIsMobileOpen(true);
    if (!document.getElementById('mobile-sidebar-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'mobile-sidebar-backdrop';
      backdrop.className = 'sidebar-overlay';
      backdrop.addEventListener('click', closeMobileSidebar);
      document.body.appendChild(backdrop);
    }
  };

  useEffect(() => {
    if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
      setIsCollapsed(false);
      closeMobileSidebar();
    }
  }, []);

  useEffect(() => {
    const handleCloseSidebarRequest = () => {
      if (window.innerWidth < 768) {
        closeMobileSidebar();
      }
    };

    const handleToggleSidebarRequest = () => {
      if (window.innerWidth < 768) {
        if (isMobileOpen) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      }
    };

    window.addEventListener('hostel:close-mobile-sidebar', handleCloseSidebarRequest);
    window.addEventListener('hostel:toggle-mobile-sidebar', handleToggleSidebarRequest);
    return () => {
      window.removeEventListener('hostel:close-mobile-sidebar', handleCloseSidebarRequest);
      window.removeEventListener('hostel:toggle-mobile-sidebar', handleToggleSidebarRequest);
    };
  }, [isMobileOpen]);

  const handleToggleClick = () => {
    if (window.innerWidth < 768) {
      // Mobile: toggle overlay mode with backdrop
      if (isMobileOpen) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    } else {
      // Tablet/Desktop: just collapse/expand width
      setIsCollapsed((prev) => !prev);
    }
  };

  // Menu configuration for each role
  const menuConfig = {
    admin: {
      logo: '🏛️',
      title: 'HostelConnect',
      basePath: '/admin',
      items: [
        { path: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/admin/wardens', icon: '👨‍💼', label: 'Wardens' },
        { path: '/admin/students', icon: '🎓', label: 'Students' },
        { path: '/admin/registrations', icon: '📝', label: 'Registrations' },
        { path: '/admin/technicians', icon: '🔧', label: 'Technicians' },
        { path: '/admin/security', icon: '🔐', label: 'Security' },
        { path: '/admin/hostel-blocks', icon: '🏢', label: 'Hostel Blocks' },
        { path: '/admin/academic-settings', icon: '🎓', label: 'Academic Settings' },
        { path: '/admin/room-utilities', icon: '🔧', label: 'Room Utilities' },
        { path: '/admin/reports', icon: '📈', label: 'Reports' },
      ],
      profile: {
        initial: user?.name?.charAt(0).toUpperCase() || 'A',
        name: user?.name || 'System Administrator',
        subtitle: user?.email || 'admin@hostelconnect.edu',
      }
    },
    warden: {
      logo: '🏛️',
      title: 'HostelConnect',
      basePath: '/warden',
      items: [
        { path: '/warden/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/warden/agentic-alerts', icon: '🚨', label: 'Agentic AI Alerts' },
        { path: '/warden/outpass', icon: '✅', label: 'Outpass Approvals' },
        { path: '/warden/leave', icon: '📝', label: 'Leave Approvals' },
        { path: '/warden/complaints', icon: '⚠️', label: 'Complaints' },
        { path: '/warden/registrations', icon: '🧾', label: 'Registrations' },
        { path: '/warden/mess', icon: '🍽️', label: 'Mess Menu' },
        { path: '/warden/rooms', icon: '🛏️', label: 'Rooms' },
        { path: '/warden/room-change-requests', icon: '🔄', label: 'Room Change Requests' },
        { path: '/warden/technicians', icon: '🔧', label: 'Technicians' },
        { path: '/warden/students', icon: '🎓', label: 'Students' },
        { path: '/warden/academic-settings', icon: '🎓', label: 'Academic Settings' },
      ],
      profile: {
        initial: user?.name?.charAt(0).toUpperCase() || 'W',
        name: user?.name || 'Warden',
        subtitle: 'Warden',
      }
    },
    student: {
      logo: '🏢',
      title: 'HostelConnect',
      basePath: '/student',
      items: [
        { path: '/student/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/student/outpass', icon: '🛂', label: 'Outpass' },
        { path: '/student/leave', icon: '📝', label: 'Leave Request' },
        { path: '/student/complaints', icon: '⚠️', label: 'Complaints' },
        { path: '/student/mess', icon: '🍽️', label: 'Mess Menu' },
        { path: '/student/parcels', icon: '📦', label: 'Parcels' },
        { path: '/student/room', icon: '🛏️', label: 'Room Details' },
      ],
      profile: {
        initial: user?.name?.charAt(0).toUpperCase() || 'S',
        name: user?.name || 'Student',
        subtitle: 'Student',
      }
    },
    technician: {
      logo: '🔧',
      title: 'HostelConnect',
      basePath: '/technician',
      items: [
        { path: '/technician/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/technician/assigned-tasks', icon: '📋', label: 'Assigned Tasks' },
        { path: '/technician/task-history', icon: '📜', label: 'Task History' },
      ],
      profile: {
        initial: user?.name?.charAt(0).toUpperCase() || 'T',
        name: user?.name || 'Technician',
        subtitle: user?.email || 'technician@hostelhub.edu',
      }
    },
    security: {
      logo: '🔐',
      title: 'HostelConnect',
      basePath: '/security',
      items: [
        { path: '/security/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/security/outpass', icon: '🚪', label: 'Outpass Gate' },
        { path: '/security/parcels', icon: '📦', label: 'Parcels' },
        { path: '/security/visitors', icon: '🧾', label: 'Visitors' },
        { path: '/security/logs', icon: '🗓️', label: 'Daily Logs' },
      ],
      profile: {
        initial: user?.name?.charAt(0).toUpperCase() || 'S',
        name: user?.name || 'Security Guard',
        subtitle: user?.email || 'security@hostelhub.edu',
      }
    }
  };

  // Get configuration for current role
  const config = menuConfig[role];

  // If no valid role, return null (shouldn't happen with ProtectedRoute)
  if (!config) {
    console.error(`Invalid role: ${role}. Sidebar not rendered.`);
    return null;
  }

  return (
    <aside className={`unified-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Header Section */}
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <div className="sidebar-logo">{config.logo}</div>
          <div className="sidebar-brand-block">
            <div className="sidebar-title-row">
              <div className="sidebar-title">{config.title}</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={handleToggleClick}
            aria-label={isMobileOpen ? 'Close sidebar' : (isCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            title={isMobileOpen ? 'Close sidebar' : (isCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          >
            {/* Desktop icon: based on isCollapsed state */}
            <span className="toggle-icon-desktop">{isCollapsed ? '›' : '‹'}</span>
            {/* Mobile icon: based on isMobileOpen state */}
            <span className="toggle-icon-mobile">{isMobileOpen ? '‹' : '›'}</span>
          </button>
        </div>
      </div>

      {(!isCollapsed || isMobileOpen) && (
        <div className="sidebar-section-label">Menu</div>
      )}

      {/* Navigation Menu */}
      <nav className="sidebar-menu">
        <ul>
          {config.items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) => 
                  isActive ? 'sidebar-item active' : 'sidebar-item'
                }
                onClick={closeMobileSidebar}
              >
                <span className="sidebar-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="sidebar-item-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

    </aside>
  );
};

export default Sidebar;
