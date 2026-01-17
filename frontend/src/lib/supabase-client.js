/**
 * Supabase Client Configuration
 * تكوين عميل Supabase مع اتصال غير قابل للتوقف
 * الميزات: إعادة المحاولة التلقائية + Health Check + Realtime
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Production values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

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
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-client-info': 'mmc-mms-frontend'
    }
  }
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
      const delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(2, i), RETRY_CONFIG.maxDelay);
      console.warn(`⚠️ محاولة ${i + 1}/${retries} فشلت. إعادة المحاولة بعد ${delay}ms...`);
      connectionStatus = 'reconnecting';
      reconnectAttempts = i + 1;
      
      if (i === retries - 1) {
        connectionStatus = 'disconnected';
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
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
    
    if (clinicsError) throw new Error('DB_CONNECTION_FAILED: ' + clinicsError.message);

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
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Supabase Health Check failed:', error);
    connectionStatus = 'error';
    return {
      status: 'ERROR',
      error: error.message,
      connectionStatus,
      timestamp: new Date().toISOString()
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
    timestamp: new Date().toISOString()
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

export default supabase;
