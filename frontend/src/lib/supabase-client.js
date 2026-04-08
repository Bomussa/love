/**
 * Supabase Client Configuration - v7.1
 * تكوين عميل Supabase مع اتصال غير قابل للتوقف
 * 
 * ✅ اتصال دائم بدون انقطاع
 * ✅ إعادة المحاولة التلقائية
 * ✅ مراقبة مستمرة للاتصال
 * ✅ معالجة جميع أنواع الأخطاء
 * ✅ متوافق مع love-api v7.1
 * 
 * Updated: 2026-04-07
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Production values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

// إعدادات إعادة المحاولة
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
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
      'x-client-info': 'mmc-mms-frontend-v7.1',
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

    console.log('✅ Supabase Health Check passed');
    connectionStatus = 'connected';
    return {
      status: 'OK',
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
    startConnectionMonitor(15000);
    persistentConnectionInitialized = true;
    console.log('✅ تم تهيئة نظام الاتصال الدائم بنجاح');
  } catch (error) {
    console.error('❌ فشل تهيئة نظام الاتصال:', error);
  }
}

export default supabase;

// ============================================================================
// نظام تسجيل النشاط والتحقق من الأجهزة
// ============================================================================

/**
 * توليد بصمة فريدة للجهاز
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
 */
export async function checkDeviceLogin(patientId) {
  try {
    const deviceFingerprint = generateDeviceFingerprint();
    const today = new Date().toISOString().split('T')[0];

    const { data: existingLogin, error } = await supabase
      .from('device_logins')
      .select('patient_id')
      .eq('device_fingerprint', deviceFingerprint)
      .eq('login_date', today)
      .maybeSingle();

    if (error) {
      console.error('خطأ في التحقق من الجهاز:', error);
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
 * تسجيل نشاط يومي
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
        performed_by: details.performedBy || 'system',
        timestamp: new Date().toISOString(),
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
 * دالة مساعدة للحصول على إعدادات النظام
 */
export async function getSystemSetting(key) {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data?.value || null;
  } catch (error) {
    console.error(`خطأ في الحصول على إعداد ${key}:`, error);
    return null;
  }
}

/**
 * دالة مساعدة لتعيين إعدادات النظام
 */
export async function setSystemSetting(key, value) {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`خطأ في تعيين إعداد ${key}:`, error);
    return false;
  }
}
