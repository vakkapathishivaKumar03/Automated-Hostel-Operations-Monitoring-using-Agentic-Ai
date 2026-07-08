import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import '../styles/admin-dashboard.css';

const AdminLayout = () => {
  return (
    <div className="admin-page">
      <div className="admin-layout">
        <Sidebar role="admin" />
        <TopNavbar role="admin" />
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
