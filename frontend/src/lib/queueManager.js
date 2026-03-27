import { apiClient } from "./api/client";
import { getSetting, getSystemConfig } from './settings.js';

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
 * جلب لقطة حالية للكيو في عيادة معينة عبر API
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<QueueSnapshot>} لقطة الكيو
 */
export async function getQueueSnapshot(clinicId) {
  try {
    const data = await apiClient.get('queueSnapshot', { clinicId });
    
    if (data && data.snapshot) {
      return data.snapshot;
    }
    
    return {
      waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
    };
  } catch (error) {
    console.error(`Error getting queue snapshot for clinic ${clinicId}:`, error);
    return {
      waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
    };
  }
}

/**
 * جلب تفاصيل الكيو مع أرقام المراجعين عبر API
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} تفاصيل الكيو
 */
export async function getQueueDetails(clinicId) {
  try {
    const data = await apiClient.get('queueDetails', { clinicId });
    
    if (data && data.details) {
      return data.details;
    }
    
    const snapshot = await getQueueSnapshot(clinicId);
    return {
      ...snapshot,
      patients: [],
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error getting queue details for clinic ${clinicId}:`, error);
    return {
      waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
      patients: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * تحديث حالة المراجع في الطابور
 * @param {number} clinicId - معرف العيادة
 * @param {number} patientId - معرف المراجع
 * @param {string} newStatus - الحالة الجديدة (waiting, called, in, done, no_show)
 * @returns {Promise<Object>} نتيجة التحديث
 */
export async function updateQueueStatus(clinicId, patientId, newStatus) {
  try {
    const data = await apiClient.post('updateQueueStatus', {
      clinicId,
      patientId,
      status: newStatus
    });
    return data;
  } catch (error) {
    console.error(`Error updating queue status:`, error);
    throw error;
  }
}

/**
 * استدعاء المراجع التالي في الطابور
 * @param {number} clinicId - معرف العيادة
 * @param {string} pin - رقم PIN للتحقق
 * @returns {Promise<Object>} بيانات المراجع المستدعى
 */
export async function callNextPatient(clinicId, pin) {
  try {
    const data = await apiClient.post('callNextPatient', {
      clinicId,
      pin
    });
    return data;
  } catch (error) {
    console.error(`Error calling next patient:`, error);
    throw error;
  }
}

/**
 * الحصول على حالة الطابور الحالية
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} حالة الطابور
 */
export async function getQueueStatus(clinicId) {
  try {
    const data = await apiClient.get('queueStatus', { clinicId });
    return data;
  } catch (error) {
    console.error(`Error getting queue status:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  getQueueSnapshot,
  getQueueDetails,
  updateQueueStatus,
  callNextPatient,
  getQueueStatus
};
