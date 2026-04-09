// lib/routingManager.js - مدير مسارات المراجعين بين العيادات
import db from './supabase-client.js';
import { getSystemConfig } from './settings.js';

/**
 * جلب المسار الكامل لمراجع معين
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Array>} قائمة العيادات في المسار
 */
export async function getPatientRoute(patientId) {
  try {
    const { data, error } = await db
      .from('patient_routes')
      .select(`
        *,
        clinics (*)
      `)
      .eq('patient_id', patientId)
      .order('step_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * جلب العيادة الحالية للمراجع
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object|null>} العيادة الحالية
 */
export async function getCurrentClinic(patientId) {
  try {
    const { data, error } = await db
      .from('patient_routes')
      .select(`
        *,
        clinics (*)
      `)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('step_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    return null;
  }
}

/**
 * الانتقال للعيادة التالية في المسار
 * @param {string} patientId - معرف المراجع
 * @param {number} currentClinicId - معرف العيادة الحالية
 * @returns {Promise<Object|null>} العيادة التالية
 */
export async function advanceToNextClinic(patientId, currentClinicId) {
  try {
    const now = new Date().toISOString();

    // 1. تحديث العيادة الحالية إلى مكتملة
    const { error: updateError } = await db
      .from('patient_routes')
      .update({ 
        status: 'completed', 
        completed_at: now, 
        updated_at: now 
      })
      .eq('patient_id', patientId)
      .eq('clinic_id', currentClinicId)
      .eq('status', 'active');

    if (updateError) throw updateError;

    // 2. البحث عن العيادة التالية
    const { data: nextStep, error: nextError } = await db
      .from('patient_routes')
      .select(`
        *,
        clinics (*)
      `)
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .order('step_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) throw nextError;

    if (nextStep) {
      // 3. تفعيل العيادة التالية
      const { error: activateError } = await db
        .from('patient_routes')
        .update({ 
          status: 'active', 
          updated_at: now 
        })
        .eq('id', nextStep.id);

      if (activateError) throw activateError;

      // 4. إضافة المراجع لطابور العيادة الجديدة
      const { error: queueError } = await db
        .from('queues')
        .insert({
          patient_id: patientId,
          clinic_id: nextStep.clinic_id,
          status: 'waiting',
          queue_date: now.split('T')[0],
          display_number: await getNextDisplayNumber(nextStep.clinic_id),
          created_at: now,
          updated_at: now
        });

      if (queueError) throw queueError;

      return nextStep;
    }

    return null; // لا توجد عيادات تالية
  } catch (error) {
    return null;
  }
}

/**
 * جلب رقم الدور التالي لعيادة معينة
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<number>} رقم الدور التالي
 */
async function getNextDisplayNumber(clinicId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('queues')
      .select('display_number')
      .eq('clinic_id', clinicId)
      .eq('queue_date', today)
      .order('display_number', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return 1;
    return (data[0].display_number || 0) + 1;
  } catch (error) {
    return 1;
  }
}

/**
 * التحقق من اكتمال جميع العيادات في المسار
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<boolean>} هل اكتمل المسار
 */
export async function isRouteCompleted(patientId) {
  try {
    const { data, error } = await db
      .from('patient_routes')
      .select('id')
      .eq('patient_id', patientId)
      .neq('status', 'completed');

    if (error) throw error;
    return data.length === 0;
  } catch (error) {
    return false;
  }
}
