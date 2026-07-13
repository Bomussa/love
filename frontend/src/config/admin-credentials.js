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
    'reports',
    'clinic_configuration',
    'settings',
    'user_management',
    'activity_logs',
    'backup_export',
    'offline_mode',
    'content_management',
    'appearance',
    'database_management',
  ],

  systemInfo: {
    projectName: 'مشروع 2027',
    version: '2.0.0',
    lastUpdate: '2026-01-17',
  },
};

export function validateAdminCredentials(username, password) {
  if (!username || !password) {
    console.log('[AdminCredentials] ❌ Missing username or password');
    return false;
  }

  if (!ADMIN_CREDENTIALS.username || !ADMIN_CREDENTIALS.password) {
    console.warn('[AdminCredentials] Missing VITE_ADMIN_USERNAME or VITE_ADMIN_PASSWORD');
    return false;
  }

  const inputUsername = username.toLowerCase().trim();
  const expectedUsername = ADMIN_CREDENTIALS.username.toLowerCase();
  const inputPassword = password;
  const expectedPassword = ADMIN_CREDENTIALS.password;

  const isUsernameValid = inputUsername === expectedUsername;
  const isPasswordValid = inputPassword === expectedPassword;

  console.log('[AdminCredentials] Validation attempt:', {
    inputUsername,
    expectedUsername,
    isUsernameValid,
    isPasswordValid,
  });

  return isUsernameValid && isPasswordValid;
}

export function hasPermission(permission) {
  return ADMIN_CREDENTIALS.permissions.includes(permission);
}

export default ADMIN_CREDENTIALS;
