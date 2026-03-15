/**
 * Admin Credentials Configuration
 * تكوين بيانات دخول الإدارة
 *
 * مشروع 2027 - نظام اللجنة الطبية العسكرية
 */

export const ADMIN_CREDENTIALS = {
  // إعدادات العرض في الواجهة فقط (ليست للتحقق الأمني النهائي)
  loginTitle: 'لوحة الإدارة',
  loginSubtitle: 'تسجيل دخول الإدارة',
  defaultRole: 'ADMIN',

  // بيانات إضافية للتحقق
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

  // معلومات النظام
  systemInfo: {
    projectName: 'مشروع 2027',
    version: '2.0.0',
    lastUpdate: '2026-01-17',
  },
};

/**
 * التحقق من الصلاحيات
 * @param {string} permission - الصلاحية المطلوبة
 * @returns {boolean} - هل الصلاحية متاحة
 */
export function hasPermission(permission) {
  return ADMIN_CREDENTIALS.permissions.includes(permission);
}

export default ADMIN_CREDENTIALS;
