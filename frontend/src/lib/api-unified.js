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

const API_BASE = '/api';
const API_VERSION = 'v1';

/**
 * Normalize API response to prevent structure mismatch
 * @param {Object} res - The raw API response
 * @returns {Object|null} The normalized data or null
 */
function normalizeResponse(res) {
  if (!res) return null;
  // If response has success field, return it as-is
  if (res.hasOwnProperty('success')) return res;
  // Otherwise try to extract data
  return res.data || res.queue || res;
}

// Generate a simple idempotency key
const generateIdempotencyKey = () => {
  return `idemp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const api = {
  // Helper for fetch with headers
  async _fetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': API_VERSION,
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
      
      const data = await response.json();
      return normalizeResponse(data);
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
  
  /**
   * Create queue entry (NEW STANDARD)
   * @param {Object} payload - The queue entry data
   * @returns {Promise<Object>} The created queue entry
   */
  async createQueue(payload) {
    return this._fetch('/queue/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Legacy support (DO NOT REMOVE)
   * @param {Object} patientId - Patient ID
   * @param {string} examType - Type of exam
   * @param {string} clinicId - Optional clinic ID
   * @returns {Promise<Object>} The created queue entry
   */
  async enterQueue(patientId, examType, clinicId = null) {
    // If called with single object (new style)
    if (typeof patientId === 'object' && patientId !== null) {
      return this.createQueue(patientId);
    }
    // Legacy style
    return this._fetch('/queue/enter', {
      method: 'POST',
      body: JSON.stringify({ patientId, examType, clinicId })
    });
  },

  /**
   * Get queue status
   * @param {string|number} id - The queue entry ID or patient ID
   * @param {string} clinicId - Optional clinic ID
   * @returns {Promise<Object>} The queue status data
   */
  async getQueueStatus(id = null, clinicId = null) {
    let url = `/queue/status/${id || ''}`;
    const params = [];
    if (clinicId) params.push(`clinic_id=${clinicId}`);
    if (params.length > 0) url += '?' + params.join('&');
    
    const result = await this._fetch(url);
    
    // Normalizing response for components (ClinicDashboard, AdminQueueMonitor)
    if (result && result.success !== false) {
      const data = result;
      
      // If it's for a clinic, ensure it has the expected structure
      if (clinicId) {
        return {
          ...result,
          // For ClinicDashboard.jsx (expects status.queue)
          queue: Array.isArray(data.queue) ? data.queue : (data.ticket ? [data.ticket] : []),
          // For AdminQueueMonitor.jsx (expects waiting, in, done, stats)
          waiting: data.waiting || [],
          in: data.in || data.in_service || [],
          done: data.done || [],
          stats: data.stats || { 
            totalWaiting: (data.waiting || []).length, 
            totalIn: (data.in || []).length, 
            totalDone: (data.done || []).length,
            totalToday: ((data.waiting || []).length + (data.in || []).length + (data.done || []).length)
          },
          dateKey: data.dateKey || new Date().toISOString().split('T')[0]
        };
      }
    }
    
    return result;
  },

  async getClinicWaitingCount(clinicId) {
    const result = await this.getQueueStatus(null, clinicId);
    if (result && result.success !== false) {
      return {
        success: true,
        data: {
          waitingCount: result.stats?.totalWaiting || (result.waiting || []).length || 0
        }
      };
    }
    return { success: false, data: { waitingCount: 0 } };
  },

  // --- Doctor Controls ---
  async callNextPatient(clinicId, pin = null) {
    return this._fetch('/queue/call', {
      method: 'POST',
      body: JSON.stringify({ clinicId, pin })
    })
  },

  async queueDone(clinicId, patientId, pin = null) {
    return this._fetch('/queue/done', {
      method: 'POST',
      body: JSON.stringify({ clinicId, patientId, pin })
    })
  },

  async updateQueueStatus(clinicId, patientId, status) {
    return this._fetch('/queue/status', {
      method: 'PATCH',
      body: JSON.stringify({ clinicId, patientId, status })
    })
  },

  async startExam(queueId) {
    return this._fetch('/queue/start', {
      method: 'POST',
      body: JSON.stringify({ queueId })
    });
  },

  /**
   * Advance queue
   * @param {string|number} queueId - The queue entry ID
   * @param {string} clinicId - The clinic ID
   * @param {string} expectedVersion - Optional version for concurrency
   * @returns {Promise<Object>} The result of the advance operation
   */
  async advanceQueue(queueId, clinicId, expectedVersion = null) {
    // Support for both new and old signature
    const id = typeof queueId === 'object' ? queueId.id : queueId;
    return this._fetch(`/queue/advance/${id}`, {
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

  // --- Session Validation ---
  async validateSession(token) {
    return this._fetch('/session/validate', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
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

// Export individual functions for compatibility with new code
export const createQueue = api.createQueue.bind(api);
export const enterQueue = api.enterQueue.bind(api);
export const getQueueStatus = api.getQueueStatus.bind(api);
export const advanceQueue = api.advanceQueue.bind(api);

export default api;
