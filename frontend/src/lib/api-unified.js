// Unified API Service - Local Storage Only (No Supabase)
import localApi from './local-api';

const API_VERSION = '/api/v1';
// Force Local Storage mode - Supabase disabled
const USE_LOCAL_STORAGE = true;

class UnifiedApiService {
  constructor() {
    this.useLocal = USE_LOCAL_STORAGE;
    console.log('✅ Using Local Storage as primary backend (Supabase disabled)');
  }

  async request(endpoint, options = {}) {
    // Use local storage only
    return await this.routeToLocal(endpoint, options);
  }

  async routeToLocal(endpoint, options) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    // Route to appropriate local API method
    if ((endpoint.includes('/patient/login') || endpoint.includes('/patients/login')) && method === 'POST') {
      return localApi.patientLogin(body.patientId, body.gender);
    }
    
    if (endpoint.includes('/queue/enter') && method === 'POST') {
      return localApi.enterQueue(body.clinic, body.user);
    }
    
    if (endpoint.includes('/queue/status')) {
      const clinic = new URL(window.location.origin + endpoint).searchParams.get('clinic');
      return localApi.getQueueStatus(clinic);
    }
    
    if (endpoint.includes('/queue/done') && method === 'POST') {
      return localApi.queueDone(body.clinic, body.user, body.pin);
    }
    
    if (endpoint.includes('/queue/call') && method === 'POST') {
      return localApi.callNextPatient(body.clinic);
    }
    
    if (endpoint.includes('/pin/status')) {
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
    
    if (endpoint.includes('/health/status')) {
      return localApi.getHealthStatus();
    }

    if (endpoint.includes('/reports/daily')) {
      return localApi.getDailyReport(body?.date);
    }

    if (endpoint.includes('/reports/weekly')) {
      return localApi.getWeeklyReport(body?.week);
    }

    if (endpoint.includes('/reports/monthly')) {
      return localApi.getMonthlyReport(body?.year, body?.month);
    }

    if (endpoint.includes('/reports/annual')) {
      return localApi.getAnnualReport(body?.year);
    }

    if (endpoint.includes('/notifications')) {
      return localApi.getNotifications(body?.patientId, body?.unreadOnly);
    }

    return { success: false, error: 'Endpoint not implemented' };
  }

  // ==========================================
  // Public API Methods
  // ==========================================

  async patientLogin(patientId, gender) {
    return this.request(`${API_VERSION}/patient/login`, {
      method: 'POST',
      body: JSON.stringify({ patientId, gender })
    });
  }

  async enterQueue(clinic, user, isAutoEntry = false) {
    // Get patient data from localStorage for Local Storage
    const patientData = JSON.parse(localStorage.getItem('patient') || '{}');
    const examType = localStorage.getItem('examType') || 'recruitment';
    const gender = patientData.gender || 'male';
    
    return this.request(`${API_VERSION}/queue/enter`, {
      method: 'POST',
      body: JSON.stringify({ 
        clinic, 
        user, 
        isAutoEntry,
        examType,
        gender
      })
    });
  }

  async getQueueStatus(clinic) {
    const patientData = JSON.parse(localStorage.getItem('patient') || '{}');
    return this.request(`${API_VERSION}/queue/status?clinic=${clinic}`, {
      method: 'GET',
      body: JSON.stringify({ user: patientData.id })
    });
  }

  async queueDone(clinic, user, pin) {
    return this.request(`${API_VERSION}/queue/done`, {
      method: 'POST',
      body: JSON.stringify({ clinic, user, pin: String(pin) })
    });
  }

  async callNextPatient(clinic) {
    return this.request(`${API_VERSION}/queue/call`, {
      method: 'POST',
      body: JSON.stringify({ clinic })
    });
  }

  async getPinStatus() {
    return this.request(`${API_VERSION}/pin/status`);
  }

  async choosePath(gender) {
    const patientData = JSON.parse(localStorage.getItem('patient') || '{}');
    const examType = localStorage.getItem('examType') || 'recruitment';
    
    return this.request(`${API_VERSION}/path/choose`, {
      method: 'POST',
      body: JSON.stringify({ 
        patientId: patientData.id,
        examType,
        gender 
      })
    });
  }

  async getAdminStatus() {
    return this.request(`${API_VERSION}/admin/status`);
  }

  async getHealthStatus() {
    return this.request(`${API_VERSION}/health/status`);
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

  async getClinics() {
    return localApi.getClinics();
  }

  async getNotifications(patientId, unreadOnly = false) {
    return this.request(`${API_VERSION}/notifications`, {
      method: 'GET',
      body: JSON.stringify({ patientId, unreadOnly })
    });
  }

  // ==========================================
  // Reports Methods
  // ==========================================

  async getDailyReport(date) {
    return this.request(`${API_VERSION}/reports/daily`, {
      method: 'GET',
      body: JSON.stringify({ date: date || new Date().toISOString().split('T')[0] })
    });
  }

  async getWeeklyReport(week) {
    return this.request(`${API_VERSION}/reports/weekly`, {
      method: 'GET',
      body: JSON.stringify({ week })
    });
  }

  async getMonthlyReport(year, month) {
    return this.request(`${API_VERSION}/reports/monthly`, {
      method: 'GET',
      body: JSON.stringify({ year, month })
    });
  }

  async getAnnualReport(year) {
    return this.request(`${API_VERSION}/reports/annual`, {
      method: 'GET',
      body: JSON.stringify({ year: year || new Date().getFullYear() })
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
    return { success: code === 'admin123', token: 'mock-token' };
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

  // ==========================================
  // Route Management Methods
  // ==========================================

  async getRoute(patientId) {
    // Return empty route - let the pathway system handle it
    return { success: false, error: 'No saved route found' };
  }

  async createRoute(patientId, examType, gender, stations) {
    // Mock route creation - just return success
    return { success: true, message: 'Route created successfully' };
  }

  async getQueuePosition(clinic, user) {
    // Get queue status and calculate position
    const queueStatus = await this.getQueueStatus(clinic);
    if (queueStatus.success) {
      return {
        success: true,
        display_number: queueStatus.yourNumber || queueStatus.number || 1,
        ahead: queueStatus.ahead || 0,
        total_waiting: queueStatus.waiting || 1,
        entered_at: new Date().toISOString()
      };
    }
    return { success: false, error: 'Failed to get queue position' };
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
        console.error('Polling error:', e);
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

// Updated: Local Storage only - Supabase disabled - Nov 6, 2025
