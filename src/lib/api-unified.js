/**
 * api-unified.js — MMC Frontend API v8.0 PRODUCTION
 * Single source of truth: ALL data from Backend API only
 * ✅ PIN system PERMANENTLY REMOVED
 * ✅ NO direct Supabase access - all through backend API
 * ✅ Doctor-controlled advance flow
 * ✅ Idempotency key support
 * ✅ Version control for concurrency
 */

const API_BASE = import.meta.env?.VITE_API_BASE?.trim() || '';

// ── HTTP helper (falls back through configured bases) ──────────────────────────
async function apiRequest(endpoint, options = {}) {
  const bases = [API_BASE, window.location.origin].filter(Boolean);
  const headers = { 
    'Content-Type': 'application/json',
    'X-API-Version': 'v1',
    ...options.headers 
  };
  let lastError = null;

  for (const base of bases) {
    try {
      const r = await fetch(`${base}${endpoint}`, { ...options, headers });
      const text = await r.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!r.ok) { 
        lastError = new Error(data?.error || data?.message || `HTTP ${r.status}`); 
        continue; 
      }
      return data;
    } catch (e) { lastError = e; }
  }

  // Offline fallback for writes
  if (['POST', 'PUT', 'DELETE'].includes((options.method || 'GET').toUpperCase())) {
    _queueOffline(endpoint, options);
    return { success: true, offline: true, queued: true };
  }
  throw lastError || new Error('Server unreachable');
}

function _queueOffline(endpoint, options) {
  try {
    const q = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]');
    q.push({ id: Date.now(), endpoint, options, ts: new Date().toISOString() });
    localStorage.setItem('mms.offlineQueue', JSON.stringify(q));
  } catch {}
}

async function syncOfflineQueue() {
  try {
    const q = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]');
    if (!q.length) return;
    const rem = [];
    for (const op of q) {
      try { await apiRequest(op.endpoint, op.options); }
      catch { rem.push(op); }
    }
    localStorage.setItem('mms.offlineQueue', JSON.stringify(rem));
  } catch {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineQueue);
  if (navigator.onLine) setTimeout(syncOfflineQueue, 1000);
}

// ════════════════════════════════════════════════════════════════════════════════
// PATIENT
// ════════════════════════════════════════════════════════════════════════════════

async function patientLogin(patientId, gender) {
  return apiRequest('/api/v1/patient/login', { 
    method: 'POST', 
    body: JSON.stringify({ personalId: patientId, gender }) 
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// QUEUE — canonical flow
// ════════════════════════════════════════════════════════════════════════════════

async function createQueue(sessionId, examType, gender, idempotencyKey = null) {
  const headers = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return apiRequest('/api/v1/queue/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, examType, gender, patientId: sessionId }),
  });
}

async function enterQueue(clinicId, userId, isAutoEntry = false, name = null, queueType = null) {
  // Legacy shim — routes to /queue/enter
  return apiRequest('/api/v1/queue/enter', {
    method: 'POST',
    body: JSON.stringify({ clinic: clinicId, user: userId, isAutoEntry, name, queueType }),
  });
}

async function getQueueStatus(clinicOrQueueId, isClinic = false) {
  const param = isClinic ? `clinicId=${clinicOrQueueId}` : `queueId=${clinicOrQueueId}`;
  return apiRequest(`/api/v1/queue/status?${param}`);
}

async function getQueuePosition(clinicId, userId) {
  return apiRequest(`/api/v1/queue/position?clinic=${clinicId}&user=${userId}`);
}

async function getQueueCount(clinicId) {
  try {
    const result = await getQueueStatus(clinicId, true);
    return result?.waitingCount || 0;
  } catch { return 0; }
}

async function callNextPatient(clinicId, doctorId = null) {
  return apiRequest('/api/v1/queue/call', { 
    method: 'POST', 
    body: JSON.stringify({ clinicId, doctorId }) 
  });
}

async function startExamination(queueId, doctorId = null) {
  return apiRequest('/api/v1/queue/start', { 
    method: 'POST', 
    body: JSON.stringify({ queueId, doctorId }) 
  });
}

async function advancePatient(queueId, doctorClinicId = null, version = null) {
  return apiRequest('/api/v1/queue/advance', { 
    method: 'POST', 
    body: JSON.stringify({ queueId, doctorClinicId, version }) 
  });
}

async function queueDone(clinicId, userId) {
  return apiRequest('/api/v1/queue/done', { 
    method: 'POST', 
    body: JSON.stringify({ clinicId, patientId: userId }) 
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// CLINICS — from Backend API (single source of truth)
// ════════════════════════════════════════════════════════════════════════════════

async function getClinics() {
  return apiRequest('/api/v1/clinics');
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════════

async function createRoute(patientId, examType, gender, stations) {
  return apiRequest('/api/v1/route/create', { 
    method: 'POST', 
    body: JSON.stringify({ patientId, examType, gender, stations }) 
  });
}

async function getRoute(patientId) {
  return apiRequest(`/api/v1/route/get?patientId=${patientId}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// STATS — from Backend API
// ════════════════════════════════════════════════════════════════════════════════

async function getQueues() {
  return apiRequest('/api/v1/stats/queues');
}

async function getQueueStats() { 
  return apiRequest('/api/v1/stats/dashboard'); 
}

// ════════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════════

async function adminLogin(username, password) {
  return apiRequest('/api/v1/admin/login', { 
    method: 'POST', 
    body: JSON.stringify({ username, password }) 
  });
}

async function recoverQueues() {
  return apiRequest('/api/v1/admin/queue/recover', { method: 'POST' });
}

// ════════════════════════════════════════════════════════════════════════════════
// SETTINGS — from Backend API
// ════════════════════════════════════════════════════════════════════════════════

async function getSettings() {
  return apiRequest('/api/v1/settings');
}

// ════════════════════════════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════════════════════════════

async function getHealthStatus() { 
  return apiRequest('/api/v1/health'); 
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

const api = {
  patientLogin,
  createQueue, 
  enterQueue,
  getQueueStatus, 
  getQueuePosition, 
  getQueueCount,
  callNextPatient, 
  startExamination, 
  advancePatient, 
  queueDone,
  getClinics, 
  getClinicOccupancy: getQueues,
  createRoute, 
  getRoute,
  getQueues, 
  getQueueStats, 
  getActiveQueue: getQueues,
  getDashboardStats: getQueueStats,
  adminLogin, 
  recoverQueues,
  getSettings, 
  getHealthStatus,
};

export default api;
