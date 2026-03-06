/**
 * نظام تسجيل العمليات الشامل
 * Activity Logger System
 *
 * يسجل جميع العمليات في التطبيق مع:
 * - الوقت والتاريخ
 * - رقم الجهاز
 * - رقم المراجع
 * - العيادة
 * - نوع الفحص
 * - الجنس
 * - المسار الطبي
 * - النتيجة
 * - وقت الدخول والخروج
 */

// مفتاح التخزين في localStorage
const ACTIVITY_LOG_KEY = 'mmc_activity_log';
const DEVICE_ID_KEY = 'mmc_device_id';

// أنواع العمليات
export const ActivityTypes = {
  // عمليات المراجع
  PATIENT_REGISTERED: 'patient_registered',
  PATIENT_SELECTED_EXAM: 'patient_selected_exam',
  PATIENT_GOT_TICKET: 'patient_got_ticket',
  PATIENT_ENTERED_CLINIC: 'patient_entered_clinic',
  PATIENT_EXITED_CLINIC: 'patient_exited_clinic',
  PATIENT_COMPLETED_EXAM: 'patient_completed_exam',
  PATIENT_SKIPPED: 'patient_skipped',

  // عمليات الإدارة
  ADMIN_LOGIN: 'admin_login',
  ADMIN_LOGOUT: 'admin_logout',
  ADMIN_CALLED_NEXT: 'admin_called_next',
  ADMIN_COMPLETED_PATIENT: 'admin_completed_patient',
  ADMIN_SKIPPED_PATIENT: 'admin_skipped_patient',
  ADMIN_CHANGED_SETTINGS: 'admin_changed_settings',

  // عمليات النظام
  SYSTEM_AUTO_SKIP: 'system_auto_skip',
  SYSTEM_AUTO_COMPLETE: 'system_auto_complete',
  SYSTEM_DAILY_RESET: 'system_daily_reset',
};

/**
 * الحصول على معرف الجهاز الفريد
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `DEV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * الحصول على جميع السجلات
 */
export function getAllLogs() {
  try {
    const logs = localStorage.getItem(ACTIVITY_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error('Error reading activity logs:', error);
    return [];
  }
}

/**
 * حفظ السجلات
 */
function saveLogs(logs) {
  try {
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Error saving activity logs:', error);
    // إذا امتلأت الذاكرة، احذف السجلات القديمة
    if (error.name === 'QuotaExceededError') {
      const trimmedLogs = logs.slice(-1000); // احتفظ بآخر 1000 سجل
      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(trimmedLogs));
    }
  }
}

/**
 * تسجيل عملية جديدة
 * @param {string} type - نوع العملية من ActivityTypes
 * @param {object} data - بيانات العملية
 */
export function logActivity(type, data = {}) {
  const now = new Date();

  const logEntry = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type,
    timestamp: now.toISOString(),
    date: now.toLocaleDateString('ar-SA'),
    time: now.toLocaleTimeString('ar-SA'),
    deviceId: getDeviceId(),

    // بيانات المراجع
    patientId: data.patientId || null,
    patientMilitaryId: data.patientMilitaryId || null,
    gender: data.gender || null,

    // بيانات الفحص
    examType: data.examType || null,
    examTypeName: data.examTypeName || null,
    medicalPath: data.medicalPath || null,

    // بيانات العيادة
    clinicId: data.clinicId || null,
    clinicName: data.clinicName || null,
    clinicFloor: data.clinicFloor || null,

    // بيانات الدور
    queueNumber: data.queueNumber || null,
    queuePosition: data.queuePosition || null,

    // أوقات الدخول والخروج
    entryTime: data.entryTime || null,
    exitTime: data.exitTime || null,
    duration: data.duration || null,

    // النتيجة
    result: data.result || null,
    resultDetails: data.resultDetails || null,

    // بيانات إضافية
    notes: data.notes || null,
    adminUser: data.adminUser || null,

    // بيانات النظام
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
  };

  const logs = getAllLogs();
  logs.push(logEntry);
  saveLogs(logs);

  console.log(`[ActivityLog] ${type}:`, logEntry);

  return logEntry;
}

/**
 * تسجيل دخول مراجع جديد
 */
export function logPatientRegistered(patientData) {
  return logActivity(ActivityTypes.PATIENT_REGISTERED, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
  });
}

/**
 * تسجيل اختيار نوع الفحص
 */
export function logExamSelected(patientData, examType) {
  return logActivity(ActivityTypes.PATIENT_SELECTED_EXAM, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
    examType: examType.id,
    examTypeName: examType.name,
    medicalPath: examType.stations?.map((s) => s.name).join(' → '),
  });
}

/**
 * تسجيل حصول المراجع على رقم
 */
export function logTicketReceived(patientData, clinic, queueNumber) {
  return logActivity(ActivityTypes.PATIENT_GOT_TICKET, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
    examType: patientData.examType,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicFloor: clinic.floor,
    queueNumber,
  });
}

/**
 * تسجيل دخول المراجع للعيادة
 */
export function logClinicEntry(patientData, clinic, queueNumber) {
  return logActivity(ActivityTypes.PATIENT_ENTERED_CLINIC, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
    examType: patientData.examType,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicFloor: clinic.floor,
    queueNumber,
    entryTime: new Date().toISOString(),
  });
}

/**
 * تسجيل خروج المراجع من العيادة
 */
export function logClinicExit(patientData, clinic, queueNumber, entryTime, result) {
  const exitTime = new Date();
  const entry = entryTime ? new Date(entryTime) : null;
  const duration = entry ? Math.round((exitTime - entry) / 1000) : null;

  return logActivity(ActivityTypes.PATIENT_EXITED_CLINIC, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
    examType: patientData.examType,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicFloor: clinic.floor,
    queueNumber,
    entryTime,
    exitTime: exitTime.toISOString(),
    duration,
    result,
  });
}

/**
 * تسجيل إكمال الفحص الكامل
 */
export function logExamCompleted(patientData, startTime) {
  const endTime = new Date();
  const start = startTime ? new Date(startTime) : null;
  const duration = start ? Math.round((endTime - start) / 1000) : null;

  return logActivity(ActivityTypes.PATIENT_COMPLETED_EXAM, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
    examType: patientData.examType,
    examTypeName: patientData.examTypeName,
    entryTime: startTime,
    exitTime: endTime.toISOString(),
    duration,
    result: 'completed',
  });
}

/**
 * تسجيل تخطي مراجع
 */
export function logPatientSkipped(patientData, clinic, reason) {
  return logActivity(ActivityTypes.PATIENT_SKIPPED, {
    patientId: patientData.id,
    patientMilitaryId: patientData.militaryId,
    gender: patientData.gender,
    examType: patientData.examType,
    clinicId: clinic?.id,
    clinicName: clinic?.name,
    result: 'skipped',
    notes: reason,
  });
}

/**
 * تسجيل دخول الإدارة
 */
export function logAdminLogin(adminUser) {
  return logActivity(ActivityTypes.ADMIN_LOGIN, {
    adminUser,
  });
}

/**
 * تسجيل خروج الإدارة
 */
export function logAdminLogout(adminUser) {
  return logActivity(ActivityTypes.ADMIN_LOGOUT, {
    adminUser,
  });
}

/**
 * تسجيل تغيير الإعدادات
 */
export function logSettingsChanged(adminUser, settingName, oldValue, newValue) {
  return logActivity(ActivityTypes.ADMIN_CHANGED_SETTINGS, {
    adminUser,
    notes: `${settingName}: ${oldValue} → ${newValue}`,
  });
}

/**
 * تسجيل تخطي تلقائي من النظام
 */
export function logSystemAutoSkip(patientData, clinic, reason) {
  return logActivity(ActivityTypes.SYSTEM_AUTO_SKIP, {
    patientId: patientData?.id,
    patientMilitaryId: patientData?.militaryId,
    clinicId: clinic?.id,
    clinicName: clinic?.name,
    result: 'auto_skipped',
    notes: reason,
  });
}

/**
 * فلترة السجلات حسب الفترة الزمنية
 */
export function filterLogsByPeriod(period = 'today') {
  const logs = getAllLogs();
  const now = new Date();

  let startDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'halfYear':
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return logs;
  }

  return logs.filter((log) => new Date(log.timestamp) >= startDate);
}

/**
 * فلترة السجلات حسب نوع العملية
 */
export function filterLogsByType(logs, types) {
  if (!types || types.length === 0) return logs;
  return logs.filter((log) => types.includes(log.type));
}

/**
 * فلترة السجلات حسب العيادة
 */
export function filterLogsByClinic(logs, clinicId) {
  if (!clinicId) return logs;
  return logs.filter((log) => log.clinicId === clinicId);
}

/**
 * فلترة السجلات حسب نوع الفحص
 */
export function filterLogsByExamType(logs, examType) {
  if (!examType) return logs;
  return logs.filter((log) => log.examType === examType);
}

/**
 * الحصول على إحصائيات السجلات
 */
export function getLogStatistics(logs) {
  const stats = {
    total: logs.length,
    byType: {},
    byClinic: {},
    byExamType: {},
    byGender: { male: 0, female: 0 },
    avgDuration: 0,
    completedExams: 0,
    skippedPatients: 0,
  };

  let totalDuration = 0;
  let durationCount = 0;

  logs.forEach((log) => {
    // إحصائيات حسب النوع
    stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

    // إحصائيات حسب العيادة
    if (log.clinicName) {
      stats.byClinic[log.clinicName] = (stats.byClinic[log.clinicName] || 0) + 1;
    }

    // إحصائيات حسب نوع الفحص
    if (log.examTypeName) {
      stats.byExamType[log.examTypeName] = (stats.byExamType[log.examTypeName] || 0) + 1;
    }

    // إحصائيات حسب الجنس
    if (log.gender === 'male') stats.byGender.male++;
    if (log.gender === 'female') stats.byGender.female++;

    // حساب متوسط المدة
    if (log.duration) {
      totalDuration += log.duration;
      durationCount++;
    }

    // عدد الفحوصات المكتملة
    if (log.type === ActivityTypes.PATIENT_COMPLETED_EXAM) {
      stats.completedExams++;
    }

    // عدد المراجعين المتخطين
    if (log.type === ActivityTypes.PATIENT_SKIPPED || log.type === ActivityTypes.SYSTEM_AUTO_SKIP) {
      stats.skippedPatients++;
    }
  });

  stats.avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

  return stats;
}

/**
 * حذف السجلات القديمة (نهاية اليوم)
 */
export function clearOldLogs() {
  const logs = getAllLogs();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLogs = logs.filter((log) => new Date(log.timestamp) >= today);
  saveLogs(todayLogs);

  console.log(`[ActivityLog] Cleared old logs. Kept ${todayLogs.length} logs from today.`);

  return todayLogs.length;
}

/**
 * حذف جميع السجلات
 */
export function clearAllLogs() {
  localStorage.removeItem(ACTIVITY_LOG_KEY);
  console.log('[ActivityLog] All logs cleared.');
}

/**
 * تصدير السجلات كـ JSON
 */
export function exportLogsAsJSON(logs) {
  return JSON.stringify(logs, null, 2);
}

/**
 * تصدير السجلات كـ CSV
 */
export function exportLogsAsCSV(logs, columns) {
  if (!logs || logs.length === 0) return '';

  const defaultColumns = [
    'timestamp', 'type', 'patientMilitaryId', 'gender',
    'examTypeName', 'clinicName', 'queueNumber', 'duration', 'result',
  ];

  const cols = columns || defaultColumns;

  const headers = cols.map((col) => {
    const headerNames = {
      timestamp: 'التاريخ والوقت',
      type: 'نوع العملية',
      patientMilitaryId: 'الرقم العسكري',
      gender: 'الجنس',
      examTypeName: 'نوع الفحص',
      clinicName: 'العيادة',
      queueNumber: 'رقم الدور',
      duration: 'المدة (ثانية)',
      result: 'النتيجة',
      entryTime: 'وقت الدخول',
      exitTime: 'وقت الخروج',
      deviceId: 'رقم الجهاز',
      notes: 'ملاحظات',
    };
    return headerNames[col] || col;
  });

  const rows = logs.map((log) => cols.map((col) => {
    const value = log[col];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' && value.includes(',')) {
      return `"${value}"`;
    }
    return value;
  }).join(','));

  return [headers.join(','), ...rows].join('\n');
}

// تشغيل حذف السجلات القديمة عند منتصف الليل
function scheduleDailyCleanup() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const timeUntilMidnight = midnight - now;

  setTimeout(() => {
    clearOldLogs();
    logActivity(ActivityTypes.SYSTEM_DAILY_RESET, {
      notes: 'Daily log cleanup completed',
    });
    // إعادة الجدولة لليوم التالي
    scheduleDailyCleanup();
  }, timeUntilMidnight);
}

// بدء الجدولة عند تحميل الملف
if (typeof window !== 'undefined') {
  scheduleDailyCleanup();
}

export default {
  logActivity,
  logPatientRegistered,
  logExamSelected,
  logTicketReceived,
  logClinicEntry,
  logClinicExit,
  logExamCompleted,
  logPatientSkipped,
  logAdminLogin,
  logAdminLogout,
  logSettingsChanged,
  logSystemAutoSkip,
  getAllLogs,
  filterLogsByPeriod,
  filterLogsByType,
  filterLogsByClinic,
  filterLogsByExamType,
  getLogStatistics,
  clearOldLogs,
  clearAllLogs,
  exportLogsAsJSON,
  exportLogsAsCSV,
  getDeviceId,
  ActivityTypes,
};
