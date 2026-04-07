/**
 * Unified API Service - MMC v7.1 (SYNCHRONIZED WITH LOVE-API)
 * ✅ All queue logic moved to Backend (love-api)
 * ✅ PIN system REMOVED
 * ✅ Idempotency Key Support
 * ✅ Versioning Support (X-API-Version: 7.1)
 * ✅ Performance Optimized
 * ✅ Full Supabase Integration
 * 
 * Updated: 2026-04-07
 * Synchronized with: love-api v7.1.0
 */

const API_BASE = '/api/v1';

// Generate a simple idempotency key
const generateIdempotencyKey = () => {
  return `idemp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const api = {
  // Helper for fetch with headers
  async _fetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': '7.1',
      ...options.headers
    };

    // Add idempotency key for POST/PATCH/PUT if not present
    if (['POST', 'PATCH', 'PUT'].includes(options.method) && !headers['Idempotency-Key']) {
      headers['Idempotency-Key'] = generateIdempotencyKey();
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        console.error(`[API Error] ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('[API Fetch Error]', error);
      return { success: false, error: error.message };
    }
  },

  // --- Health & Status ---
  async getHealth() {
    return this._fetch('/health');
  },

  async getStatus() {
    return this._fetch('/status');
  },

  // --- Patients ---
  async patientLogin(personalId, gender) {
    return this._fetch('/patient/login', {
      method: 'POST',
      body: JSON.stringify({ personalId, gender })
    });
  },

  // --- Queue Operations (Unified & Resilient) ---
  async enterQueue(patientId, examType, clinicId = null) {
    return this._fetch('/queue/enter', {
      method: 'POST',
      body: JSON.stringify({ patientId, examType, clinicId })
    });
  },

  async getQueueStatus(patientId = null, clinicId = null) {
    let url = '/queue/status';
    const params = [];
    if (patientId) params.push(`patient_id=${patientId}`);
    if (clinicId) params.push(`clinic_id=${clinicId}`);
    if (params.length > 0) url += '?' + params.join('&');
    
    return this._fetch(url);
  },

  async getClinicWaitingCount(clinicId) {
    const result = await this._fetch(`/queue/status?clinic_id=${clinicId}`);
    return result.success ? (result.data?.waitingCount || 0) : 0;
  },

  // --- Doctor Controls ---
  async callNextPatient(clinicId) {
    return this._fetch('/queue/call', {
      method: 'POST',
      body: JSON.stringify({ clinicId })
    });
  },

  async startExam(queueId) {
    return this._fetch('/queue/start', {
      method: 'POST',
      body: JSON.stringify({ queueId })
    });
  },

  async advanceQueue(queueId, clinicId, expectedVersion = null) {
    return this._fetch('/queue/advance', {
      method: 'POST',
      body: JSON.stringify({ queueId, clinicId, expectedVersion })
    });
  },

  // --- Clinics & System Data ---
  async getClinics() {
    return this._fetch('/clinics');
  },

  async getSettings() {
    return this._fetch('/settings');
  },

  // --- Admin Operations ---
  async adminLogin(username, password) {
    return this._fetch('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  // --- RPC Operations (Protected) ---
  async callRpc(rpcName, payload = {}, token = null) {
    const options = {
      method: 'POST',
      body: JSON.stringify(payload)
    };
    
    if (token) {
      options.headers = { 'Authorization': `Bearer ${token}` };
    }
    
    return this._fetch(`/rpc/${rpcName}`, options);
  },

  // --- Direct Database Access (Admin Only) ---
  async dbQuery(tableName, method = 'GET', data = null, filters = null) {
    const options = { method };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    let url = `/db/${tableName}`;
    if (filters) {
      const params = new URLSearchParams(filters);
      url += '?' + params.toString();
    }
    
    return this._fetch(url, options);
  }
};

export default api;
