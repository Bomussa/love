/**
 * Unified API Service - MMC v6.0 (LOCKED)
 * ✅ All queue logic moved to Backend (love-api)
 * ✅ PIN system REMOVED
 * ✅ Doctor-Only Control
 * ✅ Performance Optimized
 */

const API_BASE = '/api/v1';

const api = {
  // --- Patients ---
  async patientLogin(personalId, gender) {
    const res = await fetch(`${API_BASE}/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalId, gender })
    });
    return await res.json();
  },

  // --- Queue ---
  async enterQueue(patientId, examType, clinicId = null) {
    const res = await fetch(`${API_BASE}/queue/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId })
    });
    return await res.json();
  },

  async startExam(queueId) {
    const res = await fetch(`${API_BASE}/queue/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId })
    });
    return await res.json();
  },

  async advanceQueue(queueId, clinicId) {
    const res = await fetch(`${API_BASE}/queue/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId, clinicId })
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
