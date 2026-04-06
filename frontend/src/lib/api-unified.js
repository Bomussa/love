/**
 * Unified API Service - MMC v7.0 (FINAL)
 * ✅ All queue logic moved to Backend (love-api)
 * ✅ PIN system REMOVED
 * ✅ Idempotency Key Support
 * ✅ Versioning Support (X-API-Version: 7.0)
 * ✅ Performance Optimized
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
      'X-API-Version': '7.0',
      ...options.headers
    };

    // Add idempotency key for POST/PATCH/PUT if not present
    if (['POST', 'PATCH', 'PUT'].includes(options.method) && !headers['Idempotency-Key']) {
      headers['Idempotency-Key'] = generateIdempotencyKey();
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    return await response.json();
  },

  // --- Patients ---
  async patientLogin(personalId, gender) {
    return this._fetch('/patient/login', {
      method: 'POST',
      body: JSON.stringify({ personalId, gender })
    });
  },

  // --- Queue ---
  async enterQueue(patientId, examType, clinicId = null) {
    return this._fetch('/queue/create', {
      method: 'POST',
      body: JSON.stringify({ patientId, examType, clinicId })
    });
  },

  async getQueueStatus(patientId) {
    const url = patientId ? `/queue/status?patientId=${patientId}` : '/queue/status';
    return this._fetch(url);
  },

  async getClinicWaitingCount(clinicId) {
    const json = await this._fetch(`/queue/status?clinicId=${clinicId}`);
    return json.success ? json.data.waitingCount : 0;
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

  // --- Clinics ---
  async getClinics() {
    return this._fetch('/clinics');
  },

  // --- Settings ---
  async getSettings() {
    return this._fetch('/settings');
  },

  async getHealth() {
    return this._fetch('/health');
  }
};

export default api;
