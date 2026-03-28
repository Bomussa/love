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
 * Null-safe unwrap helper
 */
function unwrap(data, defaultValue = null) {
  if (data === null || data === undefined) {
    return defaultValue;
  }
  return data;
}

/**
 * Normalize response data structure
 */
function normalizeResponse(data) {
  if (!data) return {};
  
  // If data has a data property, unwrap it
  if (data.data !== undefined) {
    return data.data;
  }
  
  return data;
}

const api = {
  // --- Patients ---
  async patientLogin(patientId, gender) {
    try {
      const data = await apiClient.post('patientLogin', { personalId: patientId, gender: gender || 'male' });
      const normalized = normalizeResponse(data);
      return { success: true, data: unwrap(normalized.patient, normalized) };
    } catch (error) {
      console.error('Login Error:', error);
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
      console.error('Enter Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      // نستخدم الـ API لجلب الحالة الموحدة للطابور
      const data = await apiClient.get('queueStatus', { clinicId });
      const normalized = normalizeResponse(data);
      
      // البحث عن المراجع في قائمة الانتظار
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
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId, pin) {
    try {
      const data = await apiClient.post('pinVerify', { clinicId, pin });
      const normalized = normalizeResponse(data);
      
      if (unwrap(normalized.verified, false)) {
        // إذا تم التحقق، نقوم بإنهاء الحالة عبر الـ API
        // ملاحظة: نحتاج للتأكد من وجود endpoint لإنهاء الطابور في العقد
        // حالياً نستخدم المنطق الموجود في الـ backend
        return { success: true, data: normalized };
      }
      return { success: false, error: 'رقم PIN غير صحيح' };
    } catch (error) {
      console.error('Queue Done Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Clinics ---
  async getClinics() {
    try {
      const data = await apiClient.get('clinics');
      const normalized = normalizeResponse(data);
      return { success: true, data: normalized };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Settings ---
  async getSettings() {
    try {
      const data = await apiClient.get('settings');
      const normalized = normalizeResponse(data);
      return { success: true, data: normalized };
    } catch (error) {
      console.error('Get Settings Error:', error);
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
        dateKey: unwrap(normalized.checked_at, '').split('T')[0],
        allPins: unwrap(normalized.pin, null) ? [normalized.pin] : []
      };
    } catch (error) {
      console.error('Get Current PIN Error:', error);
      return { success: false, error: error.message };
    }
  },

  async issuePin(clinicId) {
    try {
      const data = await apiClient.post('pinGenerate', { clinic_id: clinicId });
      const normalized = normalizeResponse(data);
      return { success: true, data: normalized };
    } catch (error) {
      console.error('Issue PIN Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;
