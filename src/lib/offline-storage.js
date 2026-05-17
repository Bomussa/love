/**
 * Legacy offline storage shim.
 *
 * Medical queue state must come from Supabase and realtime subscriptions only.
 * This module intentionally avoids persisting queue, patient, clinic or route state locally.
 */

class OfflineStorage {
  constructor() {
    this.disabled = true;
  }

  isAvailable() {
    return false;
  }

  save() {
    return false;
  }

  load(defaultValue = null) {
    return defaultValue;
  }

  remove() {
    return true;
  }

  clear() {
    return true;
  }

  get() {
    return null;
  }

  set() {
    return false;
  }

  saveQueueData() {
    return false;
  }

  getQueueData() {
    return null;
  }

  savePatientData() {
    return false;
  }

  getPatientData() {
    return null;
  }

  saveClinicState() {
    return false;
  }

  getClinicState() {
    return null;
  }

  saveNotifications() {
    return false;
  }

  getNotifications() {
    return [];
  }

  getDefaultClinics() {
    return [];
  }
}

const offlineStorage = new OfflineStorage();
export default offlineStorage;
export { OfflineStorage };
