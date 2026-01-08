// Unified API Service - Auto-fallback to local storage
import localApi from './local-api.js';
import { request } from './request.js';

const API_VERSION = '/api/v1';

class UnifiedApiService {
  constructor() {
    this.useLocal = false;
    this.checkBackend();
  }

  async checkBackend() {
    try {
      // استخدام المسار الصحيح /api/v1/status بدلاً من /api/v1/health/status
      const response = await fetch(`${window.location.origin}${API_VERSION}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        this.useLocal = false;

      } else {
        this.useLocal = true;

      }
    } catch (e) {
      this.useLocal = true;

    }
  }

async request(endpoint, options = {}) {
    // Always try local first for now (since backend is not working)
    // this.useLocal = true;
    
    if (this.useLocal) {
      // Route to local API
      return this.routeToLocal(endpoint, options);
    }

    // Try backend using the unified request function
    try {
      return await request(endpoint, options);
    } catch (err) {
      // console.error('Backend error, falling back to local:', err);
      this.useLocal = true;
      return this.routeToLocal(endpoint, options);
    }
  }

  async routeToLocal(endpoint, options) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    // Route to appropriate local API method
    if (endpoint.includes('/patient/login') && method === 'POST') {
      return localApi.patientLogin(body.patientId, body.gender);
    }
    
    if (endpoint.includes('/queue/enter') && method === 'POST') {
      return localApi.enterQueue(body.clinic, body.user);
    }
    
    if (endpoint.includes('/queue/status') || endpoint.includes('/queue-status')) {
      const clinic = new URL(window.location.origin + endpoint).searchParams.get('clinic');
      return localApi.getQueueStatus(clinic);
    }
    
    if (endpoint.includes('/queue/done') && method === 'POST') {
      return localApi.queueDone(body.clinic, body.user, body.pin);
    }
    
    if (endpoint.includes('/queue/call') && method === 'POST') {
      return localApi.callNextPatient(body.clinic);
    }
    
    if (endpoint.includes('/pin/status') || endpoint.includes('/pin-status')) {
      return localApi.getPinStatus();
    }
    
    if (endpoint.includes('/path/choose')) {
      return localApi.choosePath(body?.gender);
    }
    
    if (endpoint.includes('/admin/status')) {
      return localApi.getAdminStatus();
    }
    
    if (endpoint.includes('/stats/queues')) {
      return localApi.getQueues();
    }
    
    if (endpoint.includes('/stats/dashboard')) {
      return localApi.getDashboardStats();
    }
    
    if (endpoint.includes('/health/status') || endpoint.includes('/status')) {
      return localApi.getHealthStatus();
    }

    return { success: false, error: 'Endpoint not implemented' };
  }

  // ==========================================
  // Public API Methods
  // ==========================================

  async patientLogin(patientId, gender) {
    return this.request(`${API_VERSION}/patient/login`, {
      method: 'POST',
      body: { patientId, gender }
    });
  }

  async enterQueue(clinic, user, isAutoEntry = false) {
    return this.request(`${API_VERSION}/queue/enter`, {
      method: 'POST',
      body: { clinic, user, isAutoEntry }
    });
  }

  async getQueueStatus(clinic) {
    return this.request(`${API_VERSION}/queue/status?clinic=${clinic}`);
  }

  async queueDone(clinic, user, pin) {
    return this.request(`${API_VERSION}/queue/done`, {
      method: 'POST',
      body: { clinic, user, pin: String(pin) }
    });
  }

  async callNextPatient(clinic) {
    return this.request(`${API_VERSION}/queue/call`, {
      method: 'POST',
      body: { clinic }
    });
  }

  async getPinStatus() {
    return this.request(`${API_VERSION}/pin/status`);
  }

  async choosePath(gender) {
    return this.request(`${API_VERSION}/path/choose`, {
      method: 'POST',
      body: { gender }
    });
  }

  async getAdminStatus() {
    return this.request(`${API_VERSION}/admin/status`);
  }

  async getHealthStatus() {
    // استخدام المسار الموحد /api/v1/status
    return this.request(`${API_VERSION}/status`);
  }

  async getQueues() {
    return this.request(`${API_VERSION}/stats/queues`);
  }

  async getQueueStats() {
    return this.request(`${API_VERSION}/stats/dashboard`);
  }

  async getDashboardStats() {
    return this.getAdminStatus();
  }

  async adminLogin(username, password) {
    return this.request(`${API_VERSION}/admin/login`, {
      method: 'POST',
      body: { username, password }
    });
  }

  // ==========================================
  // Compatibility Methods
  // ==========================================

  async enterClinic(visitId, clinicId) {
    return this.enterQueue(clinicId, visitId);
  }

  async completeClinic(clinicId, user, pin) {
    return this.queueDone(clinicId, user, pin);
  }

  async selectExam(patientId, examType) {
    return { success: true, patientId, examType, status: 'selected' };
  }

  async getClinics() {
    return localApi.getClinics();
  }

  async getActiveQueue() {
    return this.getQueues();
  }

  async getClinicOccupancy() {
    return this.getQueues();
  }

  async getWaitTimes() {
    return this.getQueues();
  }

  async getThroughputStats() {
    return this.getAdminStatus();
  }

  async adminLogin(code) {
    // هذه الوظيفة لم تعد تستخدم في الواجهة الأمامية بعد التعديل
    return { success: false, error: 'Deprecated' };
  }

  async pauseQueue(queueType, adminCode) {
    return { success: true, message: 'Queue paused' };
  }

  async resetSystem(adminCode) {
    return { success: true, message: 'System reset' };
  }

  async generatePIN(stationId, adminCode) {
    return this.getPinStatus();
  }

  async deactivatePIN(pinId, adminCode) {
    return { success: true, message: 'PIN deactivated' };
  }

  async getActivePINs(adminCode) {
    return this.getPinStatus();
  }

  async generateReport(type, format, adminCode) {
    return { success: true, report: 'Generated' };
  }

  async getRecentReports(adminCode) {
    return { success: true, reports: [] };
  }

  connectSSE(clinic, callback) {
    // Polling fallback for SSE
    const pollInterval = setInterval(async () => {
      try {
        const status = await this.getQueueStatus(clinic);
        if (status.success) {
          callback({ type: 'queue_update', data: status });
        }
      } catch (e) {
        // console.error('Polling error:', e);
      }
    }, 5000);

    return {
      close: () => clearInterval(pollInterval)
    };
  }

  connectWebSocket() {
    return {
      onopen: () => {},
      onclose: () => {},
      onerror: () => {},
      close: () => {}
    };
  }
}

const api = new UnifiedApiService();
export default api;
export { api };


