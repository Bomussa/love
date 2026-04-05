const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeNumerals(input = '') {
  return String(input)
    .split('')
    .map((ch) => {
      const idxArabic = ARABIC_INDIC.indexOf(ch);
      if (idxArabic >= 0) return String(idxArabic);
      const idxEastern = EASTERN_ARABIC.indexOf(ch);
      if (idxEastern >= 0) return String(idxEastern);
      return ch;
    })
    .join('');
}

export function sanitizeInput(value = '') {
  return String(value).replace(/[<>"'`;]/g, '').trim();
}

export function validateMilitaryId(value) {
  const normalized = normalizeNumerals(sanitizeInput(value));
  if (!normalized) return { isValid: false, error: 'الرقم العسكري مطلوب' };
  if (!/^\d+$/.test(normalized)) return { isValid: false, error: 'الرقم العسكري يجب أن يحتوي على أرقام فقط' };
  if (normalized.length < 2) return { isValid: false, error: 'الرقم العسكري يجب أن يكون رقمين على الأقل' };
  if (normalized.length > 12) return { isValid: false, error: 'الرقم العسكري يجب أن لا يتجاوز 12 رقماً' };
  return { isValid: true };
}

export function validateAdminData({ username, password }) {
  const errors = [];
  if (!sanitizeInput(username) || sanitizeInput(username).length < 3) {
    errors.push('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
  }
  if (!String(password || '').trim() || String(password || '').trim().length < 4) {
    errors.push('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
  }
  return { isValid: errors.length === 0, errors };
}
