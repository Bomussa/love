/**
 * Admin Credentials Configuration
 * تكوين بيانات دخول الإدارة
 * 
 * مشروع 2027 - نظام اللجنة الطبية العسكرية
 */

export const ADMIN_CREDENTIALS = {
  // بيانات الدخول الرئيسية
  username: 'admin',
  password: 'BOMUSSA14490',
  
  // بيانات إضافية للتحقق
  roles: ['admin', 'super_admin'],
  permissions: [
    'dashboard',
    'queue_management',
    'pin_management',
    'reports',
    'clinic_configuration',
    'settings'
  ],
  
  // معلومات النظام
  systemInfo: {
    projectName: 'مشروع 2027',
    version: '2.0.0',
    lastUpdate: '2025-10-23'
  }
}

/**
 * التحقق من بيانات الدخول
 * @param {string} username - اسم المستخدم
 * @param {string} password - كلمة المرور
 * @returns {boolean} - نتيجة التحقق
 */
export function validateAdminCredentials(username, password) {
  return username === ADMIN_CREDENTIALS.username && 
         password === ADMIN_CREDENTIALS.password
}

/**
 * التحقق من الصلاحيات
 * @param {string} permission - الصلاحية المطلوبة
 * @returns {boolean} - هل الصلاحية متاحة
 */
export function hasPermission(permission) {
  return ADMIN_CREDENTIALS.permissions.includes(permission)
}

export default ADMIN_CREDENTIALS

