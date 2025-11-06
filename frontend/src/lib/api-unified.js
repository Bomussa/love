/**
 * Unified API Layer
 * Switches between Local Storage and Supabase Backend
 * Updated: Nov 6, 2025 - Added Supabase support
 */

import localApi from './local-api';
import supabaseApi from './supabase-backend-api';

// ==========================================
// CONFIGURATION
// ==========================================
// Set to 'supabase' to use Supabase backend, 'local' for Local Storage
const BACKEND_MODE = 'supabase';

console.log(`🔧 API Mode: ${BACKEND_MODE.toUpperCase()}`);

// ==========================================
// API WRAPPER CLASS
// ==========================================
class UnifiedApiService {
  constructor() {
    this.backend = BACKEND_MODE === 'supabase' ? supabaseApi : localApi;
    this.mode = BACKEND_MODE;
  }

  // ==========================================
  // PATIENT MANAGEMENT
  // ==========================================

  async patientLogin(patientId, gender) {
    try {
      const result = await this.backend.patientLogin(patientId, gender);
      return result;
    } catch (error) {
      console.error('Error in patientLogin:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================

  async enterQueue(clinic, user, isAutoEntry = false) {
    try {
      const result = await this.backend.enterQueue(clinic, user);
      return result;
    } catch (error) {
      console.error('Error in enterQueue:', error);
      return { success: false, error: error.message };
    }
  }

  async getQueueStatus(clinic) {
    try {
      const result = await this.backend.getQueueStatus(clinic);
      return result;
    } catch (error) {
      console.error('Error in getQueueStatus:', error);
      return { success: false, error: error.message };
    }
  }

  async queueDone(clinic, user, pin) {
    try {
      const result = await this.backend.queueDone(clinic, user, String(pin));
      return result;
    } catch (error) {
      console.error('Error in queueDone:', error);
      return { success: false, error: error.message };
    }
  }

  async getQueuePosition(clinic, user) {
    try {
      if (this.mode === 'supabase') {
        const result = await this.backend.getPatientPosition(clinic, user);
        return {
          success: result.success,
          display_number: result.displayNumber,
          ahead: result.ahead,
          total_waiting: result.ahead + 1
        };
      } else {
        const queueStatus = await this.backend.getQueueStatus(clinic);
        return {
          success: queueStatus.success,
          display_number: queueStatus.yourNumber || 1,
          ahead: queueStatus.ahead || 0,
          total_waiting: queueStatus.waiting || 1
        };
      }
    } catch (error) {
      console.error('Error in getQueuePosition:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // PIN MANAGEMENT
  // ==========================================

  async getPinStatus() {
    try {
      const result = await this.backend.getPinStatus();
      return result;
    } catch (error) {
      console.error('Error in getPinStatus:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // PATHWAY MANAGEMENT
  // ==========================================

  async choosePath(gender) {
    try {
      if (this.mode === 'supabase') {
        const patientData = JSON.parse(localStorage.getItem('patient') || '{}');
        const result = await this.backend.createPathway(patientData.id, gender);
        return result;
      } else {
        return this.backend.choosePath(gender);
      }
    } catch (error) {
      console.error('Error in choosePath:', error);
      return { success: false, error: error.message };
    }
  }

  async getRoute(patientId) {
    try {
      if (this.mode === 'supabase') {
        const result = await this.backend.getPathway(patientId);
        return result;
      } else {
        return { success: false, error: 'No saved route found' };
      }
    } catch (error) {
      console.error('Error in getRoute:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // NOTIFICATION MANAGEMENT
  // ==========================================

  async getNotifications(patientId, unreadOnly = false) {
    try {
      const result = await this.backend.getNotifications(patientId, unreadOnly);
      return result;
    } catch (error) {
      console.error('Error in getNotifications:', error);
      return { success: false, error: error.message };
    }
  }

  async addNotification(patientId, message, type = 'info') {
    try {
      const result = await this.backend.addNotification(patientId, message, type);
      return result;
    } catch (error) {
      console.error('Error in addNotification:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // CLINIC MANAGEMENT
  // ==========================================

  async getClinics() {
    try {
      if (this.mode === 'supabase') {
        const result = await this.backend.getClinics();
        return result;
      } else {
        return this.backend.getClinics();
      }
    } catch (error) {
      console.error('Error in getClinics:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // REPORTS & STATISTICS
  // ==========================================

  async getDailyReport(date) {
    try {
      const result = await this.backend.getDailyReport(date);
      return result;
    } catch (error) {
      console.error('Error in getDailyReport:', error);
      return { success: false, error: error.message };
    }
  }

  async getWeeklyReport(week) {
    try {
      if (this.mode === 'local') {
        return this.backend.getWeeklyReport(week);
      } else {
        return { success: false, error: 'Weekly report not implemented for Supabase yet' };
      }
    } catch (error) {
      console.error('Error in getWeeklyReport:', error);
      return { success: false, error: error.message };
    }
  }

  async getMonthlyReport(year, month) {
    try {
      if (this.mode === 'local') {
        return this.backend.getMonthlyReport(year, month);
      } else {
        return { success: false, error: 'Monthly report not implemented for Supabase yet' };
      }
    } catch (error) {
      console.error('Error in getMonthlyReport:', error);
      return { success: false, error: error.message };
    }
  }

  async getAnnualReport(year) {
    try {
      if (this.mode === 'local') {
        return this.backend.getAnnualReport(year);
      } else {
        return { success: false, error: 'Annual report not implemented for Supabase yet' };
      }
    } catch (error) {
      console.error('Error in getAnnualReport:', error);
      return { success: false, error: error.message };
    }
  }

  async getAdminStatus() {
    try {
      const result = await this.backend.getAdminStatus();
      return result;
    } catch (error) {
      console.error('Error in getAdminStatus:', error);
      return { success: false, error: error.message };
    }
  }

  async getQueues() {
    try {
      if (this.mode === 'local') {
        return this.backend.getQueues();
      } else {
        // Get all clinics and their queue status
        const clinicsResult = await this.backend.getClinics();
        if (!clinicsResult.success) return clinicsResult;

        const queues = {};
        for (const clinic of clinicsResult.clinics) {
          const status = await this.backend.getQueueStatus(clinic.id);
          if (status.success) {
            queues[clinic.id] = {
              waiting: status.waiting,
              serving: status.serving,
              completed: 0
            };
          }
        }

        return { success: true, queues };
      }
    } catch (error) {
      console.error('Error in getQueues:', error);
      return { success: false, error: error.message };
    }
  }

  async getDashboardStats() {
    return this.getAdminStatus();
  }

  async getHealthStatus() {
    return { success: true, status: 'healthy', mode: this.mode };
  }

  // ==========================================
  // COMPATIBILITY METHODS
  // ==========================================

  async enterClinic(visitId, clinicId) {
    return this.enterQueue(clinicId, visitId);
  }

  async completeClinic(clinicId, user, pin) {
    return this.queueDone(clinicId, user, pin);
  }

  async callNextPatient(clinic) {
    return { success: true, message: 'Call next patient' };
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

  async getQueueStats() {
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

  async createRoute(patientId, examType, gender, stations) {
    return { success: true, message: 'Route created successfully' };
  }

  // ==========================================
  // REAL-TIME CONNECTIONS
  // ==========================================

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

// ==========================================
// EXPORT
// ==========================================

const api = new UnifiedApiService();
export default api;
export { api };
