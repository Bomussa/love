// Internationalization (i18n) support for Arabic and English
// Professional translations following international medical standards

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
    promotionExam: 'فحص الترقية',
    transferExam: 'فحص النقل',
    referralExam: 'فحص التحويل',
    contractRenewal: 'تجديد العقد',
    aviationExam: 'الفحص الطبي للطيران',
    cooksExam: 'فحص العاملين بالتغذية',
    coursesExam: 'فحص الدورات التدريبية',
    
    // Patient Page
    yourMedicalRoute: 'مسارك الطبي',
    exam: 'الفحص',
    ready: 'جاهز',
    locked: 'مغلق',
    completed: 'مكتمل',
    ahead: 'أمامك',
    yourNumber: 'رقمك',
    current: 'الحالي',
    floor: 'الطابق',
    unlock: 'فتح',
    exitSystem: 'خروج',
    enterPIN: 'أدخل رقم الدور',
    enterClinic: 'دخول العيادة',
    exitClinic: 'خروج من العيادة',
    ticketNumber: 'رقم الدور',
    
    // Clinics
    laboratory: 'المختبر',
    laboratoryRadiology: 'المختبر والأشعة',
    vitalSigns: 'العلامات الحيوية',
    ophthalmology: 'العيون',
    internalMedicine: 'الباطنية',
    generalSurgery: 'الجراحة العامة',
    orthopedics: 'العظام',
    ent: 'الأنف والأذن والحنجرة',
    psychology: 'الطب النفسي',
    dental: 'الأسنان',
    ecg: 'تخطيط القلب',
    audiology: 'السمعيات',
    dermatology: 'الجلدية',
    
    // Floors
    mezzanine: 'الميزانين',
    floor1: 'الطابق الأول',
    floor2: 'الطابق الثاني',
    floor3: 'الطابق الثالث',
    
    // Notifications
    patientCalled: 'تم استدعاء المريض',
    yourTurn: 'دورك الآن',
    pleaseGoTo: 'يرجى التوجه إلى',
    queueUpdated: 'تم تحديث الطابور',
    stationUnlocked: 'تم فتح العيادة',
    invalidPIN: 'رقم الدور غير صحيح',
    loginSuccess: 'تم تسجيل الدخول بنجاح',
    loginFailed: 'فشل تسجيل الدخول',
    examSelected: 'تم اختيار نوع الفحص',
    
    // Admin
    dashboard: 'لوحة التحكم',
    queueManagement: 'إدارة الطوابير',
    reports: 'التقارير',
    settings: 'الإعدادات',
    pinManagement: 'إدارة أرقام الدور',
    callNext: 'استدعاء التالي',
    pauseQueue: 'إيقاف مؤقت',
    resumeQueue: 'استئناف',
    totalPatients: 'إجمالي المرضى',
    waiting: 'في الانتظار',
    inProgress: 'قيد الفحص',
    avgWaitTime: 'متوسط وقت الانتظار',
    noReports: 'لا توجد تقارير',
    logout: 'تسجيل الخروج',
    home: 'الرئيسية',
    
    // Statistics
    todayPatients: 'مرضى اليوم',
    weekPatients: 'مرضى الأسبوع',
    monthPatients: 'مرضى الشهر',
    completionRate: 'نسبة الإنجاز',
    
    // Users Management
    users: 'المستخدمون',
    permissions: 'الصلاحيات',
    addUser: 'إضافة مستخدم',
    editUser: 'تعديل مستخدم',
    deleteUser: 'حذف مستخدم',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    role: 'الصلاحية',
    admin: 'مدير النظام',
    supervisor: 'مشرف',
    operator: 'مشغل',
    viewer: 'مشاهد',
    active: 'نشط',
    inactive: 'غير نشط',
    
    // Actions
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    refresh: 'تحديث',
    print: 'طباعة',
    export: 'تصدير',
    search: 'بحث',
    filter: 'تصفية',
    
    // Status
    status: 'الحالة',
    enabled: 'مفعل',
    disabled: 'معطل',
    online: 'متصل',
    offline: 'غير متصل',
    
    // Time
    minutes: 'دقيقة',
    hours: 'ساعة',
    today: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    
    // Themes
    classic: 'كلاسيكي',
    mintMedical: 'طبي نعناعي',
    militaryNavy: 'بحري عسكري',
    desertGold: 'ذهبي صحراوي',
    medicalRose: 'وردي طبي',
    nightShift: 'المناوبة الليلية',
    
    // Messages
    note: 'ملاحظة',
    registerAtReception: 'يجب التسجيل من استقبال العطار',
    noData: 'لا توجد بيانات',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    success: 'تمت العملية بنجاح',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    
    // Medical Committee
    militaryMedicalCommittee: 'اللجنة الطبية العسكرية',
    medicalServicesCommand: 'قيادة الخدمات الطبية العسكرية',
    specializedMedicalCenter: 'المركز الطبي التخصصي العسكري - العطار'
  },
  
  en: {
    // Login Page
    welcome: 'Welcome to Medical Committee System',
    personalNumber: 'Personal / Military ID',
    enterPersonalNumber: 'Enter Personal or Military ID',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    confirm: 'Confirm',
    
    // Exam Selection
    selectExamType: 'Select Examination Type',
    recruitmentExam: 'Recruitment Medical Exam',
    promotionExam: 'Promotion Medical Exam',
    transferExam: 'Transfer Medical Exam',
    referralExam: 'Referral Medical Exam',
    contractRenewal: 'Contract Renewal Exam',
    aviationExam: 'Aviation Medical Exam',
    cooksExam: 'Food Handlers Medical Exam',
    coursesExam: 'Training Courses Medical Exam',
    
    // Patient Page
    yourMedicalRoute: 'Your Medical Pathway',
    exam: 'Examination',
    ready: 'Ready',
    locked: 'Locked',
    completed: 'Completed',
    ahead: 'Ahead',
    yourNumber: 'Your Number',
    current: 'Current',
    floor: 'Floor',
    unlock: 'Unlock',
    exitSystem: 'Exit',
    enterPIN: 'Enter PIN Code',
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
    ent: 'ENT (Ear, Nose & Throat)',
    psychology: 'Psychiatry',
    dental: 'Dental',
    ecg: 'ECG (Electrocardiogram)',
    audiology: 'Audiology',
    dermatology: 'Dermatology',
    
    // Floors
    mezzanine: 'Mezzanine',
    floor1: 'First Floor',
    floor2: 'Second Floor',
    floor3: 'Third Floor',
    
    // Notifications
    patientCalled: 'Patient Called',
    yourTurn: 'It\'s Your Turn',
    pleaseGoTo: 'Please proceed to',
    queueUpdated: 'Queue Updated',
    stationUnlocked: 'Clinic Unlocked',
    invalidPIN: 'Invalid Ticket Number',
    loginSuccess: 'Login Successful',
    loginFailed: 'Login Failed',
    examSelected: 'Examination Type Selected',
    
    // Admin
    dashboard: 'Dashboard',
    queueManagement: 'Queue Management',
    reports: 'Reports',
    settings: 'Settings',
    pinManagement: 'PIN Management',
    callNext: 'Call Next',
    pauseQueue: 'Pause',
    resumeQueue: 'Resume',
    totalPatients: 'Total Patients',
    waiting: 'Waiting',
    inProgress: 'In Progress',
    avgWaitTime: 'Avg. Wait Time',
    noReports: 'No Reports Available',
    logout: 'Logout',
    home: 'Home',
    
    // Statistics
    todayPatients: 'Today\'s Patients',
    weekPatients: 'This Week',
    monthPatients: 'This Month',
    completionRate: 'Completion Rate',
    
    // Users Management
    users: 'Users',
    permissions: 'Permissions',
    addUser: 'Add User',
    editUser: 'Edit User',
    deleteUser: 'Delete User',
    username: 'Username',
    password: 'Password',
    role: 'Role',
    admin: 'System Administrator',
    supervisor: 'Supervisor',
    operator: 'Operator',
    viewer: 'Viewer',
    active: 'Active',
    inactive: 'Inactive',
    
    // Actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    refresh: 'Refresh',
    print: 'Print',
    export: 'Export',
    search: 'Search',
    filter: 'Filter',
    
    // Status
    status: 'Status',
    enabled: 'Enabled',
    disabled: 'Disabled',
    online: 'Online',
    offline: 'Offline',
    
    // Time
    minutes: 'min',
    hours: 'hr',
    today: 'Today',
    week: 'Week',
    month: 'Month',
    
    // Themes
    classic: 'Classic',
    mintMedical: 'Mint Medical',
    militaryNavy: 'Military Navy',
    desertGold: 'Desert Gold',
    medicalRose: 'Medical Rose',
    nightShift: 'Night Shift',
    
    // Messages
    note: 'Note',
    registerAtReception: 'Please register at Al-Attar Reception',
    noData: 'No Data Available',
    loading: 'Loading...',
    error: 'An Error Occurred',
    success: 'Operation Successful',
    confirmDelete: 'Are you sure you want to delete?',
    
    // Medical Committee
    militaryMedicalCommittee: 'Military Medical Committee',
    medicalServicesCommand: 'Military Medical Services Command',
    specializedMedicalCenter: 'Military Specialized Medical Center - Al-Attar'
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
