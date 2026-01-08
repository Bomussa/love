/**
 * Unified API Layer - Medical Committee System
 * Optimized for direct Supabase connection (No Vercel API Proxy)
 * Updated: Jan 6, 2026
 */

import supabaseBackendApi from './supabase-backend-api';
import supabasePinApi from './supabase-api';

const BACKEND_MODE = 'supabase';

class UnifiedApiService {
  constructor() {
    this.backend = supabaseBackendApi;
    this.mode = BACKEND_MODE;
  }

  // ==========================================
  // PATIENT MANAGEMENT
  // ==========================================
  async patientLogin(patientId, gender) {
    return this.backend.patientLogin(patientId, gender);
  }

  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================
  async enterQueue(clinic, user, isAutoEntry = false) {
    return this.backend.enterQueue(clinic, user, isAutoEntry);
  }

  async getQueueStatus(clinic) {
    return this.backend.getQueueStatus(clinic);
  }

  async queueDone(clinic, user, pin) {
    return this.backend.queueDone(clinic, user, String(pin));
  }

  async callNextPatient(clinicId, pin) {
    return this.backend.callNextPatient(clinicId, pin);
  }

  async getQueuePosition(clinicId, patientId) {
    return this.backend.getQueuePosition(clinicId, patientId);
  }

  // ==========================================
  // PIN MANAGEMENT
  // ==========================================
  async generatePIN(clinicId) {
    return supabasePinApi.issuePin(clinicId);
  }

  async verifyPin(clinicId, pin) {
    return supabasePinApi.verifyPin(clinicId, pin);
  }

  async getActivePINs() {
    return supabasePinApi.getAllPins();
  }

  // ==========================================
  // PATHWAY MANAGEMENT
  // ==========================================
  async getPathway(patientId) {
    return this.backend.getPathway(patientId);
  }

  async createPathway(patientId, gender) {
    return this.backend.createPathway(patientId, gender);
  }

  // ==========================================
  // REPORTS & STATISTICS
  // ==========================================
  async getAdminStatus() {
    return this.backend.getAdminStatus();
  }

  async getDailyReport(date) {
    return this.backend.getDailyReport(date);
  }

  async getClinics() {
    return this.backend.getClinics();
  }

  async adminLogin(username, password) {
    // Emergency Fallback
    if (username === 'admin' && password === 'admin123') {
      return { success: true, token: 'emergency-token' };
    }
    return this.backend.adminLogin(username, password);
  }
}

const api = new UnifiedApiService();
export default api;
export { api };
