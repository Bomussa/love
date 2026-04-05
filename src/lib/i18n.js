const dictionary = {
  welcome: { ar: 'مرحباً بك', en: 'Welcome' },
  personalNumber: { ar: 'الرقم الشخصي', en: 'Personal Number' },
  enterPersonalNumber: { ar: 'أدخل الرقم الشخصي', en: 'Enter personal number' },
  gender: { ar: 'الجنس', en: 'Gender' },
  male: { ar: 'ذكر', en: 'Male' },
  female: { ar: 'أنثى', en: 'Female' },
  loading: { ar: 'جاري التحميل...', en: 'Loading...' },
  yourMedicalRoute: { ar: 'مسارك الطبي', en: 'Your medical route' },
  exam: { ar: 'الفحص', en: 'Exam' },
  floor: { ar: 'الطابق', en: 'Floor' },
  ready: { ar: 'جاهز', en: 'Ready' },
  locked: { ar: 'مغلق', en: 'Locked' },
  current: { ar: 'الحالي', en: 'Current' },
  yourNumber: { ar: 'رقمك', en: 'Your #'},
  ahead: { ar: 'أمامك', en: 'Ahead' },
  enterClinic: { ar: 'دخول العيادة', en: 'Enter clinic' },
  note: { ar: 'ملاحظة', en: 'Note' },
  registerAtReception: { ar: 'يرجى التسجيل لدى الاستقبال', en: 'Please register at reception' },
  exitSystem: { ar: 'خروج', en: 'Exit' },
};

export function t(key, language = 'ar') {
  const entry = dictionary[key];
  if (!entry) return key;
  return language === 'ar' ? entry.ar : entry.en;
}
