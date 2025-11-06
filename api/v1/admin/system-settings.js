// System Settings Management API
// GET/POST /api/v1/admin/system-settings
// Manage all system timings, toggles, and display settings

import { jsonResponse, corsResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';
import { logActivity } from '../../../_shared/activity-logger.js';

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

/**
 * GET - الحصول على الإعدادات الحالية
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    // جلب الإعدادات من KV
    let settings = await env.KV_ADMIN.get('system:settings', { type: 'json' });
    
    // إذا لم توجد، استخدم القيم الافتراضية
    if (!settings) {
      settings = DEFAULT_SETTINGS;
      // حفظها في KV
      await env.KV_ADMIN.put('system:settings', JSON.stringify(settings));
    }
    
    return jsonResponse({
      success: true,
      settings: settings,
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

/**
 * POST - تحديث الإعدادات
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json().catch(() => ({}));
    const { settings } = body;
    
    if (!settings || typeof settings !== 'object') {
      return jsonResponse({
        success: false,
        error: 'Invalid settings object'
      }, 400);
    }
    
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    // التحقق من صحة القيم
    const validatedSettings = validateSettings(settings);
    
    // حفظ الإعدادات
    await env.KV_ADMIN.put('system:settings', JSON.stringify(validatedSettings));
    
    // تسجيل النشاط
    await logActivity(env, 'SETTINGS_UPDATE', {
      settings: validatedSettings,
      timestamp: new Date().toISOString()
    });
    
    return jsonResponse({
      success: true,
      message: 'Settings updated successfully',
      settings: validatedSettings,
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

/**
 * التحقق من صحة الإعدادات
 */
function validateSettings(settings) {
  const validated = { ...DEFAULT_SETTINGS };
  
  // التحقق من التوقيتات
  if (settings.queueIntervalSeconds !== undefined) {
    validated.queueIntervalSeconds = Math.max(30, Math.min(300, parseInt(settings.queueIntervalSeconds)));
  }
  
  if (settings.patientMaxWaitSeconds !== undefined) {
    validated.patientMaxWaitSeconds = Math.max(60, Math.min(600, parseInt(settings.patientMaxWaitSeconds)));
  }
  
  if (settings.refreshIntervalSeconds !== undefined) {
    validated.refreshIntervalSeconds = Math.max(5, Math.min(60, parseInt(settings.refreshIntervalSeconds)));
  }
  
  if (settings.nearTurnRefreshSeconds !== undefined) {
    validated.nearTurnRefreshSeconds = Math.max(3, Math.min(30, parseInt(settings.nearTurnRefreshSeconds)));
  }
  
  // التحقق من التبديلات (boolean)
  const booleanFields = [
    'autoCallEnabled',
    'timeoutHandlerEnabled',
    'notificationsEnabled',
    'showCountdownTimer',
    'showQueuePosition',
    'showEstimatedWait',
    'showAheadCount'
  ];
  
  booleanFields.forEach(field => {
    if (settings[field] !== undefined) {
      validated[field] = Boolean(settings[field]);
    }
  });
  
  // التحقق من الأرقام الإضافية
  if (settings.notifyNearAhead !== undefined) {
    validated.notifyNearAhead = Math.max(1, Math.min(10, parseInt(settings.notifyNearAhead)));
  }
  
  if (settings.pinLateMinutes !== undefined) {
    validated.pinLateMinutes = Math.max(1, Math.min(30, parseInt(settings.pinLateMinutes)));
  }
  
  if (settings.noticeTtlSeconds !== undefined) {
    validated.noticeTtlSeconds = Math.max(5, Math.min(60, parseInt(settings.noticeTtlSeconds)));
  }
  
  return validated;
}

export async function onRequestOptions() {
  return corsResponse(['GET', 'POST', 'OPTIONS']);
}


  } catch (error) {
    console.error('Error in api/v1/admin/system-settings.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
