// مصدر الحقيقة الوحيد للـ clinics

export const CLINICS = {
  VITALS: 'BIO',
  LAB: 'LAB',
  XRAY: 'XR',
  EYES: 'EYE',
  INTERNAL: 'INT',
  SURGERY: 'SUR',
  ENT: 'ENT',
  PSYCHIATRY: 'PSY',
  DENTAL: 'DNT',
  DERMATOLOGY: 'DER',
  ECG: 'ECG',
  AUDIOLOGY: 'AUD',
  NEUROLOGY: 'NEURO'
};

export const CLINIC_FLOW = {
  // Recruitment exams
  recruitment_male: ['BIO', 'LAB', 'XR', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  recruitment_female: ['BIO', 'LAB', 'XR', 'F_EYE', 'F_INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  
  // Periodic exams
  periodic_male: ['BIO', 'LAB', 'XR', 'EYE', 'INT'],
  periodic_female: ['BIO', 'LAB', 'XR', 'F_EYE', 'F_INT'],
  
  // Employment exams
  employment_male: ['BIO', 'LAB', 'XR', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  employment_female: ['BIO', 'LAB', 'XR', 'F_EYE', 'F_INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  
  // Travel exams
  travel_male: ['BIO', 'LAB', 'XR', 'EYE', 'INT'],
  travel_female: ['BIO', 'LAB', 'XR', 'F_EYE', 'F_INT'],
  
  // Catering exams
  catering_male: ['BIO', 'LAB', 'XR', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  catering_female: ['BIO', 'LAB', 'XR', 'F_EYE', 'F_INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  
  // Scholarship exams
  scholarship_male: ['BIO', 'LAB', 'XR', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT'],
  scholarship_female: ['BIO', 'LAB', 'XR', 'F_EYE', 'F_INT', 'SUR', 'ENT', 'PSY', 'DNT']
};

// Exam type names
export const EXAM_TYPES = {
  recruitment: { ar: 'فحص التجنيد', en: 'Recruitment Exam' },
  periodic: { ar: 'فحص دوري', en: 'Periodic Exam' },
  employment: { ar: 'فحص التوظيف', en: 'Employment Exam' },
  travel: { ar: 'فحص السفر', en: 'Travel Exam' },
  catering: { ar: 'فحص الإعاشة', en: 'Catering Exam' },
  scholarship: { ar: 'فحص المنحة الدراسية', en: 'Scholarship Exam' }
};

// Clinic names
export const CLINIC_NAMES = {
  BIO: { ar: 'القياسات الحيوية', en: 'Biometrics' },
  LAB: { ar: 'المختبر', en: 'Laboratory' },
  XR: { ar: 'الأشعة', en: 'Radiology' },
  EYE: { ar: 'العيون (رجال)', en: 'Ophthalmology (Men)' },
  F_EYE: { ar: 'العيون (نساء)', en: 'Ophthalmology (Women)' },
  INT: { ar: 'الباطنية (رجال)', en: 'Internal Medicine (Men)' },
  F_INT: { ar: 'الباطنية (نساء)', en: 'Internal Medicine (Women)' },
  SUR: { ar: 'الجراحة', en: 'Surgery' },
  ENT: { ar: 'أنف وأذن وحنجرة', en: 'ENT' },
  PSY: { ar: 'الطب النفسي', en: 'Psychiatry' },
  DNT: { ar: 'الأسنان', en: 'Dentistry' },
  DER: { ar: 'الجلدية', en: 'Dermatology' },
  F_DER: { ar: 'الجلدية (نساء)', en: 'Dermatology (Women)' },
  ECG: { ar: 'تخطيط القلب', en: 'ECG' },
  AUD: { ar: 'السمعيات', en: 'Audiology' },
  NEURO: { ar: 'الأعصاب', en: 'Neurology' }
};
