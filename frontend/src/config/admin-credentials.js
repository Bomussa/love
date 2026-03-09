/**
 * Admin UI Roles/Permissions Configuration
 * تكوين صلاحيات واجهة الإدارة فقط (بدون أسرار مصادقة)
 */

export const ADMIN_CREDENTIALS = {
  roles: ['admin', 'super_admin'],
  permissions: [
    'dashboard',
    'queue_management',
    'pin_management',
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
    version: '2.1.0',
    lastUpdate: '2026-03-09',
  },
};

/**
 * Deprecated: لا يتم التحقق من كلمة المرور داخل الواجهة إطلاقاً.
 * تم الإبقاء على الدالة للتوافق فقط.
 */
export function validateAdminCredentials() {
  return false;
}

export function hasPermission(permission) {
  return ADMIN_CREDENTIALS.permissions.includes(permission);
}

export default ADMIN_CREDENTIALS;
