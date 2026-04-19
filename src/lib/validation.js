/**
 * @file validation.js
 * @description التحقق من صحة المدخلات
 */

export function sanitizeInput(str) {
  if (!str) return '';
  return String(str).trim().replace(/[<>"']/g, '');
}

export function validateMilitaryId(id) {
  if (!id || id.trim().length < 1) {
    return { isValid: false, error: 'يرجى إدخال الرقم العسكري' };
  }
  return { isValid: true };
}

export function validateAdminData({ username, password }) {
  const errors = [];
  if (!username || username.trim().length < 2) errors.push('اسم المستخدم مطلوب');
  if (!password || password.trim().length < 3) errors.push('كلمة المرور مطلوبة');
  return { isValid: errors.length === 0, errors };
}
