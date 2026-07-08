import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated, getDashboardPath } from './utils/auth';

// Import Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentRegistration from './pages/student/StudentRegistration';
import RegistrationStatus from './pages/RegistrationStatus';
import StudentOutpass from './pages/student/StudentOutpass';
import StudentLeave from './pages/student/StudentLeave';
import Complaints from './pages/student/Complaints';
import MessMenu from './pages/student/MessMenu';
import Parcels from './pages/student/Parcels';
import Room from './pages/student/Room';
import StudentLayout from './components/StudentLayout';
import WardenLayout from './components/WardenLayout';
import AdminLayout from './components/AdminLayout';
import TechnicianLayout from './components/TechnicianLayout';
import SecurityLayout from './components/SecurityLayout';
import WardenDashboard from './pages/warden/WardenDashboard';
import WardenOutpass from './pages/warden/WardenOutpass';
import WardenLeave from './pages/warden/WardenLeave';
import WardenComplaints from './pages/warden/Complaints';
import Registrations from './pages/warden/Registrations';
import WardenMess from './pages/warden/WardenMess';
import Rooms from './pages/warden/Rooms';
import RoomChangeRequests from './pages/warden/RoomChangeRequests';
import Technicians from './pages/warden/Technicians';
import WardenStudents from './pages/warden/WardenStudents';
import WardenAgenticAlerts from './pages/warden/WardenAgenticAlerts';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminWardens from './pages/admin/AdminWardens';
import AdminStudents from './pages/admin/AdminStudents';
import AdminRegistrations from './pages/admin/AdminRegistrations';
import AdminTechnicians from './pages/admin/AdminTechnicians';
import AdminSecurity from './pages/admin/AdminSecurity';
import AdminHostelBlocks from './pages/admin/AdminHostelBlocks';
import AdminReports from './pages/admin/AdminReports';
import AcademicSettings from './pages/shared/AcademicSettings';
import RoomUtilities from './pages/admin/RoomUtilities';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import TechnicianAssignedTasks from './pages/technician/TechnicianAssignedTasks';
import TechnicianTaskHistory from './pages/technician/TechnicianTaskHistory';
import SecurityDashboard from './pages/security/SecurityDashboard';
import SecurityOutpass from './pages/security/SecurityOutpass';
import SecurityParcels from './pages/security/SecurityParcels';
import SecurityVisitors from './pages/security/SecurityVisitors';
import SecurityDailyLogs from './pages/security/SecurityDailyLogs';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './pages/NotFound';

/**
 * AuthRedirect Component
 * 
 * 🔄 Auto-Redirect Logic:
 * - Runs on app mount and route changes
 * - Checks if user is authenticated
 * - Redirects to role-based dashboard if logged in and on public pages
 * - Prevents showing login/landing to authenticated users
 * 
 * ✅ Behavior:
 * - Authenticated user on "/" or "/login" → Auto-redirect to dashboard
 * - Unauthenticated user → Allow access to public pages
 * - Protected routes → Handled by ProtectedRoute component
 */
const AuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only auto-redirect if user is authenticated
    if (isAuthenticated()) {
      const currentPath = location.pathname;
      const publicRoutes = ['/', '/login', '/student-registration', '/registration-status'];
      
      // If user is on a public route, redirect to their dashboard
      if (publicRoutes.includes(currentPath)) {
        const dashboardPath = getDashboardPath();
        console.log(`✅ Auto-redirect: Authenticated user → ${dashboardPath}`);
        navigate(dashboardPath, { replace: true });
      }
    }
  }, [navigate, location.pathname]);

  return null; // This component doesn't render anything
};

function App() {
  return (
    <Router>
      {/* Auto-redirect authenticated users to their dashboard */}
      <AuthRedirect />
      
      <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/student-registration" element={<StudentRegistration />} />
          <Route path="/registration-status" element={<RegistrationStatus />} />
        
        {/* Student Routes - Protected */}
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentLayout /></ProtectedRoute>}>
          <Route index element={<StudentDashboard />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="outpass" element={<StudentOutpass />} />
          <Route path="leave" element={<StudentLeave />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="mess" element={<MessMenu />} />
          <Route path="parcels" element={<Parcels />} />
          <Route path="room" element={<Room />} />
        </Route>
        
        {/* Warden Routes - Protected */}
        <Route path="/warden" element={<ProtectedRoute allowedRoles={['warden']}><WardenLayout /></ProtectedRoute>}>
          <Route index element={<WardenDashboard />} />
          <Route path="dashboard" element={<WardenDashboard />} />
          <Route path="outpass" element={<WardenOutpass />} />
          <Route path="leave" element={<WardenLeave />} />
          <Route path="complaints" element={<WardenComplaints />} />
          <Route path="registrations" element={<Registrations />} />
          <Route path="mess" element={<WardenMess />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="room-change-requests" element={<RoomChangeRequests />} />
          <Route path="technicians" element={<Technicians />} />
          <Route path="students" element={<WardenStudents />} />
          <Route path="agentic-alerts" element={<WardenAgenticAlerts />} />
          <Route path="academic-settings" element={<AcademicSettings />} />
        </Route>
        
        {/* Admin Routes - Protected */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="wardens" element={<AdminWardens />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="registrations" element={<AdminRegistrations />} />
          <Route path="technicians" element={<AdminTechnicians />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="hostel-blocks" element={<AdminHostelBlocks />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="academic-settings" element={<AcademicSettings />} />
          <Route path="room-utilities" element={<RoomUtilities />} />
        </Route>
        
        {/* Technician Routes - Protected */}
        <Route path="/technician" element={<ProtectedRoute allowedRoles={['technician']}><TechnicianLayout /></ProtectedRoute>}>
          <Route index element={<TechnicianDashboard />} />
          <Route path="dashboard" element={<TechnicianDashboard />} />
          <Route path="assigned-tasks" element={<TechnicianAssignedTasks />} />
          <Route path="task-history" element={<TechnicianTaskHistory />} />
        </Route>
        
        {/* Security Routes - Protected */}
        <Route path="/security" element={<ProtectedRoute allowedRoles={['security']}><SecurityLayout /></ProtectedRoute>}>
          <Route index element={<SecurityDashboard />} />
          <Route path="dashboard" element={<SecurityDashboard />} />
          <Route path="outpass" element={<SecurityOutpass />} />
          <Route path="parcels" element={<SecurityParcels />} />
          <Route path="visitors" element={<SecurityVisitors />} />
          <Route path="logs" element={<SecurityDailyLogs />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
