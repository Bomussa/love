/**
 * Unified API Layer - Medical Committee System
 * المصدر الوحيد للحقيقة: توجيه كافة الطلبات عبر Backend API
 * يمنع الاتصال المباشر بـ Supabase من الواجهة الأمامية لضمان الأمان وتوحيد المنطق.
 */
const API_BASE_URL = 'https://api.mmc-mms.com/api/v1';
class UnifiedApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const response = await fetch(url, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'API Request failed');
    }
    return await response.json();
  }
  async patientLogin(patientId, gender) {
    return this.request('/patients/login', {
      method: 'POST',
      body: JSON.stringify({ patientId, gender }),
    });
  }
  async enterQueue(clinicId, patientId, isAutoEntry = false) {
    return this.request('/queue/enter', {
      method: 'POST',
      body: JSON.stringify({ clinicId, patientId, isAutoEntry }),
    });
  }
  async getQueueStatus(clinicId, patientId) {
    return this.request(`/queue/status?clinicId=${clinicId}&patientId=${patientId}`);
  }
  async queueDone(clinicId, patientId, pin) {
    return this.request('/queue/done', {
      method: 'POST',
      body: JSON.stringify({ clinicId, patientId, pin }),
    });
  }
  async callNextPatient(clinicId, pin) {
    return this.request('/queue/next', {
      method: 'POST',
      body: JSON.stringify({ clinicId, pin }),
    });
  }
  async getQueuePosition(clinicId, patientId) {
    return this.request(`/queue/position/${clinicId}/${patientId}`);
  }
  async generatePIN(clinicId) {
    return this.request('/pin/generate', {
      method: 'POST',
      body: JSON.stringify({ clinicId }),
    });
  }
  async verifyPin(clinicId, pin) {
    return this.request('/pin/validate', {
      method: 'POST',
      body: JSON.stringify({ clinicId, pin }),
    });
  }
  async getPathway(patientId) {
    return this.request(`/pathway/${patientId}`);
  }
  async getClinics() {
    return this.request('/clinics');
  }
  async adminLogin(username, password) {
    return this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }
}
const api = new UnifiedApiService();
export default api;
export { api };
