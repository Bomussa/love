/**
 * Refresh Constants - ثوابت التحديث
 * محسّنة للأداء اللحظي
 */

// فترة التحديث العامة (10 ثواني - محسّن من 30)
export const GENERAL_REFRESH_INTERVAL = 10000;

// فترة تحديث الطوابير (5 ثواني - لحظي)
export const QUEUE_REFRESH_INTERVAL = 5000;

// فترة تحديث الإشعارات (5 ثواني - لحظي)
export const NOTIFICATION_REFRESH_INTERVAL = 5000;

// فترة تحديث الإحصائيات (30 ثانية - محسّن من 60)
export const STATS_REFRESH_INTERVAL = 30000;

// فترة تحديث PIN (15 ثانية - محسّن من 30)
export const PIN_REFRESH_INTERVAL = 15000;

// فترة التحديث اللحظي (3 ثواني - محسّن من 5)
export const REALTIME_REFRESH_INTERVAL = 3000;

// فترة تحديث اقتراب الدور (5 ثواني - لحظي)
export const NEAR_TURN_REFRESH_INTERVAL = 5000;

// فترة تحديث شاشة العرض (3 ثواني - لحظي)
export const DISPLAY_REFRESH_INTERVAL = 3000;

// فترة تحديث لوحة الإدارة (10 ثواني - محسّن من 20)
export const ADMIN_REFRESH_INTERVAL = 10000;

export default {
  GENERAL_REFRESH_INTERVAL,
  QUEUE_REFRESH_INTERVAL,
  NOTIFICATION_REFRESH_INTERVAL,
  STATS_REFRESH_INTERVAL,
  PIN_REFRESH_INTERVAL,
  REALTIME_REFRESH_INTERVAL,
  NEAR_TURN_REFRESH_INTERVAL,
  DISPLAY_REFRESH_INTERVAL,
  ADMIN_REFRESH_INTERVAL,
};
