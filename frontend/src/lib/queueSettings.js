/**
 * ============================================================================
 * إعدادات نظام الدور المحلية - Queue Settings (localStorage)
 * ============================================================================
 *
 * هذا الملف يحتوي على إعدادات نظام الدور التي تُحفظ محلياً في localStorage
 * بدون الحاجة لقاعدة بيانات.
 *
 * ⚠️ تحذير: هذا الكود مقفل ولا يجب تعديله إلا بموافقة صريحة
 *
 * @version 1.0.0
 * @locked true
 * @author MMC-MMS System
 * @date 2025-01-16
 * ============================================================================
 */

// ============================================================================
// الثوابت الافتراضية - DEFAULT CONSTANTS
// ============================================================================

export const DEFAULT_QUEUE_SETTINGS = {
  // توقيتات النظام (بالثواني)
  queueIntervalSeconds: 120, // 2 دقيقة - فترة النداء التلقائي
  patientMaxWaitSeconds: 240, // 4 دقائق - المهلة قبل الدخول (بعد النداء)
  examMaxSeconds: 300, // 5 دقائق - الحد الأقصى للفحص داخل العيادة
  refreshIntervalSeconds: 30, // تحديث البيانات العادي
  nearTurnRefreshSeconds: 7, // تحديث عند قرب الدور

  // تفعيل/تعطيل الأنظمة
  autoCallEnabled: true, // النداء التلقائي
  timeoutHandlerEnabled: true, // نقل المراجع المتأخر
  examTimeoutEnabled: true, // حد الفحص داخل العيادة
  notificationsEnabled: true, // الإشعارات

  // إعدادات العرض للمراجعين
  showCountdownTimer: true, // عرض العد التنازلي
  showQueuePosition: true, // عرض الموقع في الدور
  showEstimatedWait: true, // عرض الوقت المتوقع
  showAheadCount: true, // عرض عدد المنتظرين قبله

  // إعدادات إضافية
  notifyNearAhead: 3, // إشعار للـ3 التاليين
  graceMinutes: 4, // مهلة الدخول بالدقائق
  noticeTtlSeconds: 30, // مدة عرض الإشعار
};

// مفتاح التخزين المحلي
const STORAGE_KEY = 'mmc_queue_settings';

// ============================================================================
// إدارة الإعدادات - SETTINGS MANAGEMENT
// ============================================================================

/**
 * جلب الإعدادات من localStorage
 * @returns {Object} الإعدادات الحالية
 */
export function getQueueSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // دمج مع الافتراضي للتأكد من وجود جميع المفاتيح
      return { ...DEFAULT_QUEUE_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('خطأ في جلب إعدادات الدور:', error);
  }
  return { ...DEFAULT_QUEUE_SETTINGS };
}

/**
 * حفظ الإعدادات في localStorage
 * @param {Object} settings - الإعدادات الجديدة
 * @returns {boolean} نجاح العملية
 */
export function saveQueueSettings(settings) {
  try {
    const merged = { ...DEFAULT_QUEUE_SETTINGS, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    // إرسال حدث لتحديث جميع الشاشات
    window.dispatchEvent(new CustomEvent('queueSettingsUpdated', {
      detail: merged,
    }));

    return true;
  } catch (error) {
    console.error('خطأ في حفظ إعدادات الدور:', error);
    return false;
  }
}

/**
 * تحديث إعداد واحد
 * @param {string} key - مفتاح الإعداد
 * @param {any} value - القيمة الجديدة
 * @returns {boolean} نجاح العملية
 */
export function updateQueueSetting(key, value) {
  const current = getQueueSettings();
  current[key] = value;
  return saveQueueSettings(current);
}

/**
 * إعادة تعيين الإعدادات للقيم الافتراضية
 * @returns {Object} الإعدادات الافتراضية
 */
export function resetQueueSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_QUEUE_SETTINGS));
    window.dispatchEvent(new CustomEvent('queueSettingsUpdated', {
      detail: DEFAULT_QUEUE_SETTINGS,
    }));
    return { ...DEFAULT_QUEUE_SETTINGS };
  } catch (error) {
    console.error('خطأ في إعادة تعيين إعدادات الدور:', error);
    return { ...DEFAULT_QUEUE_SETTINGS };
  }
}

// ============================================================================
// دوال مساعدة - HELPER FUNCTIONS
// ============================================================================

/**
 * تحويل الثواني إلى دقائق
 * @param {number} seconds - الثواني
 * @returns {number} الدقائق
 */
export function secondsToMinutes(seconds) {
  return Math.round(seconds / 60);
}

/**
 * تحويل الدقائق إلى ثواني
 * @param {number} minutes - الدقائق
 * @returns {number} الثواني
 */
export function minutesToSeconds(minutes) {
  return minutes * 60;
}

/**
 * حساب الوقت المتوقع للانتظار
 * @param {number} position - الموقع في الدور
 * @returns {number} الدقائق المتوقعة
 */
export function getEstimatedWaitTime(position) {
  const settings = getQueueSettings();
  // كل مراجع يأخذ حوالي 2 دقيقة (فترة النداء)
  const avgTimePerPatient = settings.queueIntervalSeconds / 60;
  return Math.ceil(position * avgTimePerPatient);
}

/**
 * التحقق من قرب الدور
 * @param {number} position - الموقع في الدور
 * @returns {boolean} هل الدور قريب
 */
export function isNearTurn(position) {
  const settings = getQueueSettings();
  return position <= settings.notifyNearAhead;
}

/**
 * حساب الوقت المتبقي قبل التمرير
 * @param {number} calledAt - وقت النداء (timestamp)
 * @param {string} status - حالة المراجع ('called' أو 'in')
 * @returns {number} الثواني المتبقية
 */
export function getRemainingTime(calledAt, status) {
  const settings = getQueueSettings();
  const now = Date.now();
  const elapsed = Math.floor((now - calledAt) / 1000);

  if (status === 'called') {
    // المهلة قبل الدخول
    return Math.max(0, settings.patientMaxWaitSeconds - elapsed);
  } if (status === 'in') {
    // الحد الأقصى للفحص
    return Math.max(0, settings.examMaxSeconds - elapsed);
  }

  return 0;
}

/**
 * التحقق من وجوب تمرير المراجع
 * @param {number} calledAt - وقت النداء (timestamp)
 * @param {string} status - حالة المراجع
 * @returns {boolean} هل يجب التمرير
 */
export function shouldSkipPatient(calledAt, status) {
  const settings = getQueueSettings();

  if (!settings.timeoutHandlerEnabled) return false;

  const remaining = getRemainingTime(calledAt, status);
  return remaining <= 0;
}

// ============================================================================
// مراقب الإعدادات - SETTINGS OBSERVER
// ============================================================================

/**
 * الاستماع لتغييرات الإعدادات
 * @param {Function} callback - دالة الاستدعاء عند التغيير
 * @returns {Function} دالة إلغاء الاستماع
 */
export function onQueueSettingsChange(callback) {
  const handler = (event) => {
    callback(event.detail);
  };

  window.addEventListener('queueSettingsUpdated', handler);

  return () => {
    window.removeEventListener('queueSettingsUpdated', handler);
  };
}

// ============================================================================
// تصدير افتراضي
// ============================================================================

export default {
  DEFAULT_QUEUE_SETTINGS,
  getQueueSettings,
  saveQueueSettings,
  updateQueueSetting,
  resetQueueSettings,
  secondsToMinutes,
  minutesToSeconds,
  getEstimatedWaitTime,
  isNearTurn,
  getRemainingTime,
  shouldSkipPatient,
  onQueueSettingsChange,
};
