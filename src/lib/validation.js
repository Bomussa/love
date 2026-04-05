export function normalizeNumerals(value = '') {
  return String(value)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

export function sanitizeInput(value = '') {
  return String(value).trim().replace(/[<>]/g, '');
}

export function validateMilitaryId(rawValue) {
  const value = normalizeNumerals(sanitizeInput(rawValue));
  if (!value) {
    return { isValid: false, error: 'Military ID is required' };
  }
  if (!/^\d{4,20}$/.test(value)) {
    return { isValid: false, error: 'Military ID must be 4-20 digits' };
  }
  return { isValid: true, normalized: value };
}

export function validateAdminData({ username = '', password = '' }) {
  const errors = [];
  if (!sanitizeInput(username)) errors.push('Username is required');
  if (!String(password).trim()) errors.push('Password is required');
  return { isValid: errors.length === 0, errors };
}
