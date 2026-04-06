/**
 * Unified API Service - MMC v7.0 (FINAL)
 * ✅ All queue logic moved to Backend (love-api)
 * ✅ PIN system REMOVED
 * ✅ Doctor-Only Control
 * ✅ Idempotency Key Support
 * ✅ Versioning & Concurrency Control
 */

const API_BASE = '/api/v1';

// Helper to generate a unique idempotency key
const getIdempotencyKey = () => {
  return `idemp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const api = {
  // --- Patients ---
  async patientLogin(personalId, gender) {
    const res = await fetch(`${API_BASE}/patient/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': getIdempotencyKey()
      },
      body: JSON.stringify({ personalId, gender })
    });
    return await res.json();
  },

  // --- Queue ---
  async enterQueue(patientId, examType, clinicId = null) {
    const res = await fetch(`${API_BASE}/queue/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': getIdempotencyKey()
      },
      body: JSON.stringify({ patientId, examType, clinicId })
    });
    return await res.json();
  },

  async getQueueStatus(patientId) {
    const res = await fetch(`${API_BASE}/queue/status?patientId=${patientId}`);
    return await res.json();
  },

  async getClinicWaitingCount(clinicId) {
    const res = await fetch(`${API_BASE}/queue/status?clinicId=${clinicId}`);
    const json = await res.json();
    return json.success ? json.data.waitingCount : 0;
  },

  // --- Doctor Controls ---
  async callNextPatient(clinicId) {
    const res = await fetch(`${API_BASE}/queue/call`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': getIdempotencyKey()
      },
      body: JSON.stringify({ clinicId })
    });
    return await res.json();
  },

  async startExam(queueId) {
    const res = await fetch(`${API_BASE}/queue/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': getIdempotencyKey()
      },
      body: JSON.stringify({ queueId })
    });
    return await res.json();
  },

  async advanceQueue(queueId, clinicId, expectedVersion = null) {
    const res = await fetch(`${API_BASE}/queue/advance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': getIdempotencyKey()
      },
      body: JSON.stringify({ queueId, clinicId, expectedVersion })
    });
    return await res.json();
  },

  // --- Clinics ---
  async getClinics() {
    const res = await fetch(`${API_BASE}/clinics`);
    return await res.json();
  },

  // --- Settings ---
  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    return await res.json();
  },

  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  }
};

export default api;
