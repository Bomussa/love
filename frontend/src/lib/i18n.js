// Internationalization (i18n) support for Arabic and English

export const translations = {
  ar: {
    // Login Page
    welcome: 'مرحباً بك في نظام اللجنة الطبية',
    personalNumber: 'الرقم الشخصي / العسكري',
    enterPersonalNumber: 'أدخل الرقم الشخصي أو العسكري',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    confirm: 'تأكيد',
    
    // Exam Selection
    selectExamType: 'اختر نوع الفحص',
    recruitmentExam: 'فحص التجنيد',
    promotionExam: 'فحص الترفيع',
    transferExam: 'فحص النقل',
    referralExam: 'فحص التحويل',
    contractRenewal: 'تجديد التعاقد',
    aviationExam: 'فحص الطيران السنوي',
    cooksExam: 'فحص الطباخين',
    coursesExam: 'فحص الدورات الداخلية والخارجية',
    
    // Patient Page
    yourMedicalRoute: 'مسارك الطبي',
    exam: 'الفحص',
    ready: 'جاهز',
    locked: 'مقفل',
    completed: 'مكتمل',
    ahead: 'أمامك',
    yourNumber: 'رقمك',
    current: 'الحالي',
    floor: 'الطابق',
    unlock: 'فتح',
    exitSystem: 'الخروج من النظام',
    enterPIN: 'أدخل رقم PIN',
  enterClinic: 'دخول العيادة',
  exitClinic: 'الخروج من العيادة',
  ticketNumber: 'رقم الدور',
    
    // Clinics
    laboratory: 'المختبر',
    laboratoryRadiology: 'المختبر والأشعة',
    vitalSigns: 'القياسات الحيوية',
    ophthalmology: 'عيادة العيون',
    internalMedicine: 'عيادة الباطنية',
    generalSurgery: 'عيادة الجراحة العامة',
    orthopedics: 'عيادة العظام والمفاصل',
    ent: 'عيادة أنف وأذن وحنجرة',
    psychology: 'عيادة النفسية',
    dental: 'عيادة الأسنان',
    ecg: 'عيادة تخطيط القلب',
    audiology: 'عيادة السمع',
    dermatology: 'عيادة الجلدية',
    
    // Floors
    mezzanine: 'الميزانين',
    floor2: 'الطابق الثاني',
    floor3: 'الطابق الثالث',
    
    // Notifications
    patientCalled: 'تم استدعاء المريض',
    yourTurn: 'حان دورك!',
    pleaseGoTo: 'يرجى التوجه إلى',
    queueUpdated: 'تم تحديث قائمة الانتظار',
    stationUnlocked: 'تم فتح العيادة',
    invalidPIN: 'رقم PIN غير صحيح',
    loginSuccess: 'تم تسجيل الدخول بنجاح',
    loginFailed: 'فشل تسجيل الدخول',
    examSelected: 'تم اختيار نوع الفحص',
    
    // Admin
    dashboard: 'لوحة التحكم',
    queueManagement: 'إدارة قائمة الانتظار',
    reports: 'التقارير',
    settings: 'الإعدادات',
    pinManagement: 'إدارة PIN',
    callNext: 'استدعاء التالي',
    pauseQueue: 'إيقاف مؤقت',
    resumeQueue: 'استئناف',
    totalPatients: 'إجمالي المرضى',
    waiting: 'في الانتظار',
    completed: 'مكتمل',
    avgWaitTime: 'متوسط وقت الانتظار',
    noReports: 'لا توجد تقارير متاحة',
    
    // Themes
    classic: 'كلاسيكي',
    mintMedical: 'طبي نعناعي',
    militaryNavy: 'بحري عسكري',
    desertGold: 'ذهبي صحراوي',
    medicalRose: 'وردي طبي',
    nightShift: 'المناوبة الليلية',
    
    // Messages
    note: 'ملاحظة',
    registerAtReception: 'يجب التسجيل من استقبال العطار'
  },
  
  en: {
    // Login Page
    welcome: 'Welcome to the Medical Committee System',
    personalNumber: 'Personal / Military Number',
    enterPersonalNumber: 'Enter Personal or Military Number',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    confirm: 'Confirm',
    
    // Exam Selection
    selectExamType: 'Select Exam Type',
    recruitmentExam: 'Recruitment Exam',
    promotionExam: 'Promotion Exam',
    transferExam: 'Transfer Exam',
    referralExam: 'Referral Exam',
    contractRenewal: 'Contract Renewal',
    aviationExam: 'Aviation Annual Exam',
    cooksExam: 'Cooks Exam',
    coursesExam: 'Internal & External Courses',
    
    // Patient Page
    yourMedicalRoute: 'Your Medical Route',
    exam: 'Exam',
    ready: 'Ready',
    locked: 'Locked',
    completed: 'Completed',
    ahead: 'Ahead',
    yourNumber: 'Your Number',
    current: 'Current',
    floor: 'Floor',
    unlock: 'Unlock',
    exitSystem: 'Exit System',
    enterPIN: 'Enter PIN',
  enterClinic: 'Enter Clinic',
  exitClinic: 'Exit Clinic',
  ticketNumber: 'Ticket Number',
    
    // Clinics
    laboratory: 'Laboratory',
    laboratoryRadiology: 'Laboratory & Radiology',
    vitalSigns: 'Vital Signs',
    ophthalmology: 'Ophthalmology',
    internalMedicine: 'Internal Medicine',
    generalSurgery: 'General Surgery',
    orthopedics: 'Orthopedics',
    ent: 'ENT',
    psychology: 'Psychology',
    dental: 'Dental',
    ecg: 'ECG',
    audiology: 'Audiology',
    dermatology: 'Dermatology',
    
    // Floors
    mezzanine: 'Mezzanine Floor',
    floor2: 'Floor 2',
    floor3: 'Floor 3',
    
    // Notifications
    patientCalled: 'Patient Called',
    yourTurn: 'Your Turn!',
    pleaseGoTo: 'Please go to',
    queueUpdated: 'Queue Updated',
    stationUnlocked: 'Station Unlocked',
    invalidPIN: 'Invalid PIN',
    loginSuccess: 'Login Successful',
    loginFailed: 'Login Failed',
    examSelected: 'Exam Type Selected',
    
    // Admin
    dashboard: 'Dashboard',
    queueManagement: 'Queue Management',
    reports: 'Reports',
    settings: 'Settings',
    pinManagement: 'PIN Management',
    callNext: 'Call Next',
    pauseQueue: 'Pause Queue',
    resumeQueue: 'Resume Queue',
    totalPatients: 'Total Patients',
    waiting: 'Waiting',
    completed: 'Completed',
    avgWaitTime: 'Avg Wait Time',
    noReports: 'No reports available',
    
    // Themes
    classic: 'Classic',
    mintMedical: 'Mint Medical',
    militaryNavy: 'Military Navy',
    desertGold: 'Desert Gold',
    medicalRose: 'Medical Rose',
    nightShift: 'Night Shift',
    
    // Messages
    note: 'Note',
    registerAtReception: 'Must register at Al-Attar reception'
  }
}

// Get translation based on language
export function t(key, lang = 'ar') {
  return translations[lang]?.[key] || translations['ar'][key] || key
}

// Get current language from localStorage or default to Arabic
export function getCurrentLanguage() {
  return localStorage.getItem('language') || 'ar'
}

// Set current language
export function setCurrentLanguage(lang) {
  localStorage.setItem('language', lang)
  // Update document direction
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}
