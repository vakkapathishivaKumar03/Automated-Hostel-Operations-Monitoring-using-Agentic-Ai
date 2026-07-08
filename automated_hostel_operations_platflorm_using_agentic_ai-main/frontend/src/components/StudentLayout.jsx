import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import '../styles/student-layout.css';

const StudentLayout = ({ children }) => {
  return (
    <div className="student-layout-wrapper">
      <Sidebar role="student" />
      <TopNavbar role="student" />
      <main className="student-layout-main">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default StudentLayout;
