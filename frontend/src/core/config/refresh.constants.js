/**
 * Refresh Constants - ثوابت التحديث
 * تحديد فترات التحديث التلقائي للمكونات المختلفة
 */

// فترة التحديث العامة (30 ثانية)
export const GENERAL_REFRESH_INTERVAL = 30000;

// فترة تحديث الطوابير (15 ثانية)
export const QUEUE_REFRESH_INTERVAL = 15000;

// فترة تحديث الإشعارات (10 ثواني)
export const NOTIFICATION_REFRESH_INTERVAL = 10000;

// فترة تحديث الإحصائيات (60 ثانية)
export const STATS_REFRESH_INTERVAL = 60000;

// فترة تحديث PIN (30 ثانية)
export const PIN_REFRESH_INTERVAL = 30000;

// فترة التحديث اللحظي (5 ثواني)
export const REALTIME_REFRESH_INTERVAL = 5000;

// فترة تحديث اقتراب الدور (10 ثواني)
export const NEAR_TURN_REFRESH_INTERVAL = 10000;

// فترة تحديث شاشة العرض (5 ثواني)
export const DISPLAY_REFRESH_INTERVAL = 5000;

// فترة تحديث لوحة الإدارة (20 ثانية)
export const ADMIN_REFRESH_INTERVAL = 20000;

export default {
  GENERAL_REFRESH_INTERVAL,
  QUEUE_REFRESH_INTERVAL,
  NOTIFICATION_REFRESH_INTERVAL,
  STATS_REFRESH_INTERVAL,
  PIN_REFRESH_INTERVAL,
  REALTIME_REFRESH_INTERVAL,
  NEAR_TURN_REFRESH_INTERVAL,
  DISPLAY_REFRESH_INTERVAL,
  ADMIN_REFRESH_INTERVAL
};
