/**
 * Supabase Client Configuration
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بـ Supabase
 * ويوفر client جاهز للاستخدام في جميع أنحاء التطبيق
 */

import { createClient } from '@supabase/supabase-js'

// Get configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration missing!')
  console.error('Please check your .env file')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'mmc-mms'
    }
  }
})

// Test connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error.message)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    return true
  } catch (err) {
    console.error('❌ Supabase connection error:', err)
    return false
  }
}

// Export for use in other files
export default supabase
