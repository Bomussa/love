import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';

/**
 * Unified API Service
 * Canonical contract:
 * - Prefer documented production base for mmc-mms
 * - Allow env override for local/staging
 * - Preserve only thin resilience fallbacks for tests / network failures
 * - Never read from unified_queue directly
 */

initGDS().catch((err) => console.error('❌ فشل تهيئة GDS:', err));

export const API_VERSION = '/api/v1';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function qatarDateTime() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
}

function qatarDate() {
  return qatarDateTime().slice(0, 10);
}

function resolveApiBases() {
  const bases = [];

  try {
    const envBase = import.meta.env?.VITE_API_BASE?.trim() || import.meta.env?.VITE_API_URL?.trim();
    if (envBase) bases.push(envBase.replace(/\/$/, ''));
  } catch {
    // ignore env access errors during tests
  }

  // Documented production base is the canonical fallback.
  bases.push('https://love-bomussa.vercel.app/api');

  // Local same-origin fallback for previews and dev servers.
  bases.push('');

  if (typeof window !== 'undefined' && window.location?.origin) {
    bases.push(window.location.origin.replace(/\/$/, ''));
  }

  return [...new Set(bases)];
}

function timeoutFor(method) {
  return method === 'GET' ? 8000 : 12000;
}

function parseMaybeJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeApiResponse(raw, fallbackData = null) {
  if (!raw || raw.success === false || raw.ok === false) return raw;

  const data = raw?.data !== undefined ? raw.data : (fallbackData !== null ? fallbackData : raw);
  const response = isObject(raw) ? { ...raw } : {};

  response.success = true;
  response.data = data;

  if (isObject(data)) {
    Object.assign(response, data);
  }

  return response;
}

function failure(message, extra = {}) {
  return { success: false, error: message, ...extra };
}

async function requestJson(path, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
  const bases = resolveApiBases();
  const payload = body === undefined ? undefined : JSON.stringify(body);
  let lastError = null;

  for (const base of bases) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || timeoutFor(method)) : null;

    try {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': 'v1',
          ...headers,
        },
        body: payload,
        signal: controller?.signal,
      });

      if (timer) clearTimeout(timer);

      const raw = parseMaybeJson(await response.text());
      if (!response.ok) {
        return failure(raw?.error || raw?.message || `HTTP ${response.status}`, {
          status: response.status,
          data: raw,
        });
      }

      return normalizeApiResponse(raw);
    } catch (error) {
      lastError = error;
      if (timer) clearTimeout(timer);
    }
  }

  return failure(lastError?.message || 'Server unreachable');
}

async function get(path) {
  return requestJson(path, { method: 'GET' });
}

async function post(path, body, headers = {}) {
  return requestJson(path, { method: 'POST', body, headers });
}

function normalizePatientData(raw, patientId, gender) {
  const data = raw?.data || raw?.patient || raw?.session || raw || {};
  const personalId = data.personalId || data.personal_id || patientId;
  const sessionId = data.sessionId || data.session_id || raw?.sessionId || raw?.session_id || null;

  return {
    ...data,
    personalId,
    personal_id: personalId,
    patient_id: data.patient_id || data.id || patientId,
    sessionId,
    session_id: sessionId,
    gender: data.gender || gender || 'male',
  };
}

function normalizeLoginData(raw, fallbackUsername, fallbackRole = 'ADMIN') {
  const data = raw?.data || raw || {};
  const user = data.user || {};
  const username = user.username || user.name || data.username || data.name || fallbackUsername;
  const role = user.role || data.role || fallbackRole;
  const token = data.token || null;

  return {
    username,
    name: user.name || username,
    role,
    token,
    user: Object.keys(user).length ? user : { username, role },
    ...data,
  };
}

function normalizeQueueData(raw) {
  return normalizeApiResponse(raw);
}

async function directQueueStatusUpdate(clinicId, patientId, status) {
  const normalized = String(status || '').toLowerCase();
  const update = { status: normalized };
  const now = qatarDateTime();

  if (normalized === 'completed') {
    update.completed_at = now;
  } else if (normalized === 'called') {
    update.called_at = now;
  } else if (normalized === 'waiting') {
    update.called_at = null;
    update.completed_at = null;
  } else if (normalized === 'cancelled' || normalized === 'no_show') {
    update.cancelled_at = now;
  }

  const { data, error } = await supabase
    .from('queues')
    .update(update)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .select('*');

  if (error) return failure(error.message);
  return normalizeApiResponse({ success: true, data: data || [] }, data || []);
}

const api = {
  async patientLogin(patientId, gender) {
    const raw = await post(`${API_VERSION}/patient/login`, {
      patientId,
      personalId: patientId,
      gender: gender || 'male',
    });

    if (raw?.success === false) return raw;
    return normalizeApiResponse({ ...raw, data: normalizePatientData(raw, patientId, gender) }, normalizePatientData(raw, patientId, gender));
  },

  getQatarDate() {
    return qatarDate();
  },

  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null, gender = null, militaryId = null, personalId = null) {
    const raw = await post(`${API_VERSION}/queue/enter`, {
      clinicId,
      clinic_id: clinicId,
      clinic: clinicId,
      sessionId: patientId,
      user: patientId,
      patientId,
      personalId: personalId || patientId,
      patient_name: patientName || null,
      name: patientName || null,
      examType: examType || null,
      queueType: examType || null,
      gender: gender || 'male',
      militaryId: militaryId || null,
      isAutoEnter,
      isAutoEntry: isAutoEnter,
    });

    if (raw?.success === false) return raw;
    return normalizeQueueData(raw);
  },

  async getQueuePosition(clinicId, patientId) {
    const raw = await get(`${API_VERSION}/queue/position?clinic=${encodeURIComponent(clinicId)}&user=${encodeURIComponent(patientId)}`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async queueDone(clinicId, patientId) {
    const raw = await post(`${API_VERSION}/queue/done`, { clinicId, patientId });
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async getSettings() {
    const raw = await get(`${API_VERSION}/settings`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async getQueueCount(clinicId) {
    const status = await this.getQueueStatus(clinicId);
    if (status?.success === false) return 0;
    const data = status.data || status;
    if (typeof data?.waitingCount === 'number') return data.waitingCount;
    if (Array.isArray(data?.queue)) return data.queue.filter((q) => String(q.status).toLowerCase() === 'waiting').length;
    return 0;
  },

  async getRoute(patientId) {
    const raw = await get(`${API_VERSION}/route/get?patientId=${encodeURIComponent(patientId)}`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async createRoute(patientId, examType, gender, stations) {
    const raw = await post(`${API_VERSION}/route/create`, { patientId, examType, gender, stations });
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async getClinics() {
    const raw = await get(`${API_VERSION}/clinics`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async verifyPin(clinicId) {
    const result = await this.getClinics();
    if (result?.success === false) return result;
    const list = result.data || result.clinics || [];
    const clinic = Array.isArray(list) ? list.find((item) => String(item.id) === String(clinicId)) : null;
    if (!clinic) return failure('Clinic not found');

    return {
      success: true,
      isValid: true,
      session: {
        clinicId: clinic.id,
        clinicName: clinic.name_ar || clinic.name_en || clinic.name || clinicId,
      },
    };
  },

  async getQueueStatus(clinicId) {
    const raw = await get(`${API_VERSION}/queue/status?clinicId=${encodeURIComponent(clinicId)}`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async callNextPatient(clinicId, doctorId = null) {
    const raw = await post(`${API_VERSION}/queue/call`, { clinicId, clinic_id: clinicId, doctorId });
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async startExamination(queueId, doctorId = null) {
    const raw = await post(`${API_VERSION}/queue/start`, { queueId, doctorId });
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async advancePatient(queueId, doctorClinicId = null, version = null) {
    const raw = await post(`${API_VERSION}/queue/advance`, { queueId, doctorClinicId, version });
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async createQueue(firstArg, examType = null, gender = null, idempotencyKey = null) {
    if (isObject(firstArg)) {
      const raw = await post(`${API_VERSION}/queue/create`, firstArg);
      return raw?.success === false ? raw : normalizeQueueData(raw);
    }

    const sessionId = String(firstArg || '').trim();
    if (!sessionId) return failure('sessionId is required');

    const raw = await post(`${API_VERSION}/queue/create`, {
      sessionId,
      patientId: sessionId,
      examType,
      gender: gender || 'male',
      idempotencyKey,
    });

    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async advanceQueue(payload) {
    const body = isObject(payload) ? payload : { queueId: payload };
    const raw = await post(`${API_VERSION}/queue/advance`, body);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async updateQueueStatus(clinicId, patientId, status) {
    if (String(status || '').toLowerCase() === 'completed') {
      return this.queueDone(clinicId, patientId);
    }
    return directQueueStatusUpdate(clinicId, patientId, status);
  },

  async getQueues() {
    const raw = await get(`${API_VERSION}/stats/queues`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async getQueueStats() {
    const raw = await get(`${API_VERSION}/stats/dashboard`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async adminLogin(username, password) {
    const raw = await post(`${API_VERSION}/admin/login`, { username, password });
    if (raw?.success === false) return raw;
    const data = normalizeLoginData(raw, username, 'ADMIN');
    return normalizeApiResponse({ ...raw, data, user: data.user, token: data.token }, data);
  },

  async doctorLogin(username, password) {
    const raw = await post(`${API_VERSION}/doctor/login`, { username, password });
    if (raw?.success === false) return raw;
    const admin = normalizeLoginData(raw, username, 'DOCTOR');
    const data = {
      ...admin,
      id: admin.id || admin.username || username,
      username: admin.username || username,
      name: admin.name || admin.username || username,
      clinic_id: admin.clinic_id || null,
      clinic_name: admin.clinic_name || null,
      role: 'DOCTOR',
    };

    return normalizeApiResponse({ ...raw, data, user: data, role: 'DOCTOR' }, data);
  },

  async recoverQueues() {
    const raw = await post(`${API_VERSION}/admin/queue/recover`, {});
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async getHealthStatus() {
    const raw = await get(`${API_VERSION}/health`);
    return raw?.success === false ? raw : normalizeQueueData(raw);
  },

  async enterQueueLegacy(clinicId, userId, isAutoEntry = false, name = null, queueType = null) {
    return this.enterQueue(clinicId, userId, isAutoEntry, name, queueType);
  },

  async queueDoneLegacy(clinicId, userId) {
    return this.queueDone(clinicId, userId);
  },

  connectSSE() {
    return { close: () => {} };
  },
};

export default api;
export { api };
