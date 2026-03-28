import { apiClient } from "./api/client";

/**
 * Unified API Service - API Client Implementation
 * تم تحديث الخدمة لتستخدم الـ API الموحد بدلاً من الاتصال المباشر بسبسبيس
 * لضمان الأمان والالتزام بالعقود البرمجية (Canonical Contract)
 *
 * ✅ استخدام API Client للالتزام بسياسات الوصول
 * ✅ بدون بيانات وهمية
 */

/**
 * Fix 6 & 43: Null-safe unwrap helper
 * Ensures we always have a valid value or a safe default.
 */
export function unwrap(data, defaultValue = null) {
  if (data === null || data === undefined) {
    return defaultValue;
  }
  // If it's an object with a 'data' property (common API pattern), unwrap it
  if (typeof data === 'object' && data !== null && 'data' in data && data.data !== undefined) {
    return data.data;
  }
  return data;
}

/**
 * Fix 7 & 48: Support null-safe and undefined prevention
 */
export function safeGet(obj, path, defaultValue = null) {
  const travel = regexp =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === null ? defaultValue : result;
}

/**
 * Normalize response data structure
 */
function normalizeResponse(data) {
  return unwrap(data, {});
}

const api = {
  // --- Patients ---
  async patientLogin(patientId, gender) {
    try {
      const data = await apiClient.post('patientLogin', { personalId: patientId, gender: gender || 'male' });
      const normalized = normalizeResponse(data);
      // Fix 30: Support valid/isValid check
      const patient = normalized.patient || normalized;
      return { 
        success: true, 
        data: patient,
        isValid: !!patient
      };
    } catch (error) {
      console.error('[API_SERVICE][Login]:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Queue ---
  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null) {
    try {
      const data = await apiClient.post('queueEnter', {
        clinicId,
        patientId,
        patientName,
        examType
      });
      const normalized = normalizeResponse(data);
      return {
        success: true,
        ...normalized
      };
    } catch (error) {
      console.error('[API_SERVICE][EnterQueue]:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      const data = await apiClient.get('queueStatus', { clinicId });
      const normalized = normalizeResponse(data);
      
      const patients = unwrap(normalized.patients, []);
      const patientInQueue = patients.find(p => p && (p.patientId === patientId || p.position === patientId));
      
      return {
        success: true,
        display_number: unwrap(patientInQueue?.position, 0),
        current_number: unwrap(normalized.currentNumber, 0),
        ahead: patientInQueue ? patients.indexOf(patientInQueue) : 0,
        status: patientInQueue ? 'waiting' : 'unknown',
        total_waiting: unwrap(normalized.queueLength, patients.length || 0)
      };
    } catch (error) {
      console.error('[API_SERVICE][GetPosition]:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId, pin) {
    try {
      // Fix 31: Use pinVerify for validation
      const data = await apiClient.post('pinVerify', { clinicId, pin });
      const normalized = normalizeResponse(data);
      
      if (unwrap(normalized.verified, false) || unwrap(normalized.valid, false)) {
        return { success: true, data: normalized };
      }
      return { success: false, error: 'رقم PIN غير صحيح' };
    } catch (error) {
      console.error('[API_SERVICE][QueueDone]:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Clinics ---
  async getClinics() {
    try {
      const data = await apiClient.get('clinics');
      return { success: true, data: unwrap(data, []) };
    } catch (error) {
      console.error('[API_SERVICE][GetClinics]:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Settings ---
  async getSettings() {
    try {
      const data = await apiClient.get('settings');
      return { success: true, data: unwrap(data, {}) };
    } catch (error) {
      console.error('[API_SERVICE][GetSettings]:', error);
      return { success: false, error: error.message };
    }
  },

  // --- PIN Management ---
  async getCurrentPin(clinicId) {
    try {
      const data = await apiClient.get('pinStatus', { clinicId });
      const normalized = normalizeResponse(data);
      
      return {
        success: true,
        currentPin: unwrap(normalized.pin, null),
        totalIssued: unwrap(normalized.has_active_pin, false) ? 1 : 0,
        dateKey: unwrap(normalized.checked_at, new Date().toISOString()).split('T')[0],
        allPins: unwrap(normalized.pin, null) ? [normalized.pin] : []
      };
    } catch (error) {
      console.error('[API_SERVICE][GetCurrentPin]:', error);
      return { success: false, error: error.message };
    }
  },

  async issuePin(clinicId) {
    try {
      const data = await apiClient.post('pinGenerate', { clinic_id: clinicId });
      return { success: true, data: unwrap(data, {}) };
    } catch (error) {
      console.error('[API_SERVICE][IssuePIN]:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;
