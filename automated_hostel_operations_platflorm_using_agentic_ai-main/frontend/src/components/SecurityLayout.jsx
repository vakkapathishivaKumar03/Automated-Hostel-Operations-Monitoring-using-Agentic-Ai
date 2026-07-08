import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import '../styles/security-dashboard.css';

/**
 * SecurityLayout Component
 * 
 * Layout wrapper for all security pages
 * Uses unified Sidebar component
 */
const SecurityLayout = ({ children }) => {
  return (
    <div className="security-layout">
      <Sidebar role="security" />
      <TopNavbar role="security" />
      <main className="security-main">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default SecurityLayout;
