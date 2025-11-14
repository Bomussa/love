/**
 * Unified API client for both Vercel backend and Supabase.
 * Abstracts away the complexities of different API endpoints.
 */
import vercelApi from './vercel-api-client';
import supabaseApi from './supabase-direct-client';

const api = {
  // ==================== Session & Patient Login ====================

  startSession: async () => {
    return await vercelApi.post('/session/start');
  },

  patientLogin: async (sessionId, personalId, gender) => {
    return await vercelApi.post('/patient/login', { sessionId, personalId, gender });
  },

  getPatient: async (sessionId) => {
    return await vercelApi.get(`/patient/${sessionId}`);
  },

  // ==================== Pathway & Clinic Info ====================

  createPathway: async (personalId, examType, gender) => {
    return await vercelApi.post('/pathway/create', { personalId, examType, gender });
  },

  getClinics: async () => {
    return await supabaseApi.from('clinics').select('*');
  },

  // ==================== Queue Management ====================

  enterQueue: async (sessionId, clinicId, pin) => {
    return await vercelApi.post('/queue/enter', { sessionId, clinicId, pin });
  },

  getQueueStatus: async (clinicId) => {
    return await vercelApi.get(`/queue/status?clinicId=${clinicId}`);
  },

  queueDone: async (sessionId, clinicId) => {
    return await vercelApi.post('/queue/done', { sessionId, clinicId });
  },

  callNextInQueue: async (clinicId) => {
      return await vercelApi.post('/queue/call', { clinicId });
  },

  // ==================== PIN Management ====================

  generatePin: async (clinicId) => {
    return await vercelApi.post('/pin/generate', { clinicId });
  },

  verifyPin: async (pin, clinicId) => {
    return await vercelApi.post('/pin/verify', { pin, clinicId });
  },

  getActivePins: async () => {
    return await vercelApi.get('/pin/status');
  },

  // ==================== Admin & Dashboard ====================

  adminLogin: async (username, password) => {
    return await vercelApi.post('/admin/login', { username, password });
  },

  getDashboardStats: async () => {
    return await vercelApi.get('/stats/dashboard');
  },

  getAllQueueStats: async () => {
    return await vercelApi.get('/stats/queues');
  },
};

export default api;
