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
    loginSuccess: 'تم تسجيل الدخول بنجاح',
    loginFailed: 'فشل تسجيل الدخول',
    examSelected: 'تم اختيار نوع الفحص',

    // Admin
    dashboard: 'لوحة التحكم',
    queueManagement: 'إدارة الطوابير',
    reports: 'التقارير',
    settings: 'الإعدادات',
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
    specializedMedicalCenter: 'المركز الطبي التخصصي العسكري - العطار',
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
    loginSuccess: 'Login Successful',
    loginFailed: 'Login Failed',
    examSelected: 'Examination Type Selected',

    // Admin
    dashboard: 'Dashboard',
    queueManagement: 'Queue Management',
    reports: 'Reports',
    settings: 'Settings',
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
    specializedMedicalCenter: 'Military Specialized Medical Center - Al-Attar',

    // ✅ إضافة ترجمات ناقصة
    yourTurnNow: "It's Your Turn NOW!",
    goImmediately: 'Go immediately to',
    dontBeLate: "Don't be late!",
    youAreNext: 'You Are Next!',
    getReady: 'Get ready',
    onlyOnePerson: 'Only 1 person ahead!',
    estimatedWait: 'Estimated wait',
    yourTurnIsNear: 'Your Turn is Near',
    peopleAhead: 'people ahead of you',
    notice: 'Notice',
    information: 'Information',
    youMayWaitNear: 'You may wait near',
    welcomeToMedicalCommittee: 'Welcome to Medical Committee',
    howToUse: 'How to use',
    followNotifications: 'Follow notifications to each clinic',
    watchYourNumber: 'Watch your queue number on screen',
    alertWhenNear: 'You will be alerted when your turn is near',
    goWhenYourTurn: 'Go to clinic when it is your turn',
    queueSystemExplained: 'Queue System Explained',
    yourQueueInfo: 'Your Queue Info',
    yourPosition: 'Your position',
    beingServedNow: 'Being served now',
    allExamsCompleted: 'All Examinations Completed!',
    congratulations: 'Congratulations!',
    nextStep: 'Next Step',
    goToReception: 'Go to Medical Committee Reception',
    toReceive: 'To receive Final Results',
    direction: 'Direction',
    groundFloorMainEntrance: 'Ground Floor - Main Entrance',
    firstClinicLocation: 'First Clinic Location',
    moveToNewFloor: 'Move to New Floor',
    nextClinic: 'Next Clinic',
    clinic: 'Clinic',
    room: 'Room',
    goToElevator: 'Go to elevator opposite back door',
    pressButton: 'Press button',
    estimatedTime: 'Estimated Time',
    back: 'Back',
    administration: 'Administration',
    radiology: 'Radiology',
    biometrics: 'Biometrics',

    // ✅ إضافات جديدة للترجمة الإنجليزية
    waitForYourTurn: 'Wait for your turn',
    entryNotAvailable: 'Entry not available yet',
    yourNumberIs: 'Your # is',
    currentlyServing: 'Currently serving',
    personsAhead: 'persons ahead',
    autoRepairSystem: 'Auto Repair System',
    tableNeedsReview: 'table needs review',
    autoRepairFailed: 'Auto repair failed for',
    autoRepairSuccess: 'Auto repair successful for',
    connectionRestored: 'Connection restored',
    connectionLost: 'Connection lost',
    retrying: 'Retrying...',
    lastUpdate: 'Last update',
    queuePosition: 'Queue Position',
    estimatedWaitTime: 'Estimated Wait Time',
    clinicStatus: 'Clinic Status',
    open: 'Open',
    closed: 'Closed',
    paused: 'Paused',
    serving: 'Serving',
    called: 'Called',
    skipped: 'Skipped',
    postponed: 'Postponed',
    cancelled: 'Cancelled',
    noShow: 'No Show',
    transferredTo: 'Transferred to',
    completedAt: 'Completed at',
    enteredAt: 'Entered at',
    calledAt: 'Called at',
    waitTime: 'Wait Time',
    serviceTime: 'Service Time',
    totalTime: 'Total Time',
    averageTime: 'Average Time',
    peakHours: 'Peak Hours',
    quietHours: 'Quiet Hours',
    dailyReport: 'Daily Report',
    weeklyReport: 'Weekly Report',
    monthlyReport: 'Monthly Report',
    exportToPDF: 'Export to PDF',
    exportToExcel: 'Export to Excel',
    printReport: 'Print Report',
    selectDateRange: 'Select Date Range',
    from: 'From',
    to: 'To',
    apply: 'Apply',
    reset: 'Reset',
    noResultsFound: 'No results found',
    tryDifferentSearch: 'Try a different search',
    clearFilters: 'Clear Filters',
    showAll: 'Show All',
    showActive: 'Show Active',
    showCompleted: 'Show Completed',
    sortBy: 'Sort By',
    ascending: 'Ascending',
    descending: 'Descending',
    newest: 'Newest',
    oldest: 'Oldest',
    systemHealth: 'System Health',
    allSystemsOperational: 'All Systems Operational',
    someIssuesDetected: 'Some Issues Detected',
    criticalIssues: 'Critical Issues',
    monitoring: 'Monitoring',
    startMonitoring: 'Start Monitoring',
    stopMonitoring: 'Stop Monitoring',
    refreshData: 'Refresh Data',
    autoRefresh: 'Auto Refresh',
    every30Seconds: 'Every 30 seconds',
    every1Minute: 'Every 1 minute',
    every5Minutes: 'Every 5 minutes',
    manual: 'Manual',
    notifications: 'Notifications',
    enableNotifications: 'Enable Notifications',
    disableNotifications: 'Disable Notifications',
    soundAlerts: 'Sound Alerts',
    vibration: 'Vibration',
    pushNotifications: 'Push Notifications',
    emailAlerts: 'Email Alerts',
    smsAlerts: 'SMS Alerts',
    language: 'Language',
    arabic: 'Arabic',
    english: 'English',
    theme: 'Theme',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    systemDefault: 'System Default',
    fontSize: 'Font Size',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    accessibility: 'Accessibility',
    highContrast: 'High Contrast',
    reducedMotion: 'Reduced Motion',
    screenReader: 'Screen Reader Support',
    help: 'Help',
    support: 'Support',
    contactUs: 'Contact Us',
    faq: 'FAQ',
    userGuide: 'User Guide',
    about: 'About',
    version: 'Version',
    copyright: 'Copyright',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
  },
};

// ✅ إصلاح: Get translation based on language with better fallback
export function t(key, lang = 'ar') {
  // التحقق من وجود الترجمة في اللغة المطلوبة
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key];
  }
  // الرجوع للعربية إذا لم توجد الترجمة
  if (translations.ar && translations.ar[key]) {
    return translations.ar[key];
  }
  // إرجاع المفتاح نفسه إذا لم توجد أي ترجمة
  return key;
}

// Get current language from localStorage or default to Arabic
export function getCurrentLanguage() {
  return localStorage.getItem('language') || 'ar';
}

// Set current language
export function setCurrentLanguage(lang) {
  localStorage.setItem('language', lang);
  // Update document direction
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}
