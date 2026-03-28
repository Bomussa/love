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

// Valid status transitions
const VALID_STATUSES = ['waiting', 'called', 'in', 'done', 'no_show'];

/**
 * Validate status value
 */
function validateStatus(status) {
  if (!status || !VALID_STATUSES.includes(status)) {
    console.warn(`Invalid status: ${status}, defaulting to 'waiting'`);
    return 'waiting';
  }
  return status;
}

/**
 * Clamp numeric values to prevent invalid numbers
 */
function clampNumber(value, min = 0, max = Infinity) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(num, max));
}

/**
 * جلب لقطة حالية للكيو في عيادة معينة عبر API
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<QueueSnapshot>} لقطة الكيو
 */
export async function getQueueSnapshot(clinicId) {
  try {
    // Validate clinicId
    if (!clinicId) {
      console.error('clinicId is required');
      return {
        waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
      };
    }

    const data = await apiClient.get('queueSnapshot', { clinicId });
    
    if (data && data.snapshot) {
      // Validate and clamp all numeric values
      return {
        waiting: clampNumber(data.snapshot.waiting),
        called: clampNumber(data.snapshot.called),
        in: clampNumber(data.snapshot.in),
        done: clampNumber(data.snapshot.done),
        no_show: clampNumber(data.snapshot.no_show),
      };
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
    // Validate clinicId
    if (!clinicId) {
      console.error('clinicId is required');
      return {
        waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
        patients: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const data = await apiClient.get('queueDetails', { clinicId });
    
    if (data && data.details) {
      // Validate patients array
      const patients = Array.isArray(data.details.patients) ? data.details.patients : [];
      
      // Remove duplicate entries
      const uniquePatients = Array.from(
        new Map(patients.map(p => [p.patientId, p])).values()
      );

      // Sort by timestamp
      uniquePatients.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });

      return {
        waiting: clampNumber(data.details.waiting),
        called: clampNumber(data.details.called),
        in: clampNumber(data.details.in),
        done: clampNumber(data.details.done),
        no_show: clampNumber(data.details.no_show),
        patients: uniquePatients,
        lastUpdated: data.details.lastUpdated || new Date().toISOString(),
      };
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
    // Validate inputs
    if (!clinicId || !patientId) {
      throw new Error('clinicId and patientId are required');
    }

    const validatedStatus = validateStatus(newStatus);

    const data = await apiClient.post('updateQueueStatus', {
      clinicId,
      patientId,
      status: validatedStatus
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
    // Validate inputs
    if (!clinicId) {
      throw new Error('clinicId is required');
    }

    // Get current queue details
    const queueDetails = await getQueueDetails(clinicId);
    
    // Check if queue is empty
    if (!queueDetails.patients || queueDetails.patients.length === 0) {
      console.warn(`Queue is empty for clinic ${clinicId}`);
      return {
        success: false,
        error: 'Queue is empty',
        patient: null
      };
    }

    // Get next patient (first in waiting status)
    const nextPatient = queueDetails.patients.find(p => 
      p && validateStatus(p.status) === 'waiting'
    );

    if (!nextPatient) {
      console.warn(`No waiting patients for clinic ${clinicId}`);
      return {
        success: false,
        error: 'No waiting patients',
        patient: null
      };
    }

    // Call API to update status
    const data = await apiClient.post('callNextPatient', {
      clinicId,
      pin,
      patientId: nextPatient.patientId
    });
    
    return data;
  } catch (error) {
    console.error(`Error calling next patient:`, error);
    // Return fallback instead of throwing
    return {
      success: false,
      error: error.message,
      patient: null
    };
  }
}

/**
 * الحصول على حالة الطابور الحالية
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} حالة الطابور
 */
export async function getQueueStatus(clinicId) {
  try {
    // Validate clinicId
    if (!clinicId) {
      console.error('clinicId is required');
      return {
        success: false,
        error: 'clinicId is required'
      };
    }

    const data = await apiClient.get('queueStatus', { clinicId });
    
    // Validate response structure
    if (data && typeof data === 'object') {
      return {
        success: true,
        ...data
      };
    }

    return {
      success: false,
      error: 'Invalid response format'
    };
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
