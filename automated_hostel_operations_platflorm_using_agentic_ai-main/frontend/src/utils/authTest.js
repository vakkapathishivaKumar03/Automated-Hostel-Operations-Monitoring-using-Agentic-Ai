/**
 * Authentication & Authorization Test Suite
 * 
 * This file contains tests to verify route protection works correctly.
 * Run these tests in browser console to verify security implementation.
 */

import { isAuthenticated, getUserRole, hasAnyRole, getDashboardPath, getCurrentUser } from './auth';

/**
 * Test Suite: Authentication & Route Protection
 */
export const runAuthTests = () => {
  console.log('🧪 Running Authentication & Authorization Tests...\n');

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

  // Test 1: Check unauthenticated state
  test('Unauthenticated user detection', () => {
    localStorage.removeItem('hostelUser');
    localStorage.removeItem('isAuthenticated');
    return !isAuthenticated();
  });

  // Test 2: Check authenticated state
  test('Authenticated user detection', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test User', role: 'student' }));
    localStorage.setItem('isAuthenticated', 'true');
    return isAuthenticated();
  });

  // Test 3: Get user role - student
  test('Get student role', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test Student', role: 'student' }));
    return getUserRole() === 'student';
  });

  // Test 4: Get user role - warden
  test('Get warden role', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 2, name: 'Test Warden', role: 'warden' }));
    return getUserRole() === 'warden';
  });

  // Test 5: Get user role - admin
  test('Get admin role', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 3, name: 'Test Admin', role: 'admin' }));
    return getUserRole() === 'admin';
  });

  // Test 6: Get user role - technician
  test('Get technician role', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 4, name: 'Test Tech', role: 'technician' }));
    return getUserRole() === 'technician';
  });

  // Test 7: Get user role - security
  test('Get security role', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 5, name: 'Test Security', role: 'security' }));
    return getUserRole() === 'security';
  });

  // Test 8: Role validation - has any role
  test('Role validation - hasAnyRole (positive)', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test Student', role: 'student' }));
    return hasAnyRole(['student', 'warden']);
  });

  // Test 9: Role validation - has any role (negative)
  test('Role validation - hasAnyRole (negative)', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test Student', role: 'student' }));
    return !hasAnyRole(['warden', 'admin']);
  });

  // Test 10: Dashboard path - student
  test('Dashboard path for student', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 1, name: 'Test Student', role: 'student' }));
    return getDashboardPath() === '/student/dashboard';
  });

  // Test 11: Dashboard path - warden
  test('Dashboard path for warden', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 2, name: 'Test Warden', role: 'warden' }));
    return getDashboardPath() === '/warden/dashboard';
  });

  // Test 12: Dashboard path - admin
  test('Dashboard path for admin', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 3, name: 'Test Admin', role: 'admin' }));
    return getDashboardPath() === '/admin/dashboard';
  });

  // Test 13: Dashboard path - technician
  test('Dashboard path for technician', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 4, name: 'Test Tech', role: 'technician' }));
    return getDashboardPath() === '/technician/dashboard';
  });

  // Test 14: Dashboard path - security
  test('Dashboard path for security', () => {
    localStorage.setItem('hostelUser', JSON.stringify({ userId: 5, name: 'Test Security', role: 'security' }));
    return getDashboardPath() === '/security/dashboard';
  });

  // Test 15: getCurrentUser returns correct object
  test('getCurrentUser returns valid user object', () => {
    const testUser = { userId: 1, name: 'Test User', role: 'student' };
    localStorage.setItem('hostelUser', JSON.stringify(testUser));
    const user = getCurrentUser();
    return user && user.userId === 1 && user.name === 'Test User' && user.role === 'student';
  });

  // Summary
  console.log('\n📊 Test Results:');
  console.log(`Total: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Authentication system is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
  }

  return results;
};

/**
 * Manual test scenarios to verify route protection
 */
export const manualTestScenarios = [
  {
    scenario: 'Unauthenticated User Access',
    steps: [
      '1. Clear localStorage (logout)',
      '2. Try to access /student/dashboard',
      '3. Should redirect to /login'
    ],
    expected: 'User redirected to login page'
  },
  {
    scenario: 'Student accessing Admin Dashboard',
    steps: [
      '1. Login as student',
      '2. Try to access /admin/dashboard directly via URL',
      '3. Should redirect to /student/dashboard'
    ],
    expected: 'User redirected to their own dashboard'
  },
  {
    scenario: 'Warden accessing Student Dashboard',
    steps: [
      '1. Login as warden',
      '2. Try to access /student/dashboard directly via URL',
      '3. Should redirect to /warden/dashboard'
    ],
    expected: 'User redirected to their own dashboard'
  },
  {
    scenario: 'Page Refresh',
    steps: [
      '1. Login as any user',
      '2. Navigate to their dashboard',
      '3. Refresh the page (F5)',
      '4. Should remain on dashboard'
    ],
    expected: 'User stays authenticated after refresh'
  },
  {
    scenario: 'Direct URL Access',
    steps: [
      '1. Login as student',
      '2. Type /technician/dashboard in browser address bar',
      '3. Should redirect to /student/dashboard'
    ],
    expected: 'User prevented from accessing unauthorized routes'
  }
];

export default runAuthTests;
