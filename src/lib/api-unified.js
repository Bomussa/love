/**
 * api-unified.js — MMC Frontend API v5.0 FINAL
 * Single source of truth: ALL data from Supabase directly
 * ✅ No PIN system anywhere
 * ✅ createQueue() calls /queue/create (the fixed endpoint)
 * ✅ Doctor-controlled advance flow
 * ✅ Live Supabase queries for clinics, queues, stats
 * ✅ Offline fallback with sync queue
 */

import { supabase } from './supabase-client';

const API_BASE = import.meta.env?.VITE_API_BASE?.trim() || '';

// ── HTTP helper (falls back through configured bases) ──────────────────────────
async function apiRequest(endpoint, options = {}) {
  const bases = [API_BASE, window.location.origin].filter(Boolean);
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  let lastError = null;

  for (const base of bases) {
    try {
      const r = await fetch(`${base}${endpoint}`, { ...options, headers });
      const text = await r.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!r.ok) { lastError = new Error(data?.error || `HTTP ${r.status}`); continue; }
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
  try {
    // Upsert patient in Supabase directly
    const { data, error } = await supabase
      .from('patients')
      .upsert({ patient_id: patientId, gender: gender || 'male', last_active: new Date().toISOString() }, { onConflict: 'patient_id' })
      .select().single();

    if (error) throw error;
    return { success: true, data: { ...data, id: patientId, sessionId: patientId, personalId: patientId, gender: data.gender } };
  } catch (err) {
    console.warn('[patientLogin] Supabase failed, using API fallback:', err.message);
    return apiRequest('/api/v1/patient/login', { method: 'POST', body: JSON.stringify({ personalId: patientId, gender }) });
  }
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
  // Legacy shim — routes to /queue/enter which backend redirects to create logic
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
  // Try Supabase directly first for real-time accuracy
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: waiting } = await supabase
      .from('queues').select('id,display_number,patient_id')
      .eq('clinic_id', clinicId).eq('queue_date', today).eq('status', 'WAITING')
      .order('display_number');

    const { data: userQ } = await supabase
      .from('queues').select('id,display_number,entered_at')
      .eq('patient_id', userId).eq('queue_date', today)
      .not('status', 'in', '("DONE","CANCELLED")').limit(1).maybeSingle();

    const pos = userQ && waiting ? waiting.findIndex(w => w.id === userQ.id) : -1;
    return {
      success: true,
      display_number: userQ?.display_number || null,
      current_number: waiting?.[0]?.display_number ? waiting[0].display_number - 1 : 0,
      ahead: pos >= 0 ? pos : 0,
      total_waiting: waiting?.length || 0,
      entered_at: userQ?.entered_at || null,
    };
  } catch {
    return apiRequest(`/api/v1/queue/position?clinic=${clinicId}&user=${userId}`);
  }
}

async function getQueueCount(clinicId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId).eq('queue_date', today).eq('status', 'WAITING');
    return count || 0;
  } catch { return 0; }
}

async function callNextPatient(clinicId, doctorId = null) {
  return apiRequest('/api/v1/queue/call', { method: 'POST', body: JSON.stringify({ clinicId, doctorId }) });
}

async function startExamination(queueId, doctorId = null) {
  return apiRequest('/api/v1/queue/start', { method: 'POST', body: JSON.stringify({ queueId, doctorId }) });
}

async function advancePatient(queueId, doctorClinicId = null, version = null) {
  return apiRequest('/api/v1/queue/advance', { method: 'POST', body: JSON.stringify({ queueId, doctorClinicId, version }) });
}

async function queueDone(clinicId, userId) {
  return apiRequest('/api/v1/queue/done', { method: 'POST', body: JSON.stringify({ clinicId, patientId: userId }) });
}

// ════════════════════════════════════════════════════════════════════════════════
// CLINICS — from Supabase (single source of truth)
// ════════════════════════════════════════════════════════════════════════════════

async function getClinics() {
  try {
    const { data, error } = await supabase.from('clinics').select('*').eq('is_active', true).order('name_ar');
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch {
    return apiRequest('/api/v1/clinics');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════════

async function createRoute(patientId, examType, gender, stations) {
  return apiRequest('/api/v1/route/create', { method: 'POST', body: JSON.stringify({ patientId, examType, gender, stations }) });
}

async function getRoute(patientId) {
  return apiRequest(`/api/v1/route/get?patientId=${patientId}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// STATS — from Supabase directly
// ════════════════════════════════════════════════════════════════════════════════

async function getQueues() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('queues').select('status,clinic_id,display_number,patient_id').eq('queue_date', today);
    const all = data || [];
    return { success: true, data: { total: all.length, waiting: all.filter(q => q.status === 'WAITING').length, in_progress: all.filter(q => q.status === 'IN_PROGRESS').length, done: all.filter(q => q.status === 'DONE').length } };
  } catch {
    return apiRequest('/api/v1/stats/queues');
  }
}

async function getQueueStats() { return getQueues(); }

// ════════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════════

async function adminLogin(username, password) {
  return apiRequest('/api/v1/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

async function recoverQueues() {
  return apiRequest('/api/v1/admin/queue/recover', { method: 'POST' });
}

// ════════════════════════════════════════════════════════════════════════════════
// SETTINGS — live from Supabase
// ════════════════════════════════════════════════════════════════════════════════

async function getSettings() {
  try {
    const { data } = await supabase.from('system_settings').select('*');
    const settings = {};
    (data || []).forEach(s => { settings[s.key || s.id] = s.value; });
    return { success: true, data: { pin_system_enabled: false, pin_system_visible: false, queue_system_enabled: true, doctor_control_enabled: true, ...settings } };
  } catch {
    return { success: true, data: { pin_system_enabled: false, queue_system_enabled: true, doctor_control_enabled: true } };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════════════════════════════

async function getHealthStatus() { return apiRequest('/api/v1/health'); }

// ════════════════════════════════════════════════════════════════════════════════
// PIN SYSTEM SHIMS — all return safe no-ops (PIN removed)
// ════════════════════════════════════════════════════════════════════════════════

const generatePIN  = async () => ({ success: false, message: 'PIN system removed' });
const getPinStatus = async () => ({ success: true,  message: 'PIN system removed', doctorControl: true });
const getActivePins= async () => ({ success: true,  pins: [] });
const clinicExit   = async () => ({ success: true,  message: 'Controlled by doctor' });
const completeClinic = async (clinicId, userId) => queueDone(clinicId, userId);

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

const api = {
  patientLogin,
  createQueue, enterQueue,
  getQueueStatus, getQueuePosition, getQueueCount,
  callNextPatient, startExamination, advancePatient, queueDone,
  getClinics, getClinicOccupancy: getQueues,
  createRoute, getRoute,
  getQueues, getQueueStats, getActiveQueue: getQueues,
  getDashboardStats: getQueueStats,
  adminLogin, recoverQueues,
  getSettings, getHealthStatus,
  // Legacy shims
  generatePIN, getPinStatus, getActivePins, clinicExit, completeClinic,
  getActivePINs: getActivePins, deactivatePIN: async () => ({ success: true }),
};

export default api;
