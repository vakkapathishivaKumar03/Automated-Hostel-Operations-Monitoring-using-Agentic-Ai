import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import '../styles/warden-dashboard.css';

const WardenLayout = () => {
  return (
    <div className="warden-page">
      <div className="warden-layout">
        <Sidebar role="warden" />
        <TopNavbar role="warden" />
        <main className="warden-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default WardenLayout;
