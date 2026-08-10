/**
 * Input Validation Utilities
 * أدوات التحقق من صحة المدخلات
 *
 * @module validation
 * @description مجموعة شاملة من دوال التحقق من المدخلات لضمان أمان وصحة البيانات
 */

const PATTERNS = {
  MILITARY_ID: /^\d{2,12}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_SA: /^(05|5)\d{8}$/,
  NAME: /^[\u0600-\u06FFa-zA-Z\s]{2,50}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
};

const MESSAGES = Object.freeze({
  ar: {
    militaryRequired: 'الرقم العسكري مطلوب',
    militaryRange: 'يجب أن يتكون الرقم العسكري أو الشخصي من 2 إلى 12 رقمًا',
    militaryDigits: 'الرقم العسكري أو الشخصي يجب أن يحتوي على أرقام فقط',
    genderRequired: 'يرجى اختيار الجنس',
    uuidRequired: 'المعرف مطلوب',
    uuidInvalid: 'معرف غير صالح',
    nameRequired: 'الاسم مطلوب',
    nameShort: 'الاسم قصير جداً',
    nameLong: 'الاسم طويل جداً',
    examInvalid: 'نوع الفحص غير صالح',
    usernameShort: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل',
    passwordShort: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل',
  },
  en: {
    militaryRequired: 'Military or personal number is required',
    militaryRange: 'The military or personal number must contain 2-12 digits',
    militaryDigits: 'The military or personal number must contain digits only',
    genderRequired: 'Please select a gender',
    uuidRequired: 'Identifier is required',
    uuidInvalid: 'Invalid identifier',
    nameRequired: 'Name is required',
    nameShort: 'Name is too short',
    nameLong: 'Name is too long',
    examInvalid: 'Invalid examination type',
    usernameShort: 'Username must contain at least 3 characters',
    passwordShort: 'Password must contain at least 4 characters',
  },
});

function resolveLanguage(language) {
  if (language === 'en' || language === 'ar') return language;
  if (typeof document !== 'undefined') {
    const documentLanguage = String(document.documentElement?.lang || '').toLowerCase();
    if (documentLanguage.startsWith('en') || document.documentElement?.dir === 'ltr') return 'en';
  }
  return 'ar';
}

function messages(language) {
  return MESSAGES[resolveLanguage(language)];
}

export function validateMilitaryId(id, language) {
  const text = messages(language);
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: text.militaryRequired };
  }

  const trimmed = id.trim();
  if (trimmed.length < 2 || trimmed.length > 12) {
    return { isValid: false, error: text.militaryRange };
  }
  if (!PATTERNS.MILITARY_ID.test(trimmed)) {
    return { isValid: false, error: text.militaryDigits };
  }
  return { isValid: true };
}

export function validateGender(gender, language) {
  const validGenders = ['male', 'female', 'ذكر', 'أنثى'];
  const normalized = String(gender || '').toLowerCase();
  if (!gender || !validGenders.includes(normalized)) {
    return { isValid: false, error: messages(language).genderRequired };
  }
  return { isValid: true };
}

export function validateUUID(uuid, language) {
  const text = messages(language);
  if (!uuid || typeof uuid !== 'string') return { isValid: false, error: text.uuidRequired };
  if (!PATTERNS.UUID.test(uuid)) return { isValid: false, error: text.uuidInvalid };
  return { isValid: true };
}

export function validateName(name, language) {
  const text = messages(language);
  if (!name || typeof name !== 'string') return { isValid: false, error: text.nameRequired };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { isValid: false, error: text.nameShort };
  if (trimmed.length > 50) return { isValid: false, error: text.nameLong };
  return { isValid: true };
}

export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .substring(0, 1000);
}

export function validateExamType(examType, language) {
  const validTypes = [
    'recruitment', 'promotion', 'transfer', 'referral', 'contract', 'aviation', 'cooks', 'courses',
    'فحص التجنيد', 'فحص الترفيع', 'فحص النقل', 'فحص التحويل', 'تجديد التعاقد', 'فحص الطيران السنوي', 'فحص الطباخين', 'فحص الدورات الداخلية والخارجية',
  ];
  if (!examType || !validTypes.includes(examType)) {
    return { isValid: false, error: messages(language).examInvalid };
  }
  return { isValid: true };
}

export function validateLoginData(data, language) {
  const errors = [];
  const militaryIdResult = validateMilitaryId(data?.militaryId || data?.patientId, language);
  if (!militaryIdResult.isValid) errors.push(militaryIdResult.error);

  const genderResult = validateGender(data?.gender, language);
  if (!genderResult.isValid) errors.push(genderResult.error);
  return { isValid: errors.length === 0, errors };
}

export function validateAdminData(data, language) {
  const text = messages(language);
  const errors = [];
  if (!data?.username || data.username.length < 3) errors.push(text.usernameShort);
  if (!data?.password || data.password.length < 4) errors.push(text.passwordShort);
  return { isValid: errors.length === 0, errors };
}

export { PATTERNS, MESSAGES };

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
  MESSAGES,
};
