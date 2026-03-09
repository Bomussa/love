/**
 * Admin Credentials Configuration (deprecated)
 *
 * ملاحظة أمنية: تم إلغاء أي بيانات دخول محلية أو منطق تحقق على الواجهة.
 * المصادقة والصلاحيات تُدار حصريًا عبر backend.
 */

export const ADMIN_CREDENTIALS = Object.freeze({
  source: 'backend_only',
  roles: [],
  permissions: [],
});

export function validateAdminCredentials() {
  return false;
}

export function hasPermission() {
  return false;
}

export default ADMIN_CREDENTIALS;
