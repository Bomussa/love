// Reset System Settings to Default
// POST /api/v1/admin/system-settings/reset

import { jsonResponse, corsResponse, checkKVAvailability } from '../../../../_shared/utils.js';
import { logActivity } from '../../../../_shared/activity-logger.js';

// القيم الافتراضية
const DEFAULT_SETTINGS = {
  // توقيتات النظام (بالثواني)
  queueIntervalSeconds: 120,        // 2 دقيقة للنداء التلقائي
  patientMaxWaitSeconds: 240,       // 4 دقائق للمراجع
  refreshIntervalSeconds: 30,       // تحديث البيانات
  nearTurnRefreshSeconds: 7,        // تحديث عند قرب الدور
  
  // تفعيل/تعطيل الأنظمة
  autoCallEnabled: true,            // النداء التلقائي
  timeoutHandlerEnabled: true,      // نقل المراجع بعد 4 دقائق
  notificationsEnabled: true,       // الإشعارات
  
  // إظهار/إخفاء للمراجعين
  showCountdownTimer: true,         // عرض العد التنازلي
  showQueuePosition: true,          // عرض الموقع في الدور
  showEstimatedWait: true,          // عرض الوقت المتوقع
  showAheadCount: true,             // عرض عدد المنتظرين قبله
  
  // إعدادات إضافية
  notifyNearAhead: 3,               // إشعار للـ3 التاليين
  pinLateMinutes: 5,                // مهلة تأخير PIN
  noticeTtlSeconds: 30              // مدة عرض الإشعار
};

export async function onRequestPost(context) {
  const { env } = context;
  
  try {
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    // إعادة تعيين الإعدادات للقيم الافتراضية
    await env.KV_ADMIN.put('system:settings', JSON.stringify(DEFAULT_SETTINGS));
    
    // تسجيل النشاط
    await logActivity(env, 'SETTINGS_RESET', {
      timestamp: new Date().toISOString()
    });
    
    return jsonResponse({
      success: true,
      message: 'Settings reset to default values',
      settings: DEFAULT_SETTINGS,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

export async function onRequestOptions() {
  return corsResponse(['POST', 'OPTIONS']);
}

