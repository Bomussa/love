const translations = {
  ar: {
    welcome: 'مرحباً بك',
    personalNumber: 'الرقم الشخصي',
    enterPersonalNumber: 'أدخل الرقم الشخصي',
    gender: 'النوع',
    male: 'ذكر',
    female: 'أنثى',
    loading: 'جاري التحميل...',
    yourMedicalRoute: 'مسارك الطبي',
    exam: 'الفحص',
    floor: 'الطابق',
    ready: 'جاهز',
    locked: 'مغلق',
    current: 'الحالي',
    yourNumber: 'رقمك',
    ahead: 'أمامك',
    enterClinic: 'الدخول للعيادة',
    note: 'ملاحظة',
    registerAtReception: 'يرجى المراجعة في الاستقبال',
    exitSystem: 'الخروج من النظام',
  },
  en: {
    welcome: 'Welcome',
    personalNumber: 'Personal Number',
    enterPersonalNumber: 'Enter personal number',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    loading: 'Loading...',
    yourMedicalRoute: 'Your Medical Route',
    exam: 'Exam',
    floor: 'Floor',
    ready: 'Ready',
    locked: 'Locked',
    current: 'Current',
    yourNumber: 'Your Number',
    ahead: 'Ahead',
    enterClinic: 'Enter Clinic',
    note: 'Note',
    registerAtReception: 'Please register at reception',
    exitSystem: 'Exit System',
  }
};

export function t(key, language = 'ar') {
  return translations?.[language]?.[key] ?? translations.ar?.[key] ?? key;
}

export default t;
