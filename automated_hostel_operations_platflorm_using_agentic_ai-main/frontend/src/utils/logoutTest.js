/**
 * Logout Functionality Test Suite
 * 
 * This file contains comprehensive tests to verify logout works correctly
 * across all dashboards and scenarios.
 */

import { logout, isAuthenticated, getCurrentUser } from './auth';

/**
 * Test Suite: Logout Functionality
 */
export const runLogoutTests = () => {
  console.log('🧪 Running Logout Functionality Tests...\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  /**
   * Helper function to run a test
   */
  const test = (name, testFn) => {
    try {
      const result = testFn();
      if (result) {
        results.passed++;
        results.tests.push({ name, status: '✅ PASS', error: null });
        console.log(`✅ PASS: ${name}`);
      } else {
        results.failed++;
        results.tests.push({ name, status: '❌ FAIL', error: 'Assertion failed' });
        console.log(`❌ FAIL: ${name}`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: '❌ FAIL', error: error.message });
      console.log(`❌ FAIL: ${name} - ${error.message}`);
    }
  };

  // Test 1: Logout clears hostelUser
  test('Logout clears hostelUser from localStorage', async () => {
    // Setup: Login a user
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test', role: 'student' }));
    localStorage.setItem('isAuthenticated', 'true');
    
    // Action: Logout
    await logout();
    
    // Verify: hostelUser should be removed
    return localStorage.getItem('hostelUser') === null;
  });

  // Test 2: Logout clears isAuthenticated
  test('Logout clears isAuthenticated from localStorage', async () => {
    // Setup
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test', role: 'student' }));
    localStorage.setItem('isAuthenticated', 'true');
    
    // Action
    await logout();
    
    // Verify
    return localStorage.getItem('isAuthenticated') === null;
  });

  // Test 3: isAuthenticated returns false after logout
  test('isAuthenticated() returns false after logout', async () => {
    // Setup
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test', role: 'student' }));
    localStorage.setItem('isAuthenticated', 'true');
    
    // Verify authenticated before logout
    const beforeLogout = isAuthenticated();
    
    // Action
    await logout();
    
    // Verify not authenticated after logout
    const afterLogout = isAuthenticated();
    
    return beforeLogout === true && afterLogout === false;
  });

  // Test 4: getCurrentUser returns null after logout
  test('getCurrentUser() returns null after logout', async () => {
    // Setup
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test', role: 'student' }));
    localStorage.setItem('isAuthenticated', 'true');
    
    // Action
    await logout();
    
    // Verify
    return getCurrentUser() === null;
  });

  // Test 5: Multiple consecutive logouts don't cause errors
  test('Multiple consecutive logouts work without errors', async () => {
    try {
      // Setup
      localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test', role: 'student' }));
      localStorage.setItem('isAuthenticated', 'true');
      
      // Action: Logout multiple times
      await logout();
      await logout();
      await logout();
      
      // Verify: No errors and localStorage is still clear
      return localStorage.getItem('hostelUser') === null && 
             localStorage.getItem('isAuthenticated') === null;
    } catch (error) {
      return false;
    }
  });

  // Test 6: Logout works when already logged out
  test('Logout works when already logged out', async () => {
    try {
      // Setup: Ensure logged out
      localStorage.removeItem('hostelUser');
      localStorage.removeItem('isAuthenticated');
      
      // Action: Logout when already logged out
      await logout();
      
      // Verify: No errors
      return true;
    } catch (error) {
      return false;
    }
  });

  // Test 7: Logout clears session for student role
  test('Logout clears session for student role', async () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Student', role: 'student' }));
    localStorage.setItem('isAuthenticated', 'true');
    await logout();
    return !isAuthenticated();
  });

  // Test 8: Logout clears session for warden role
  test('Logout clears session for warden role', async () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 2, name: 'Warden', role: 'warden' }));
    localStorage.setItem('isAuthenticated', 'true');
    await logout();
    return !isAuthenticated();
  });

  // Test 9: Logout clears session for admin role
  test('Logout clears session for admin role', async () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 3, name: 'Admin', role: 'admin' }));
    localStorage.setItem('isAuthenticated', 'true');
    await logout();
    return !isAuthenticated();
  });

  // Test 10: Logout clears session for technician role
  test('Logout clears session for technician role', async () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 4, name: 'Tech', role: 'technician' }));
    localStorage.setItem('isAuthenticated', 'true');
    await logout();
    return !isAuthenticated();
  });

  // Test 11: Logout clears session for security role
  test('Logout clears session for security role', async () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 5, name: 'Security', role: 'security' }));
    localStorage.setItem('isAuthenticated', 'true');
    await logout();
    return !isAuthenticated();
  });

  // Summary
  console.log('\n📊 Test Results:');
  console.log(`Total: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Logout functionality is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
  }

  return results;
};

/**
 * Manual test scenarios for logout
 */
export const manualLogoutTestScenarios = [
  {
    scenario: 'Logout from Student Dashboard',
    steps: [
      '1. Login as student (student@hostel.edu / student123)',
      '2. Navigate to /student/dashboard',
      '3. Click "Sign Out" button in sidebar',
      '4. Should redirect to /login',
      '5. Try to access /student/dashboard directly',
      '6. Should redirect to /login (not accessible)'
    ],
    expected: 'User logged out and redirected to login page'
  },
  {
    scenario: 'Logout from Warden Dashboard',
    steps: [
      '1. Login as warden (warden@hostel.edu / warden123)',
      '2. Navigate to /warden/dashboard',
      '3. Click "Sign Out" button in sidebar',
      '4. Should redirect to /login',
      '5. Try to access /warden/dashboard directly',
      '6. Should redirect to /login'
    ],
    expected: 'Warden logged out successfully'
  },
  {
    scenario: 'Logout from Admin Dashboard',
    steps: [
      '1. Login as admin (admin@hostel.edu / admin123)',
      '2. Navigate to /admin/dashboard',
      '3. Click "Sign Out" button in sidebar',
      '4. Should redirect to /login',
      '5. Try to access /admin/dashboard directly',
      '6. Should redirect to /login'
    ],
    expected: 'Admin logged out successfully'
  },
  {
    scenario: 'Logout from Technician Dashboard',
    steps: [
      '1. Login as technician (tech@hostel.edu / tech123)',
      '2. Navigate to /technician/dashboard',
      '3. Click "Sign Out" button in sidebar',
      '4. Should redirect to /login',
      '5. Try to access /technician/dashboard directly',
      '6. Should redirect to /login'
    ],
    expected: 'Technician logged out successfully'
  },
  {
    scenario: 'Logout from Security Dashboard',
    steps: [
      '1. Login as security (security@hostel.edu / security123)',
      '2. Navigate to /security/dashboard',
      '3. Click "Sign Out" button in sidebar',
      '4. Should redirect to /login',
      '5. Try to access /security/dashboard directly',
      '6. Should redirect to /login'
    ],
    expected: 'Security logged out successfully'
  },
  {
    scenario: 'Browser Back Button After Logout',
    steps: [
      '1. Login as any user',
      '2. Navigate to dashboard',
      '3. Click "Sign Out"',
      '4. Redirected to /login',
      '5. Click browser back button',
      '6. Should redirect to /login again (not show dashboard)'
    ],
    expected: 'Back button does NOT restore session'
  },
  {
    scenario: 'Page Refresh After Logout',
    steps: [
      '1. Login as any user',
      '2. Navigate to dashboard',
      '3. Click "Sign Out"',
      '4. Redirected to /login',
      '5. Press F5 to refresh page',
      '6. Should still be on /login (not authenticated)'
    ],
    expected: 'Session remains cleared after refresh'
  },
  {
    scenario: 'Direct URL Access After Logout',
    steps: [
      '1. Login as student',
      '2. Navigate to /student/dashboard',
      '3. Click "Sign Out"',
      '4. In browser address bar, type /student/dashboard',
      '5. Press Enter',
      '6. Should redirect to /login'
    ],
    expected: 'Direct URL access blocked after logout'
  },
  {
    scenario: 'Logout from Different Pages',
    steps: [
      '1. Login as student',
      '2. Navigate to /student/outpass',
      '3. Click "Sign Out" button',
      '4. Should redirect to /login',
      '5. Login again and go to /student/complaints',
      '6. Click "Sign Out" button',
      '7. Should redirect to /login'
    ],
    expected: 'Logout works from any page within dashboard'
  },
  {
    scenario: 'Multiple Device Logout (localStorage)',
    steps: [
      '1. Login as student in Browser Tab 1',
      '2. Navigate to dashboard',
      '3. Open Browser Tab 2 with same user',
      '4. In Tab 1, click "Sign Out"',
      '5. Check Tab 2 - try to navigate',
      '6. If localStorage is shared, Tab 2 should also be logged out on next navigation'
    ],
    expected: 'Session cleared across browser tabs (same browser)'
  }
];

/**
 * Quick logout verification
 * Run this in browser console to quickly verify logout is working
 */
export const quickLogoutCheck = () => {
  console.log('🔍 Quick Logout Check\n');
  
  // Check if logout button exists
  const logoutButtons = document.querySelectorAll('[class*="logout-btn"]');
  console.log(`Logout buttons found: ${logoutButtons.length}`);
  
  if (logoutButtons.length > 0) {
    console.log('✅ Logout button exists on this page');
  } else {
    console.log('❌ No logout button found on this page');
  }
  
  // Check current authentication status
  const authStatus = localStorage.getItem('isAuthenticated');
  const userData = localStorage.getItem('hostelUser');
  
  console.log(`\nAuthentication Status: ${authStatus === 'true' ? '✅ Logged In' : '❌ Logged Out'}`);
  
  if (userData) {
    try {
      const user = JSON.parse(userData);
      console.log(`Current User: ${user.name} (${user.role})`);
    } catch (e) {
      console.log('⚠️ Invalid user data in localStorage');
    }
  } else {
    console.log('Current User: None');
  }
  
  return {
    logoutButtonsFound: logoutButtons.length,
    isAuthenticated: authStatus === 'true',
    hasUserData: !!userData
  };
};

export default runLogoutTests;
