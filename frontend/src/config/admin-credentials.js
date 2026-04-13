/**
 * Admin Credentials Configuration
 * تكوين بيانات دخول الإدارة
 *
 * مشروع 2027 - نظام اللجنة الطبية العسكرية
 */

// ✅ إصلاح: بيانات الدخول الرئيسية - السوبر أدمن (مضمونة للعمل)
const HARDCODED_USERNAME = 'Bomussa';
const HARDCODED_PASSWORD = '14490';

export const ADMIN_CREDENTIALS = {
  // بيانات الدخول الرئيسية - السوبر أدمن
  // ✅ إصلاح: استخدام القيم المضمونة أولاً، ثم متغيرات البيئة كاحتياط
  username: HARDCODED_USERNAME,
  password: HARDCODED_PASSWORD,

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
 * التحقق من بيانات الدخول
 * اسم المستخدم غير حساس لحالة الأحرف (case-insensitive)
 * كلمة المرور حساسة لحالة الأحرف (case-sensitive)
 * @param {string} username - اسم المستخدم
 * @param {string} password - كلمة المرور
 * @returns {boolean} - نتيجة التحقق
 */
export function validateAdminCredentials(username, password) {
  if (!username || !password) {
    console.log('[AdminCredentials] ❌ Missing username or password');
    return false;
  }

  // ✅ إصلاح: اسم المستخدم غير حساس لحالة الأحرف
  const inputUsername = username.toLowerCase().trim();
  const expectedUsername = ADMIN_CREDENTIALS.username.toLowerCase();

  // ✅ إصلاح: كلمة المرور حساسة لحالة الأحرف (بدون trim)
  const inputPassword = password;
  const expectedPassword = ADMIN_CREDENTIALS.password;

  const isUsernameValid = inputUsername === expectedUsername;
  const isPasswordValid = inputPassword === expectedPassword;

  console.log('[AdminCredentials] Validation attempt:', {
    inputUsername,
    expectedUsername,
    isUsernameValid,
    isPasswordValid
  });

  return isUsernameValid && isPasswordValid;
}

/**
 * التحقق من الصلاحيات
 * @param {string} permission - الصلاحية المطلوبة
 * @returns {boolean} - هل الصلاحية متاحة
 */
export function hasPermission(permission) {
  return ADMIN_CREDENTIALS.permissions.includes(permission);
}

export default ADMIN_CREDENTIALS;
