import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth';

/**
 * ProtectedRoute Component
 * 
 * 🔐 Security Features:
 * - Validates user authentication via localStorage
 * - Enforces role-based access control (RBAC)
 * - Prevents unauthorized access to protected routes
 * - Handles direct URL access attempts
 * 
 * 🔀 Redirect Logic:
 * - Not logged in → /login
 * - Wrong role → User's own dashboard
 * - Correct role → Render protected content
 * 
 * @param {ReactNode} children - Protected component to render
 * @param {Array<string>} allowedRoles - Array of roles permitted to access this route
 * 
 * @example
 * <ProtectedRoute allowedRoles={['admin']}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  // Step 1: Check if user is authenticated
  if (!isAuthenticated()) {
    // User not logged in - redirect to login page
    console.warn('🚫 Access denied: User not authenticated. Redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // Step 2: If no specific roles required, allow access to any authenticated user
  if (allowedRoles.length === 0) {
    return children;
  }

  // Step 3: Validate user role matches allowed roles
  const userRole = getUserRole();
  
  // Role validation - allow access if user role is in allowedRoles
  if (allowedRoles.includes(userRole)) {
    return children;
  }

  // Step 4: User is authenticated but doesn't have required role
  // Redirect to their appropriate dashboard instead of showing error
  console.warn(
    `🚫 Access denied: User role '${userRole}' not in allowed roles [${allowedRoles.join(', ')}]. ` +
    `Redirecting to user's dashboard.`
  );

  const dashboardPaths = {
    student: '/student/dashboard',
    warden: '/warden/dashboard',
    admin: '/admin/dashboard',
    technician: '/technician/dashboard',
    security: '/security/dashboard'
  };

  const redirectPath = dashboardPaths[userRole] || '/login';
  return <Navigate to={redirectPath} replace />;
};

export default ProtectedRoute;
