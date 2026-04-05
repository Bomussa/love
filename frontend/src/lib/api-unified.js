
import { supabase } from './supabase-client';

/**
 * Unified API Service - MMC Backend v5.0 Integration
 * ✅ PIN system REMOVED completely
 * ✅ Full support for WAITING → IN_PROGRESS → DONE
 * ✅ Authoritative API endpoints only
 */

const API_BASE = '/api/v1';

const api = {
  // --- Patients ---
  async patientLogin(personalId, gender) {
    try {
      const response = await fetch(`${API_BASE}/patient/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalId, gender })
      });
      return await response.json();
    } catch (error) {
      console.error('Login Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Queue ---
  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = 'recruitment', gender = 'male') {
    try {
      const response = await fetch(`${API_BASE}/queue/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, examType, gender })
      });
      const result = await response.json();
      if (result.success) {
        return { 
          success: true, 
          ...result.data,
          display_number: result.data.number,
          alreadyExists: result.data.already_exists
        };
      }
      return result;
    } catch (error) {
      console.error('Enter Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      const response = await fetch(`${API_BASE}/queue/position?user=${patientId}&clinic=${clinicId}`);
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Doctor Actions (NO PIN REQUIRED) ---
  async callNextPatient(clinicId) {
    try {
      const response = await fetch(`${API_BASE}/queue/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId })
      });
      return await response.json();
    } catch (error) {
      console.error('Call Next Error:', error);
      return { success: false, error: error.message };
    }
  },

  async startExam(queueId) {
    try {
      const response = await fetch(`${API_BASE}/queue/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId })
      });
      return await response.json();
    } catch (error) {
      console.error('Start Exam Error:', error);
      return { success: false, error: error.message };
    }
  },

  async advanceQueue(queueId, doctorClinicId, version) {
    try {
      const response = await fetch(`${API_BASE}/queue/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, doctorClinicId, version })
      });
      return await response.json();
    } catch (error) {
      console.error('Advance Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Settings & Stats ---
  async getSettings() {
    try {
      const response = await fetch(`${API_BASE}/settings`);
      return await response.json();
    } catch (error) {
      console.error('Get Settings Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getClinics() {
    try {
      const response = await fetch(`${API_BASE}/clinics`);
      const result = await response.json();
      return { success: result.success, clinics: result.data || [] };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message, clinics: [] };
    }
  },

  async getQueueStatus(clinicId) {
    try {
      const response = await fetch(`${API_BASE}/queue/status?clinicId=${clinicId}`);
      return await response.json();
    } catch (error) {
      console.error('Get Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Admin ---
  async adminLogin(username, password) {
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (result.success && result.data?.session?.token) {
        localStorage.setItem('mmc_admin_token', result.data.session.token);
      }
      return result;
    } catch (error) {
      console.error('Admin Login Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;
