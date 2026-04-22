/**
 * Admin Credentials Configuration
 * Environment-driven configuration without hardcoded secrets.
 */

const adminUsername = import.meta.env.VITE_ADMIN_USERNAME;
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

export const ADMIN_CREDENTIALS = {
  username: adminUsername,
  password: adminPassword,

  roles: ['admin', 'super_admin'],
  permissions: [
    'dashboard',
    'queue_management',
    'pin_management',
    'reports',
    'clinic_configuration',
    'settings'
  ],

  systemInfo: {
    projectName: 'مشروع 2027',
    version: '2.0.0',
    lastUpdate: '2025-10-23'
  }
};

export function validateAdminCredentials(username, password) {
  if (!username || !password) return false;

  if (!ADMIN_CREDENTIALS.username || !ADMIN_CREDENTIALS.password) {
    console.warn('[AdminCredentials] Missing ENV variables');
    return false;
  }

  return (
    username.toLowerCase().trim() === ADMIN_CREDENTIALS.username.toLowerCase() &&
    password === ADMIN_CREDENTIALS.password
  );
}

export function hasPermission(permission) {
  return ADMIN_CREDENTIALS.permissions.includes(permission);
}

export default ADMIN_CREDENTIALS;
