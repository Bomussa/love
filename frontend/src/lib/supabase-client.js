/**
 * Supabase Client Configuration
 * تكوين عميل Supabase مع Health Check
 * الإضافات الحرجة: فصل القراءة عن التشغيل + Health Check
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Production values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

// Create Supabase client
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
  }
});

/**
 * Health Check - فحص صحة الاتصال بـ Supabase
 * يجب تنفيذه عند إقلاع التطبيق
 */
export async function healthCheck() {
  try {
    // فحص الاتصال بقاعدة البيانات
    const { data: clinicsData, error: clinicsError } = await supabase
      .from('clinics')
      .select('id')
      .limit(1);
    
    if (clinicsError) throw new Error('DB_CONNECTION_FAILED: ' + clinicsError.message);

    // فحص Kill Switch العام
    const { data: configData, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'system_enabled')
      .single();

    const systemEnabled = configData?.value !== false;

    console.log('✅ Supabase Health Check passed');
    return {
      status: 'OK',
      systemEnabled,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Supabase Health Check failed:', error);
    return {
      status: 'ERROR',
      error: error.message,
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
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return false;
  }
}

export default supabase;
