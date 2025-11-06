/**
 * Supabase Client Wrapper
 * 
 * هذا الملف يوفر client موحد للاتصال بـ Supabase من جميع API endpoints
 * يستخدم Environment Variables للحفاظ على الأمان
 */

import { createClient } from '@supabase/supabase-js';

/**
 * إنشاء Supabase client
 * @param {Object} env - Environment variables من Cloudflare Workers
 * @returns {Object} Supabase client instance
 */
export function getSupabaseClient(env) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });
}

/**
 * Helper functions لعمليات CRUD الشائعة
 */

/**
 * الحصول على جميع الطوابير النشطة
 */
export async function getActiveQueues(supabase, clinicId = null) {
  let query = supabase
    .from('queue')
    .select('*')
    .in('status', ['waiting', 'called'])
    .order('position', { ascending: true });

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch queues: ${error.message}`);
  }

  return data;
}

/**
 * إضافة مريض إلى الطابور
 */
export async function addToQueue(supabase, patientData) {
  const { patient_id, patient_name, clinic_id, exam_type } = patientData;

  // الحصول على آخر position في الطابور
  const { data: lastEntry } = await supabase
    .from('queue')
    .select('position')
    .eq('clinic_id', clinic_id)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const nextPosition = lastEntry ? lastEntry.position + 1 : 1;

  const { data, error } = await supabase
    .from('queue')
    .insert({
      patient_id,
      patient_name,
      clinic_id,
      exam_type,
      status: 'waiting',
      position: nextPosition
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add to queue: ${error.message}`);
  }

  return data;
}

/**
 * استدعاء المريض التالي
 */
export async function callNextPatient(supabase, clinicId) {
  // الحصول على المريض التالي
  const { data: nextPatient, error: fetchError } = await supabase
    .from('queue')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !nextPatient) {
    return null;
  }

  // تحديث حالة المريض
  const { data, error } = await supabase
    .from('queue')
    .update({
      status: 'called',
      called_at: new Date().toISOString()
    })
    .eq('id', nextPatient.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to call patient: ${error.message}`);
  }

  return data;
}

/**
 * إكمال فحص المريض
 */
export async function completePatient(supabase, patientId) {
  const { data, error } = await supabase
    .from('queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('patient_id', patientId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete patient: ${error.message}`);
  }

  return data;
}

/**
 * الحصول على موقع المريض في الطابور
 */
export async function getPatientPosition(supabase, patientId) {
  const { data, error } = await supabase
    .from('queue')
    .select('position, status, clinic_id')
    .eq('patient_id', patientId)
    .single();

  if (error) {
    throw new Error(`Failed to get patient position: ${error.message}`);
  }

  return data;
}

/**
 * الحصول على إحصائيات العيادة
 */
export async function getClinicStats(supabase, clinicId) {
  const { data: queue, error } = await supabase
    .from('queue')
    .select('status, entered_at, completed_at')
    .eq('clinic_id', clinicId);

  if (error) {
    throw new Error(`Failed to get clinic stats: ${error.message}`);
  }

  const stats = {
    total_patients: queue.length,
    waiting: queue.filter(p => p.status === 'waiting').length,
    called: queue.filter(p => p.status === 'called').length,
    completed: queue.filter(p => p.status === 'completed').length,
    cancelled: queue.filter(p => p.status === 'cancelled').length
  };

  // حساب متوسط وقت الانتظار
  const completedPatients = queue.filter(p => p.status === 'completed' && p.completed_at);
  if (completedPatients.length > 0) {
    const totalWaitTime = completedPatients.reduce((sum, p) => {
      const wait = new Date(p.completed_at) - new Date(p.entered_at);
      return sum + wait;
    }, 0);
    stats.average_wait_time = Math.round(totalWaitTime / completedPatients.length / 1000 / 60); // بالدقائق
  } else {
    stats.average_wait_time = 0;
  }

  return stats;
}

/**
 * التحقق من PIN العيادة
 */
export async function verifyClinicPin(supabase, clinicId, pin) {
  const { data, error } = await supabase
    .from('clinics')
    .select('pin_code, pin_expires_at')
    .eq('id', clinicId)
    .single();

  if (error) {
    throw new Error(`Failed to verify PIN: ${error.message}`);
  }

  if (!data.pin_code) {
    return { valid: false, reason: 'No PIN set' };
  }

  if (data.pin_expires_at && new Date(data.pin_expires_at) < new Date()) {
    return { valid: false, reason: 'PIN expired' };
  }

  if (data.pin_code !== pin) {
    return { valid: false, reason: 'Invalid PIN' };
  }

  return { valid: true };
}

/**
 * إنشاء إشعار
 */
export async function createNotification(supabase, notificationData) {
  const { patient_id, clinic_id, type, title, message } = notificationData;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      patient_id,
      clinic_id,
      type,
      title,
      message
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data;
}

/**
 * الحصول على الإعدادات
 */
export async function getSettings(supabase, key = null) {
  let query = supabase.from('settings').select('*');

  if (key) {
    query = query.eq('key', key).single();
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get settings: ${error.message}`);
  }

  return data;
}

/**
 * تحديث الإعدادات
 */
export async function updateSettings(supabase, key, value, updatedBy = null) {
  const { data, error } = await supabase
    .from('settings')
    .upsert({
      key,
      value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }

  return data;
}

export default {
  getSupabaseClient,
  getActiveQueues,
  addToQueue,
  callNextPatient,
  completePatient,
  getPatientPosition,
  getClinicStats,
  verifyClinicPin,
  createNotification,
  getSettings,
  updateSettings
};

