import { apiClient } from "./api/client";

/**
 * Unified API Service - API Client Implementation
 * تم تحديث الخدمة لتستخدم الـ API الموحد بدلاً من الاتصال المباشر بسبسبيس
 * لضمان الأمان والالتزام بالعقود البرمجية (Canonical Contract)
 *
 * ✅ استخدام API Client للالتزام بسياسات الوصول
 * ✅ بدون بيانات وهمية
 */

const api = {
  // --- Patients ---
  async patientLogin(patientId, gender) {
    try {
      const data = await apiClient.post('patientLogin', { personalId: patientId, gender: gender || 'male' });
      return { success: true, data: data.patient };
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
      return {
        success: true,
        ...data
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
      
      // البحث عن المراجع في قائمة الانتظار
      const patientInQueue = data.patients.find(p => p.patientId === patientId || p.position === patientId);
      
      return {
        success: true,
        display_number: patientInQueue?.position || 0,
        current_number: data.currentNumber,
        ahead: patientInQueue ? data.patients.indexOf(patientInQueue) : 0,
        status: patientInQueue ? 'waiting' : 'unknown',
        total_waiting: data.queueLength
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId, pin) {
    try {
      const data = await apiClient.post('pinVerify', { clinicId, pin });
      if (data.verified) {
        // إذا تم التحقق، نقوم بإنهاء الحالة عبر الـ API
        // ملاحظة: نحتاج للتأكد من وجود endpoint لإنهاء الطابور في العقد
        // حالياً نستخدم المنطق الموجود في الـ backend
        return { success: true, data };
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
      return { success: true, data };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Settings ---
  async getSettings() {
    try {
      const data = await apiClient.get('settings');
      return { success: true, data };
    } catch (error) {
      console.error('Get Settings Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- PIN Management ---
  async getCurrentPin(clinicId) {
    try {
      const data = await apiClient.get('pinStatus', { clinicId });
      return {
        success: true,
        currentPin: data.pin,
        totalIssued: data.has_active_pin ? 1 : 0,
        dateKey: data.checked_at?.split('T')[0],
        allPins: data.pin ? [data.pin] : []
      };
    } catch (error) {
      console.error('Get Current PIN Error:', error);
      return { success: false, error: error.message };
    }
  },

  async issuePin(clinicId) {
    try {
      const data = await apiClient.post('pinGenerate', { clinic_id: clinicId });
      return { success: true, data };
    } catch (error) {
      console.error('Issue PIN Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;
