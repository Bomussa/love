// lib/queueManager.js - مدير الكيو اللحظي مع المهلة الزمنية والاستدعاء التلقائي
// v2.3 - موحد على جدول queues
import db from './supabase-client.js';
import { getSystemConfig } from './settings.js';

/**
 * نوع بيانات لقطة الكيو
 * @typedef {Object} QueueSnapshot
 * @property {number} waiting - عدد المنتظرين
 * @property {number} called - عدد المستدعين
 * @property {number} in - عدد الموجودين داخل العيادة
 * @property {number} done - عدد المنتهين
 * @property {number} no_show - عدد الغائبين
 */

/**
 * جلب لقطة حالية للكيو في عيادة معينة
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<QueueSnapshot>} لقطة الكيو
 */
export async function getQueueSnapshot(clinicId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('queues')
      .select('status')
      .eq('clinic_id', clinicId)
      .eq('queue_date', today);

    if (error) throw error;

    const snapshot = {
      waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
    };
    
    data.forEach((row) => {
      const status = String(row.status).toLowerCase();
      if (status === 'waiting') snapshot.waiting++;
      else if (status === 'called') snapshot.called++;
      else if (status === 'serving' || status === 'in') snapshot.in++;
      else if (status === 'completed' || status === 'done') snapshot.done++;
      else if (status === 'no_show') snapshot.no_show++;
    });

    return snapshot;
  } catch (error) {
    return {
      waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
    };
  }
}

/**
 * جلب تفاصيل الكيو مع أرقام المراجعين
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} تفاصيل الكيو
 */
export async function getQueueDetails(clinicId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('queue_date', today)
      .order('display_number', { ascending: true });

    if (error) throw error;

    const snapshot = await getQueueSnapshot(clinicId);

    return {
      ...snapshot,
      patients: data,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      waiting: 0,
      called: 0,
      in: 0,
      done: 0,
      no_show: 0,
      patients: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * استدعاء المراجع التالي في الكيو
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} نتيجة الاستدعاء
 */
export async function callNextPatient(clinicId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // البحث عن أول مراجع في الانتظار
    const { data: nextRows, error: searchError } = await db
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .eq('queue_date', today)
      .order('display_number', { ascending: true })
      .limit(1);

    if (searchError || !nextRows || nextRows.length === 0) {
      return {
        success: false,
        reason: 'no_waiting',
        message: 'لا يوجد مراجعين في الانتظار',
      };
    }

    const patient = nextRows[0];
    const now = new Date();

    // تحديث حالة المراجع إلى "مستدعى"
    const { data: updated, error: updateError } = await db
      .from('queues')
      .update({ 
        status: 'called', 
        called_at: now.toISOString(),
        updated_at: now.toISOString() 
      })
      .eq('id', patient.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      success: true,
      patient: updated,
    };
  } catch (error) {
    return {
      success: false,
      reason: 'database_error',
      message: 'خطأ في قاعدة البيانات',
      error: error.message,
    };
  }
}

/**
 * تسجيل وصول المراجع للعيادة (تحويل من called إلى in)
 * @param {number} clinicId - معرف العيادة
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<boolean>} نجح التسجيل أم لا
 */
export async function checkInAtClinic(clinicId, patientId) {
  try {
    const { data, error } = await db
      .from('queues')
      .update({ 
        status: 'serving', 
        started_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      })
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'called')
      .select();

    return !error && data.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * إنهاء فحص المراجع في العيادة الحالية
 * @param {number} clinicId - معرف العيادة
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<boolean>} نجح الإنهاء أم لا
 */
export async function completeClinicForPatient(clinicId, patientId) {
  try {
    const { data, error } = await db
      .from('queues')
      .update({ 
        status: 'completed', 
        finished_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      })
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['serving', 'called'])
      .select();

    return !error && data.length > 0;
  } catch (error) {
    return false;
  }
}

export default {
  getQueueSnapshot,
  getQueueDetails,
  callNextPatient,
  checkInAtClinic,
  completeClinicForPatient
};
