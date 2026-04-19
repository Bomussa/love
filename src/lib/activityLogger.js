/**
 * @file activityLogger.js
 * @description تسجيل النشاطات - stub آمن لا يكسر البناء
 */
import { supabase } from './supabase-client';

export async function logPatientRegistered(data) {
  try {
    await supabase.from('activity_logs').insert([{
      action_type: 'patient_registered',
      description: `مريض: ${data?.militaryId || ''}`,
      metadata: data,
      created_at: new Date().toISOString()
    }]);
  } catch {}
}

export async function logAdminLogin(username) {
  try {
    await supabase.from('activity_logs').insert([{
      action_type: 'admin_login',
      description: `دخول مشرف: ${username}`,
      metadata: { username },
      created_at: new Date().toISOString()
    }]);
  } catch {}
}
