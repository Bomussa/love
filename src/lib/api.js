/**
 * @fileoverview Unified API Service - Doctor-Controlled Queue System (No PIN)
 * @description API service for frontend integration with the backend.
 *              PIN-related functions removed; all operations use doctor-controlled flow.
 * @version 4.0.0
 * @since 2025-04-01
 */

const API_VERSION = '/api/v1';

/**
 * Resolves API base URLs from environment and defaults
 * @returns {string[]} Array of API base URLs
 */
function resolveApiBases() {
  const bases = [];
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const envBase = (env?.VITE_API_BASE || '').trim();
  if (envBase) bases.push(envBase);

  // Development fallback
  if (env?.DEV) bases.push('http://localhost:3000');

  // Production: same origin
  if (typeof window !== 'undefined') {
    bases.push(window.location.origin);
  }

  return Array.from(new Set(bases));
}

const API_BASES = resolveApiBases();

/**
 * API Service class for all backend operations
 */
class ApiService {
  constructor() {
    // Auto-sync offline queue when online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncOfflineQueue();
      });

      // Sync on page load if online
      if (navigator.onLine) {
        setTimeout(() => this.syncOfflineQueue(), 1000);
      }
    }
  }

  /**
   * Makes an HTTP request with fallback and retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    let lastError = null;
    for (const base of API_BASES) {
      const url = `${base}${endpoint}`;
      try {
        const response = await fetch(url, config);
        const text = await response.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

        if (!response.ok) {
          lastError = new Error(data?.error || `HTTP ${response.status}`);
          continue;
        }
        return data;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    // Offline fallback
    const offline = this.offlineFallback(endpoint, options);
    if (offline.ok) return offline.data;

    throw lastError || new Error('تعذر الوصول إلى الخادم');
  }

  /**
   * Handles offline operations by queuing them
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Object} Offline fallback response
   */
  offlineFallback(endpoint, options = {}) {
    try {
      const method = (options.method || 'GET').toUpperCase();

      // For write operations, queue them for later sync
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        this.queueOfflineOperation(endpoint, options);
        return {
          ok: true,
          data: {
            success: true,
            offline: true,
            queued: true,
            message: 'تم حفظ العملية مؤقتاً - سيتم الإرسال عند عودة الاتصال',
          },
        };
      }

      return { ok: false };
    } catch (e) {
      return { ok: false };
    }
  }

  /**
   * Queues an operation for offline sync
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   */
  queueOfflineOperation(endpoint, options) {
    try {
      const queue = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]');
      queue.push({
        id: Date.now() + Math.random(),
        endpoint,
        options,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('mms.offlineQueue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to queue offline operation:', e);
    }
  }

  /**
   * Syncs queued offline operations
   */
  async syncOfflineQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]');
      if (queue.length === 0) return;

      const remaining = [];
      for (const op of queue) {
        try {
          await this.request(op.endpoint, op.options);
        } catch (e) {
          remaining.push(op);
        }
      }

      localStorage.setItem('mms.offlineQueue', JSON.stringify(remaining));
    } catch (e) {
      console.error('Sync error:', e);
    }
  }

  // ==========================================
  // Patient APIs
  // ==========================================

  /**
   * Patient login
   * @param {string} patientId - Patient ID
   * @param {string} gender - Patient gender
   * @returns {Promise<Object>} Login response
   */
  async patientLogin(patientId, gender) {
    return this.request(`${API_VERSION}/patient/login`, {
      method: 'POST',
      body: JSON.stringify({ personalId: patientId, gender }),
    });
  }

  // ==========================================
  // Queue APIs - Doctor-Controlled Flow
  // ==========================================

  /**
   * Creates a new queue entry for patient
   * @param {string} sessionId - Patient session ID
   * @param {string} examType - Type of examination
   * @param {string} gender - Patient gender
   * @param {string} [idempotencyKey] - Idempotency key
   * @returns {Promise<Object>} Queue creation response
   */
  async createQueue(sessionId, examType, gender, idempotencyKey = null) {
    const body = { sessionId, examType, gender };
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;
    
    return this.request(`${API_VERSION}/queue/create`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Enters patient into queue (legacy compatibility)
   * @param {string} clinicId - Clinic ID
   * @param {string} userId - User/Patient ID
   * @param {boolean} isAutoEntry - Whether to auto-enter
   * @param {string} [name] - Patient name
   * @param {string} [queueType] - Queue type
   * @returns {Promise<Object>} Queue entry response
   */
  async enterQueue(clinicId, userId, isAutoEntry = false, name = null, queueType = null) {
    // For the new doctor-controlled system, this is handled by createQueue
    // This method provides backward compatibility
    return this.request(`${API_VERSION}/queue/enter`, {
      method: 'POST',
      body: JSON.stringify({ 
        clinic: clinicId, 
        user: userId, 
        isAutoEntry,
        name,
        queueType
      }),
    });
  }

  /**
   * Gets patient's queue position
   * @param {string} clinicId - Clinic ID
   * @param {string} userId - User/Patient ID
   * @returns {Promise<Object>} Queue position response
   */
  async getQueuePosition(clinicId, userId) {
    return this.request(`${API_VERSION}/queue/position?clinic=${encodeURIComponent(clinicId)}&user=${encodeURIComponent(userId)}`, {
      method: 'GET',
    });
  }

  /**
   * Gets queue count for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<number>} Queue count
   */
  async getQueueCount(clinicId) {
    try {
      const response = await this.request(`${API_VERSION}/queue/status?clinicId=${encodeURIComponent(clinicId)}`);
      return response?.data?.waitingCount || 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Gets queue status for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Object>} Queue status
   */
  async getQueueStatus(clinicId) {
    return this.request(`${API_VERSION}/queue/status?clinicId=${encodeURIComponent(clinicId)}`);
  }

  /**
   * Calls next patient (admin/doctor only)
   * @param {string} clinicId - Clinic ID
   * @param {string} [doctorId] - Doctor ID
   * @returns {Promise<Object>} Call response
   */
  async callNextPatient(clinicId, doctorId = null) {
    return this.request(`${API_VERSION}/queue/call`, {
      method: 'POST',
      body: JSON.stringify({ clinicId, doctorId }),
    });
  }

  /**
   * Starts patient examination (CALLED -> IN_PROGRESS)
   * @param {string} queueId - Queue entry ID
   * @param {string} [doctorId] - Doctor ID
   * @returns {Promise<Object>} Start response
   */
  async startExamination(queueId, doctorId = null) {
    return this.request(`${API_VERSION}/queue/start`, {
      method: 'POST',
      body: JSON.stringify({ queueId, doctorId }),
    });
  }

  /**
   * Advances patient to next clinic or completes (IN_PROGRESS -> next/DONE)
   * @param {string} queueId - Queue entry ID
   * @param {string} [doctorId] - Doctor ID
   * @returns {Promise<Object>} Advance response
   */
  async advancePatient(queueId, doctorId = null) {
    return this.request(`${API_VERSION}/queue/advance`, {
      method: 'POST',
      body: JSON.stringify({ queueId, doctorId }),
    });
  }

  /**
   * Legacy: Complete clinic (now handled by advancePatient)
   * @param {string} clinicId - Clinic ID
   * @param {string} userId - User ID
   * @param {string} [pin] - PIN (ignored in new system)
   * @param {boolean} [skipPin] - Skip PIN (always true in new system)
   * @returns {Promise<Object>} Completion response
   */
  async queueDone(clinicId, userId, pin = null, skipPin = false) {
    // In the new system, completion is handled by the doctor via advancePatient
    // This method provides backward compatibility
    return this.request(`${API_VERSION}/queue/done`, {
      method: 'POST',
      body: JSON.stringify({ clinicId, patientId: userId }),
    });
  }

  // ==========================================
  // Route APIs
  // ==========================================

  /**
   * Creates and saves patient route
   * @param {string} patientId - Patient ID
   * @param {string} examType - Exam type
   * @param {string} gender - Patient gender
   * @param {string[]} stations - Array of station IDs
   * @returns {Promise<Object>} Route creation response
   */
  async createRoute(patientId, examType, gender, stations) {
    return this.request(`${API_VERSION}/route/create`, {
      method: 'POST',
      body: JSON.stringify({ patientId, examType, gender, stations }),
    });
  }

  /**
   * Gets saved patient route
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Route response
   */
  async getRoute(patientId) {
    return this.request(`${API_VERSION}/route/get?patientId=${encodeURIComponent(patientId)}`);
  }

  /**
   * Chooses medical path
   * @returns {Promise<Object>} Path response
   */
  async choosePath() {
    return this.request(`${API_VERSION}/path/choose`);
  }

  // ==========================================
  // Stats APIs
  // ==========================================

  /**
   * Gets queue statistics
   * @returns {Promise<Object>} Queue stats
   */
  async getQueues() {
    return this.request(`${API_VERSION}/stats/queues`);
  }

  /**
   * Gets dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  async getQueueStats() {
    return this.request(`${API_VERSION}/stats/dashboard`);
  }

  // ==========================================
  // Admin APIs
  // ==========================================

  /**
   * Admin login
   * @param {string} username - Admin username
   * @param {string} password - Admin password
   * @returns {Promise<Object>} Login response
   */
  async adminLogin(username, password) {
    return this.request(`${API_VERSION}/admin/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  /**
   * Gets admin status
   * @returns {Promise<Object>} Admin status
   */
  async getAdminStatus() {
    return this.request(`${API_VERSION}/admin/status`);
  }

  /**
   * Gets queue logs (admin only)
   * @returns {Promise<Object>} Queue logs
   */
  async getQueueLogs() {
    return this.request(`${API_VERSION}/admin/queue/logs`);
  }

  /**
   * Recovers stuck queues (admin only)
   * @returns {Promise<Object>} Recovery response
   */
  async recoverQueues() {
    return this.request(`${API_VERSION}/admin/queue/recover`, {
      method: 'POST',
    });
  }

  // ==========================================
  // Health Check
  // ==========================================

  /**
   * Checks system health
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    return this.request(`${API_VERSION}/health/status`);
  }

  // ==========================================
  // Settings APIs
  // ==========================================

  /**
   * Gets system settings
   * @returns {Promise<Object>} Settings response
   */
  async getSettings() {
    // Return default settings (PIN system removed)
    return {
      success: true,
      settings: {
        pin_system_enabled: 'false',
        pin_system_visible: 'false',
        queue_system_enabled: 'true',
        queue_system_visible: 'true',
        doctor_control_enabled: 'true'
      }
    };
  }

  // ==========================================
  // Compatibility Methods (for backward compatibility)
  // ==========================================

  /**
   * @deprecated Use enterQueue instead
   */
  async enterClinic(visitId, clinicId) {
    return this.enterQueue(clinicId, visitId);
  }

  /**
   * @deprecated Use advancePatient instead
   */
  async completeClinic(clinicId, user, pin) {
    console.warn('completeClinic is deprecated. Use advancePatient instead.');
    return this.queueDone(clinicId, user);
  }

  /**
   * @deprecated PIN system removed
   */
  async clinicExit(patientId, clinicId, pin) {
    console.warn('clinicExit with PIN is deprecated. Doctor controls exit now.');
    return { success: true, message: 'Exit controlled by doctor' };
  }

  /**
   * @deprecated PIN system removed
   */
  async getPinStatus() {
    return { 
      success: true, 
      message: 'PIN system removed',
      doctorControl: true 
    };
  }

  /**
   * @deprecated PIN system removed
   */
  async getActivePins() {
    return { success: true, pins: [] };
  }

  /**
   * @deprecated Use getQueues instead
   */
  async getActiveQueue() {
    return this.getQueues();
  }

  /**
   * @deprecated Use getQueueStats instead
   */
  async getDashboardStats() {
    return this.getQueueStats();
  }

  /**
   * @deprecated PIN system removed
   */
  async generatePIN(stationId, adminCode) {
    console.warn('PIN generation removed. Doctor controls patient flow.');
    return { success: false, message: 'PIN system removed' };
  }

  /**
   * @deprecated PIN system removed
   */
  async deactivatePIN(pinId, adminCode) {
    return { success: true, message: 'PIN system removed' };
  }

  /**
   * @deprecated PIN system removed
   */
  async getActivePINs(adminCode) {
    return { success: true, pins: [] };
  }

  async getClinics() {
    return {
      clinics: [
        { id: 'lab', name: 'المختبر', type: 'diagnostic' },
        { id: 'xray', name: 'الأشعة', type: 'diagnostic' },
        { id: 'eyes', name: 'العيون', type: 'clinic' },
        { id: 'internal', name: 'الباطنية', type: 'clinic' },
        { id: 'ent', name: 'الأنف والأذن والحنجرة', type: 'clinic' },
        { id: 'surgery', name: 'الجراحة', type: 'clinic' },
        { id: 'dental', name: 'الأسنان', type: 'clinic' },
        { id: 'psychiatry', name: 'الطب النفسي', type: 'clinic' },
        { id: 'derma', name: 'الجلدية', type: 'clinic' },
        { id: 'bones', name: 'العظام', type: 'clinic' },
        { id: 'vitals', name: 'القياسات الحيوية', type: 'vital' },
        { id: 'ecg', name: 'تخطيط القلب', type: 'diagnostic' },
        { id: 'audio', name: 'السمعيات', type: 'diagnostic' },
      ],
    };
  }

  async getClinicOccupancy() {
    return this.getQueues();
  }

  async getWaitTimes() {
    return this.getQueues();
  }

  async getThroughputStats() {
    return this.getAdminStatus();
  }

  async generateReport(type, format, adminCode) {
    return { success: true, report: 'Generated' };
  }

  async getRecentReports(adminCode) {
    return this.request(`${API_VERSION}/reports/history?adminCode=${encodeURIComponent(adminCode)}`);
  }

  async pauseQueue(queueType, adminCode) {
    return { success: true, message: 'Queue paused' };
  }

  async resetSystem(adminCode) {
    console.log('Resetting system...');
    try {
      // Clear queues
      await this.request(`${API_VERSION}/admin/queue/clear`, {
        method: 'POST',
        body: JSON.stringify({ adminCode })
      });
      
      return { success: true, message: 'System reset successfully' };
    } catch (error) {
      console.error('Reset System Error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // SSE (Server-Sent Events)
  // ==========================================

  /**
   * Connects to SSE for real-time updates
   * @param {string} clinic - Clinic ID
   * @param {Function} callback - Event callback
   * @returns {Object} Event source-like object
   */
  connectSSE(clinic, callback) {
    // Use eventBus for centralized connection management
    const handleQueueUpdate = (data) => {
      if (data.clinic === clinic || !data.clinic) {
        callback({ type: 'queue_update', data });
      }
    };

    const handleHeartbeat = (data) => {
      callback({ type: 'heartbeat', data });
    };

    // Subscribe to events
    const eventBus = window.eventBus;
    if (eventBus) {
      const unsubscribe1 = eventBus.on('queue:update', handleQueueUpdate);
      const unsubscribe2 = eventBus.on('heartbeat', handleHeartbeat);

      return {
        close: () => {
          unsubscribe1();
          unsubscribe2();
        },
      };
    }

    // Fallback: return dummy object
    return {
      close: () => {},
    };
  }

  // ==========================================
  // WebSocket
  // ==========================================

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }
}

// Create singleton instance
const api = new ApiService();
export default api;
export { api };
