import axios from 'axios';

// Base API URL - change this if backend runs on different port
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

const OFFLINE_DEMO_USERS = [
  { identifier: '23R21A6675', password: 'sathwik', userId: 101, name: 'Demo Student', role: 'student', rollNumber: '23R21A6675' },
  { identifier: 'student@hostel.edu', password: 'student123', userId: 102, name: 'Demo Student', role: 'student', rollNumber: '23R21A6675' },
  { identifier: 'warden@hostel.edu', password: 'warden123', userId: 103, name: 'Demo Warden', role: 'warden', staffId: 'WRD001' },
  { identifier: 'admin@hostel.edu', password: 'admin123', userId: 104, name: 'Demo Admin', role: 'admin', staffId: 'ADM001' },
  { identifier: 'technician@hostel.edu', password: 'tech123', userId: 105, name: 'Demo Technician', role: 'technician', staffId: 'TECH001' },
  { identifier: 'security@hostel.edu', password: 'security123', userId: 106, name: 'Demo Security', role: 'security', staffId: 'SEC001' }
];

const persistAuthUser = (loginData) => {
  const userData = {
    userId: loginData.userId,
    name: loginData.name,
    role: loginData.role,
    staffId: loginData.staffId || null,
    rollNumber: loginData.rollNumber || null
  };
  localStorage.setItem('hostelUser', JSON.stringify(userData));
  localStorage.setItem('isAuthenticated', 'true');
};

const getOfflineDemoUser = (email, password) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return OFFLINE_DEMO_USERS.find((candidate) => {
    const candidateIdentifier = candidate.identifier.toLowerCase();
    return candidateIdentifier === normalizedEmail && candidate.password === password;
  });
};

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('hostelUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const user = readStoredUser();
  const actorId = user?.userId || user?.id;
  if (actorId) {
    config.headers['X-User-Id'] = String(actorId);
  }
  if (user?.role) {
    config.headers['X-User-Role'] = String(user.role);
  }
  return config;
});

// ===================================
// Authentication Functions
// ===================================

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} Response with user data
 */
export const login = async (email, password, userType = 'student') => {
  try {
    const response = await api.post('/login', { email, password, userType });

    const payload = response.data || {};
    const loginData = payload.data || payload;

    if (payload.success) {
      persistAuthUser(loginData);
      return {
        success: true,
        ...loginData,
        message: payload.message
      };
    }
    return {
      success: false,
      message: payload.message || payload.error?.message || 'Login failed',
      error: payload.error || null
    };
  } catch (error) {
    if (error.response) {
      // Server responded with error
      const payload = error.response.data || {};
      return {
        success: false,
        message: payload.message || payload.error?.message || 'Login failed',
        error: payload.error || null
      };
    } else if (error.request) {
      // No response from server
      const demoUser = getOfflineDemoUser(email, password);
      if (demoUser) {
        persistAuthUser(demoUser);
        return {
          success: true,
          ...demoUser,
          message: 'Logged in with offline demo mode (backend unavailable).'
        };
      }

      return {
        success: false,
        message: 'Cannot connect to server. Start backend on http://localhost:5000 or use demo credentials.'
      };
    } else {
      // Other errors
      return {
        success: false,
        message: 'An unexpected error occurred'
      };
    }
  }
};

/**
 * Logout user and clear session
 * 
 * 🔐 Security Features:
 * - Clears all session data from localStorage
 * - Attempts backend logout call (graceful degradation if fails)
 * - Ensures complete session invalidation
 * - Works correctly even if backend is unavailable
 * 
 * 🎯 Usage:
 * ```javascript
 * const handleLogout = async () => {
 *   await logout();
 *   navigate('/login', { replace: true });
 * };
 * ```
 * 
 * @returns {Promise<void>} Resolves when logout is complete
 */
export const logout = async () => {
  try {
    // Attempt to notify backend about logout
    await api.post('/logout');
  } catch (error) {
    // Backend logout failed - continue anyway
    console.warn('Backend logout failed (non-critical):', error.message);
  } finally {
    // CRITICAL: Always clear localStorage regardless of backend response
    // This ensures session is invalidated even if backend is down
    localStorage.removeItem('hostelUser');
    localStorage.removeItem('isAuthenticated');
    
    // Optional: Clear any other app-specific data
    // localStorage.removeItem('appSettings');
    // sessionStorage.clear();
    
    console.log('✅ User logged out - session cleared');
  }
};

/**
 * Get current logged-in user from localStorage
 * @returns {Object|null} User object {userId, name, role} or null
 */
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('hostelUser');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const getAuthHeaders = (includeContentType = false) => {
  const user = getCurrentUser();
  const headers = {};

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const actorId = user?.userId || user?.id;
  if (actorId) {
    headers['X-User-Id'] = String(actorId);
  }

  if (user?.role) {
    headers['X-User-Role'] = String(user.role);
  }

  return headers;
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
export const isAuthenticated = () => {
  return localStorage.getItem('isAuthenticated') === 'true' && getCurrentUser() !== null;
};

/**
 * Get user role
 * @returns {string|null} User role or null
 */
export const getUserRole = () => {
  const user = getCurrentUser();
  return user ? user.role : null;
};

/**
 * Test backend connection
 * @returns {Promise} Test response
 */
export const testConnection = async () => {
  try {
    const response = await api.get('/test');
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: 'Backend connection failed'
    };
  }
};

/**
 * Create demo users (Development only)
 * @returns {Promise} Response with created users
 */
export const createDemoUsers = async () => {
  try {
    const response = await api.post('/create-demo-users');
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    return {
      success: false,
      message: 'Failed to create demo users'
    };
  }
};

// ===================================
// Route Guards / Authorization
// ===================================

/**
 * Check if user has required role
 * @param {string} requiredRole - Required role to access resource
 * @returns {boolean} True if user has required role
 */
export const hasRole = (requiredRole) => {
  const userRole = getUserRole();
  return userRole === requiredRole;
};

/**
 * Check if user has any of the required roles
 * @param {Array} requiredRoles - Array of allowed roles
 * @returns {boolean} True if user has any of the required roles
 */
export const hasAnyRole = (requiredRoles) => {
  const userRole = getUserRole();
  return requiredRoles.includes(userRole);
};

/**
 * Get dashboard path based on user role
 * @returns {string} Dashboard path
 */
export const getDashboardPath = () => {
  const role = getUserRole();
  switch (role) {
    case 'student':
      return '/student/dashboard';
    case 'warden':
      return '/warden/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'technician':
      return '/technician/dashboard';
    case 'security':
      return '/security/dashboard';
    default:
      return '/login';
  }
};

export default api;
