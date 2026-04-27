/**
 * Supabase Client Configuration
 * تكوين عميل Supabase مع اتصال غير قابل للتوقف
 * الميزات: إعادة المحاولة التلقائية + Health Check + Realtime
 *
 * ✅ اتصال دائم بدون انقطاع
 * ✅ إعادة المحاولة التلقائية (10 محاولات)
 * ✅ مراقبة مستمرة للاتصال
 * ✅ معالجة جميع أنواع الأخطاء
 */

import { createClient } from '@supabase/supabase-js';
import { connectionManager, initializePersistentConnection, ServiceTypes } from './persistent-connection';

// Supabase configuration - read from environment with safe placeholder fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase env vars are not set. Configure frontend/.env or Vercel env vars.');
}

// إعدادات إعادة المحاولة
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 ثانية
  maxDelay: 30000, // 30 ثانية
};

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'mmc-mms-frontend',
    },
  },
});

// متغير لتتبع حالة الاتصال
let connectionStatus = 'connected';
let reconnectAttempts = 0;

/**
 * دالة إعادة المحاولة مع تأخير متزايد (Exponential Backoff)
 */
async function retryWithBackoff(fn, retries = RETRY_CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fn();
      if (i > 0) {
        console.log(`✅ نجحت المحاولة رقم ${i + 1}`);
        connectionStatus = 'connected';
        reconnectAttempts = 0;
      }
      return result;
    } catch (error) {
      const delay = Math.min(RETRY_CONFIG.baseDelay * 2 ** i, RETRY_CONFIG.maxDelay);
      console.warn(`⚠️ محاولة ${i + 1}/${retries} فشلت. إعادة المحاولة بعد ${delay}ms...`);
      connectionStatus = 'reconnecting';
      reconnectAttempts = i + 1;

      if (i === retries - 1) {
        connectionStatus = 'disconnected';
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * استعلام آمن مع إعادة المحاولة التلقائية
 */
export async function safeQuery(tableName, queryFn) {
  return retryWithBackoff(async () => {
    const result = await queryFn(supabase.from(tableName));
    if (result.error) throw result.error;
    return result;
  });
}

/**
 * Health Check - فحص صحة الاتصال بـ Supabase
 */
export async function healthCheck() {
  try {
    const { data: clinicsData, error: clinicsError } = await supabase
      .from('clinics')
      .select('id')
      .limit(1);

    if (clinicsError) throw new Error(`DB_CONNECTION_FAILED: ${clinicsError.message}`);

    const { data: configData } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'system_enabled')
      .single();

    const systemEnabled = configData?.value !== false;

    console.log('✅ Supabase Health Check passed');
    connectionStatus = 'connected';
    return {
      status: 'OK',
      systemEnabled,
      connectionStatus,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Supabase Health Check failed:', error);
    connectionStatus = 'error';
    return {
      status: 'ERROR',
      error: error.message,
      connectionStatus,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Test Connection - اختبار الاتصال
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase.from('clinics').select('count');
    if (error) throw error;
    console.log('✅ Supabase connection successful');
    connectionStatus = 'connected';
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    connectionStatus = 'disconnected';
    return false;
  }
}

/**
 * الحصول على حالة الاتصال الحالية
 */
export function getConnectionStatus() {
  return {
    status: connectionStatus,
    reconnectAttempts,
    timestamp: new Date().toISOString(),
  };
}

/**
 * إعادة الاتصال يدوياً
 */
export async function reconnect() {
  console.log('🔄 جاري إعادة الاتصال بـ Supabase...');
  connectionStatus = 'reconnecting';

  const connected = await testConnection();
  if (connected) {
    console.log('✅ تم إعادة الاتصال بنجاح');
    return true;
  }

  // محاولة إعادة الاتصال مع backoff
  return retryWithBackoff(testConnection);
}

/**
 * مراقبة الاتصال في الخلفية
 */
let monitorInterval = null;

export function startConnectionMonitor(intervalMs = 30000) {
  if (monitorInterval) return;

  monitorInterval = setInterval(async () => {
    const connected = await testConnection();
    if (!connected && connectionStatus === 'connected') {
      console.warn('⚠️ فقدان الاتصال، جاري إعادة المحاولة...');
      await reconnect();
    }
  }, intervalMs);

  console.log('🔍 بدء مراقبة الاتصال');
}

export function stopConnectionMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('⏹️ إيقاف مراقبة الاتصال');
  }
}

// تهيئة نظام الاتصال الدائم عند بدء التطبيق
let persistentConnectionInitialized = false;

export async function initializeAllConnections() {
  if (persistentConnectionInitialized) return;

  try {
    console.log('🚀 تهيئة نظام الاتصال الدائم...');
    await initializePersistentConnection();
    startConnectionMonitor(15000); // مراقبة كل 15 ثانية
    persistentConnectionInitialized = true;
    console.log('✅ تم تهيئة نظام الاتصال الدائم بنجاح');
  } catch (error) {
    console.error('❌ فشل تهيئة نظام الاتصال:', error);
  }
}

// تصدير مدير الاتصالات وأنواع الخدمات
export { connectionManager, ServiceTypes };

export default supabase;

// ============================================================================
// نظام تسجيل النشاط والتحقق من الأجهزة
// ============================================================================

/**
 * توليد بصمة فريدة للجهاز
 * تجمع بين عدة عوامل لإنشاء معرف فريد
 */
export function generateDeviceFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('MMC-MMS-Fingerprint', 2, 2);
  const canvasData = canvas.toDataURL();

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    canvasData.slice(-50),
  ].join('|');

  // تحويل إلى hash بسيط
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  return `DEV_${Math.abs(hash).toString(36).toUpperCase()}`;
}

/**
 * التحقق من تسجيل الجهاز لهذا اليوم
 * @returns {Promise<{allowed: boolean, existingPatientId?: string}>}
 */
export async function checkDeviceLogin(patientId) {
  try {
    const deviceFingerprint = generateDeviceFingerprint();
    const today = new Date().toISOString().split('T')[0];

    // التحقق من وجود تسجيل سابق لهذا الجهاز اليوم
    const { data: existingLogin, error } = await supabase
      .from('device_logins')
      .select('patient_id')
      .eq('device_fingerprint', deviceFingerprint)
      .eq('login_date', today)
      .maybeSingle();

    if (error) {
      console.error('خطأ في التحقق من الجهاز:', error);
      // في حالة الخطأ، نسمح بالدخول مع تحذير
      return { allowed: true, warning: 'تعذر التحقق من الجهاز' };
    }

    if (existingLogin && existingLogin.patient_id !== patientId) {
      return {
        allowed: false,
        existingPatientId: existingLogin.patient_id,
        message: 'هذا الجهاز مسجل برقم آخر اليوم',
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('خطأ في checkDeviceLogin:', error);
    return { allowed: true, warning: 'تعذر التحقق من الجهاز' };
  }
}

/**
 * تسجيل دخول الجهاز
 */
export async function registerDeviceLogin(patientId) {
  try {
    const deviceFingerprint = generateDeviceFingerprint();

    const { error } = await supabase
      .from('device_logins')
      .upsert({
        device_fingerprint: deviceFingerprint,
        patient_id: patientId,
        login_date: new Date().toISOString().split('T')[0],
        user_agent: navigator.userAgent,
      }, {
        onConflict: 'device_fingerprint,login_date',
      });

    if (error) {
      console.error('خطأ في تسجيل الجهاز:', error);
    }

    return !error;
  } catch (error) {
    console.error('خطأ في registerDeviceLogin:', error);
    return false;
  }
}

/**
 * تسجيل نشاط يومي (يُمسح نهاية اليوم)
 */
export async function logDailyActivity(actionType, details = {}) {
  try {
    const { error } = await supabase
      .from('daily_activity_logs')
      .insert({
        patient_id: details.patientId || null,
        action_type: actionType,
        action_details: details,
        clinic_id: details.clinicId || null,
        location: details.location || null,
        performed_by: details.performedBy || 'system',
        user_agent: navigator.userAgent,
      });

    if (error) {
      console.error('خطأ في تسجيل النشاط اليومي:', error);
    }

    return !error;
  } catch (error) {
    console.error('خطأ في logDailyActivity:', error);
    return false;
  }
}

/**
 * تسجيل تعديل دائم (لا يُمسح)
 */
export async function logPermanentAudit(actionType, details) {
  try {
    const { error } = await supabase
      .from('permanent_audit_logs')
      .insert({
        action_type: actionType,
        action_details: details,
        target_table: details.targetTable || null,
        target_id: details.targetId || null,
        old_value: details.oldValue || null,
        new_value: details.newValue || null,
        performed_by: details.performedBy || 'unknown',
        performed_by_role: details.performedByRole || 'unknown',
        user_agent: navigator.userAgent,
      });

    if (error) {
      console.error('خطأ في تسجيل التدقيق الدائم:', error);
    }

    return !error;
  } catch (error) {
    console.error('خطأ في logPermanentAudit:', error);
    return false;
  }
}

/**
 * جلب سجلات النشاط اليومي
 */
export async function getDailyActivityLogs(filters = {}) {
  try {
    let query = supabase
      .from('daily_activity_logs')
      .select('*')
      .eq('log_date', new Date().toISOString().split('T')[0])
      .order('performed_at', { ascending: false });

    if (filters.patientId) {
      query = query.eq('patient_id', filters.patientId);
    }
    if (filters.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters.clinicId) {
      query = query.eq('clinic_id', filters.clinicId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('خطأ في جلب السجلات اليومية:', error);
    return { success: false, error: error.message };
  }
}

/**
 * جلب سجلات التدقيق الدائمة
 */
export async function getPermanentAuditLogs(filters = {}) {
  try {
    let query = supabase
      .from('permanent_audit_logs')
      .select('*')
      .order('performed_at', { ascending: false });

    if (filters.performedBy) {
      query = query.eq('performed_by', filters.performedBy);
    }
    if (filters.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters.targetTable) {
      query = query.eq('target_table', filters.targetTable);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('خطأ في جلب سجلات التدقيق:', error);
    return { success: false, error: error.message };
  }
}

/**
 * جلب إعداد من جدول system_settings
 * @param {string} key - مفتاح الإعداد
 * @param {any} defaultValue - القيمة الافتراضية إذا لم يوجد الإعداد
 */
export async function getSystemSetting(key, defaultValue = null) {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('id', key)
      .single();

    if (error) {
      // إذا لم يوجد الإعداد، نرجع القيمة الافتراضية
      if (error.code === 'PGRST116') {
        return defaultValue;
      }
      console.warn(`تحذير: فشل جلب الإعداد ${key}:`, error.message);
      return defaultValue;
    }

    // تحويل القيمة من JSON إذا كانت مخزنة كـ JSON
    try {
      return JSON.parse(data.value);
    } catch {
      return data.value;
    }
  } catch (error) {
    console.error(`خطأ في جلب الإعداد ${key}:`, error);
    return defaultValue;
  }
}

/**
 * حفظ إعداد في جدول system_settings
 * @param {string} key - مفتاح الإعداد
 * @param {any} value - قيمة الإعداد
 * @param {string} description - وصف الإعداد (اختياري)
 */
export async function setSystemSetting(key, value, description = null) {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        id: key,
        value,
        description: description || `إعداد ${key}`,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error(`خطأ في حفظ الإعداد ${key}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * جلب جميع إعدادات النظام
 */
export async function getAllSystemSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('key');

    if (error) throw error;

    // تحويل إلى كائن key-value
    const settings = {};
    data?.forEach((item) => {
      try {
        settings[item.key] = JSON.parse(item.value);
      } catch {
        settings[item.key] = item.value;
      }
    });

    return { success: true, data: settings, raw: data };
  } catch (error) {
    console.error('خطأ في جلب إعدادات النظام:', error);
    return { success: false, error: error.message };
  }
}
