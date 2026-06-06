/**
 * Legacy compatibility shim.
 *
 * The application now uses Supabase-backed /api/v1 routes as the single source of truth.
 * This module intentionally avoids localStorage, fake queues, fake pins, or generated clinic data.
 *
 * Keep the class shape so accidental imports do not fabricate local data.
 */
import api from './api.js';

class LocalApiService {
  constructor() {
    this._deprecated = true;
  }

  async patientLogin(patientId, gender) {
    return api.patientLogin(patientId, gender);
  }

  async enterQueue(clinic, user, isAutoEntry = false, name = null, queueType = null, gender = null, militaryId = null, personalId = null) {
    return api.enterQueue(clinic, user, isAutoEntry, name, queueType, gender, militaryId, personalId);
  }

  async getQueueStatus(clinic) {
    return api.getQueueStatus(clinic, true);
  }

  async queueDone(clinic, user) {
    return api.queueDone(clinic, user);
  }

  async callNextPatient(clinic) {
    return api.callNextPatient(clinic);
  }

  async getPinStatus() {
    return api.getPinStatus();
  }

  async choosePath(gender = 'male') {
    const clinics = await api.getClinics();
    return {
      success: Boolean(clinics?.success),
      path: clinics?.data || clinics?.clinics || []
    };
  }

  async getAdminStatus() {
    return api.getQueueStats();
  }

  async getQueues() {
    return api.getQueues();
  }

  // Legacy-only helpers are intentionally inert to avoid local fabrication.
  getItem() { return null; }
  setItem() { return false; }
  getDefaultClinics() { return []; }
  generateDailyPins() { return {}; }
  generateUniqueQueueNumber() { return null; }
}

const localApi = new LocalApiService();
export default localApi;
export { LocalApiService };
