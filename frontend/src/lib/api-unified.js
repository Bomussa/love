// Unified API Service - Auto-fallback: Supabase -> Local Storage
import supabaseApi from './supabase-api';
import localApi from './local-api';

const API_VERSION = '/api/v1';
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE !== 'false'; // Default to true

class UnifiedApiService {
  constructor() {
    this.useSupabase = USE_SUPABASE;
    this.useLocal = !USE_SUPABASE;
    
    if (this.useSupabase) {
      console.log('✅ Using Supabase as primary backend');
    } else {
      console.log('⚠️  Using Local Storage as backend');
    }
  }

  async request(endpoint, options = {}) {
    // Try Supabase first if enabled
    if (this.useSupabase) {
      try {
        return await this.routeToSupabase(endpoint, options);
      } catch (error) {
        console.error('❌ Supabase error, falling back to local:', error);
        return await this.routeToLocal(endpoint, options);
      }
    }
    
    // Use local storage
    return await this.routeToLocal(endpoint, options);
  }

  async routeToSupabase(endpoint, options) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;

    // Patient operations
    if (endpoint.includes('/patient/login') && method === 'POST') {
      return await supabaseApi.patientLogin(body.patientId, body.gender);
    }
    
    // Queue operations
    if (endpoint.includes('/queue/enter') && method === 'POST') {
      return await supabaseApi.enterQueue(body.clinic, body.user, body.examType, body.gender);
    }
    
    if (endpoint.includes('/queue/status')) {
      const clinic = new URL(window.location.origin + endpoint).searchParams.get('clinic');
      return await supabaseApi.getQueueStatus(clinic, body?.user);
    }
    
    if (endpoint.includes('/queue/done') && method === 'POST') {
      return await supabaseApi.queueDone(body.clinic, body.user, body.pin);
    }
    
    if (endpoint.includes('/queue/call') && method === 'POST') {
      return await supabaseApi.callNextPatient(body.clinic);
    }
    
    // PIN operations
    if (endpoint.includes('/pin/status')) {
      return await supabaseApi.getPinStatus();
    }
    
    // Pathway operations
    if (endpoint.includes('/path/choose')) {
      return await supabaseApi.choosePath(body.patientId, body.examType, body.gender);
    }
    
    // Clinic operations
    if (endpoint.includes('/clinics')) {
      return await supabaseApi.getClinics();
    }
    
    // Notification operations
    if (endpoint.includes('/notifications') && method === 'GET') {
      return await supabaseApi.getNotifications(body?.patientId, body?.unreadOnly);
    }
    
    // Admin operations - fallback to local for now
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
      return { success: true, status: 'healthy', backend: 'supabase' };
    }

    throw new Error('Endpoint not implemented in Supabase');
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
    // Get patient data from localStorage for Supabase
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
    if (this.useSupabase) {
      return supabaseApi.getClinics();
    }
    return localApi.getClinics();
  }

  async getNotifications(patientId, unreadOnly = false) {
    if (this.useSupabase) {
      return supabaseApi.getNotifications(patientId, unreadOnly);
    }
    return { success: true, notifications: [] };
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

// Updated with Supabase support - Nov 5, 2025
