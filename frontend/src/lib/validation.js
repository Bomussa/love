/**
 * Input Validation Utilities
 * أدوات التحقق من صحة المدخلات
 *
 * @module validation
 * @description مجموعة شاملة من دوال التحقق من المدخلات لضمان أمان وصحة البيانات
 */

// ============================================================================
// Regular Expressions - التعبيرات النمطية
// ============================================================================

const PATTERNS = {
  // الرقم العسكري: 2-12 رقم
  MILITARY_ID: /^\d{2,12}$/,


  // البريد الإلكتروني
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // رقم الهاتف السعودي
  PHONE_SA: /^(05|5)\d{8}$/,

  // اسم (عربي أو إنجليزي)
  NAME: /^[\u0600-\u06FFa-zA-Z\s]{2,50}$/,

  // UUID
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // تاريخ ISO
  ISO_DATE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
};

// ============================================================================
// Validation Functions - دوال التحقق
// ============================================================================

/**
 * التحقق من الرقم العسكري
 * @param {string} id - الرقم العسكري
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateMilitaryId(id) {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: 'الرقم العسكري مطلوب' };
  }

  const trimmed = id.trim();

  if (trimmed.length < 2) {
    return { isValid: false, error: 'الرقم العسكري قصير جداً (الحد الأدنى 2 أرقام)' };
  }

  if (trimmed.length > 12) {
    return { isValid: false, error: 'الرقم العسكري طويل جداً (الحد الأقصى 12 رقم)' };
  }

  if (!PATTERNS.MILITARY_ID.test(trimmed)) {
    return { isValid: false, error: 'الرقم العسكري يجب أن يحتوي على أرقام فقط' };
  }

  return { isValid: true };
}

/**
 * التحقق من الرقم السري - تم إزالته
 */
export function validatePIN(pin) {
  return { isValid: true };
}

/**
 * التحقق من الجنس
 * @param {string} gender - الجنس
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateGender(gender) {
  const validGenders = ['male', 'female', 'ذكر', 'أنثى'];

  if (!gender || !validGenders.includes(gender.toLowerCase())) {
    return { isValid: false, error: 'يرجى اختيار الجنس' };
  }

  return { isValid: true };
}

/**
 * التحقق من UUID
 * @param {string} uuid - المعرف الفريد
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return { isValid: false, error: 'المعرف مطلوب' };
  }

  if (!PATTERNS.UUID.test(uuid)) {
    return { isValid: false, error: 'معرف غير صالح' };
  }

  return { isValid: true };
}

/**
 * التحقق من الاسم
 * @param {string} name - الاسم
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'الاسم مطلوب' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { isValid: false, error: 'الاسم قصير جداً' };
  }

  if (trimmed.length > 50) {
    return { isValid: false, error: 'الاسم طويل جداً' };
  }

  return { isValid: true };
}

/**
 * تنظيف المدخلات من الأحرف الخطرة
 * @param {string} input - المدخل
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // إزالة علامات HTML
    .replace(/javascript:/gi, '') // إزالة JavaScript URLs
    .replace(/on\w+=/gi, '') // إزالة event handlers
    .substring(0, 1000); // تحديد الطول الأقصى
}

/**
 * التحقق من صحة نوع الفحص
 * @param {string} examType - نوع الفحص
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateExamType(examType) {
  const validTypes = [
    'comprehensive', 'periodic', 'initial', 'specialized',
    'شامل', 'دوري', 'أولي', 'تخصصي',
  ];

  if (!examType || !validTypes.includes(examType)) {
    return { isValid: false, error: 'نوع الفحص غير صالح' };
  }

  return { isValid: true };
}

/**
 * التحقق الشامل من بيانات تسجيل الدخول
 * @param {Object} data - بيانات تسجيل الدخول
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateLoginData(data) {
  const errors = [];

  const militaryIdResult = validateMilitaryId(data?.militaryId || data?.patientId);
  if (!militaryIdResult.isValid) {
    errors.push(militaryIdResult.error);
  }

  const genderResult = validateGender(data?.gender);
  if (!genderResult.isValid) {
    errors.push(genderResult.error);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * التحقق من بيانات الإدارة
 * @param {Object} data - بيانات الإدارة
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateAdminData(data) {
  const errors = [];

  if (!data?.username || data.username.length < 3) {
    errors.push('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
  }

  if (!data?.password || data.password.length < 4) {
    errors.push('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// تصدير الأنماط للاستخدام الخارجي
export { PATTERNS };

export default {
  validateMilitaryId,
  validateGender,
  validateUUID,
  validateName,
  validateExamType,
  validateLoginData,
  validateAdminData,
  sanitizeInput,
  PATTERNS,
};
