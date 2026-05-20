import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';

/**
 * Unified API Service
 * Canonical contract:
 * - Use /api/v1 endpoints defined by love-api
 * - Preserve minimal fallbacks for resilience and tests
 * - Never read unified_queue directly
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
  const bases = new Set();

  try {
    const envBase = import.meta.env?.VITE_API_BASE?.trim();
    if (envBase) bases.add(envBase.replace(/\/$/, ''));
  } catch {
    // ignore env access errors in tests
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    bases.add(window.location.origin.replace(/\/$/, ''));
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      bases.add('http://localhost:3000');
      bases.add('http://127.0.0.1:3000');
      bases.add('http://localhost:5173');
      bases.add('http://127.0.0.1:5173');
    }
  }

  return [...bases];
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

function wrapSuccess(raw, fallbackData = null) {
  if (!raw || raw.success === false || raw.ok === false) {
    return raw;
  }

  const source = raw && raw.data !== undefined ? raw.data : (fallbackData !== null ? fallbackData : raw);
  const data = isObject(source) ? source : { value: source };
  return {
    ...(isObject(raw) ? raw : {}),
    success: true,
    data,
    ...data,
  };
}

function failure(message, extra = {}) {
  return {
    success: false,
    error: message,
    ...extra,
  };
}

async function requestJson(path, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
  const bases = resolveApiBases();
  let lastError = null;
  const payload = body === undefined ? undefined : JSON.stringify(body);

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

      const text = await response.text();
      const raw = parseMaybeJson(text);

      if (!response.ok) {
        return failure(raw?.error || raw?.message || `HTTP ${response.status}`, {
          status: response.status,
          data: raw,
        });
      }

      if (!isObject(raw)) {
        return { success: true, data: raw };
      }

      if (raw.success === false || raw.ok === false) {
        return raw;
      }

      return raw;
    } catch (error) {
      lastError = error;
      if (timer) clearTimeout(timer);
    }
  }

  return failure(lastError?.message || 'Server unreachable');
}

async function post(path, body, headers = {}) {
  return requestJson(path, { method: 'POST', body, headers });
}

async function get(path) {
  return requestJson(path, { method: 'GET' });
}

function normalizeLoginData(raw, fallbackUsername, fallbackRole = 'ADMIN') {
  const user = raw?.user || raw?.data?.user || {};
  const username = user.username || user.name || raw?.data?.username || raw?.data?.name || fallbackUsername;
  const role = user.role || raw?.data?.role || fallbackRole;
  const token = raw?.token || raw?.data?.token || null;

  return {
    username,
    name: user.name || username,
    role,
    token,
    user: user && Object.keys(user).length ? user : { username, role },
  };
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

function normalizeQueuePayload(raw) {
  const data = raw?.data ?? raw ?? {};
  return wrapSuccess(raw, data);
}

async function directUpdateQueue(clinicId, patientId, status) {
  const normalizedStatus = String(status || '').toLowerCase();
  const update = { status: normalizedStatus };
  const now = qatarDateTime();

  if (normalizedStatus === 'completed') {
    update.completed_at = now;
  } else if (normalizedStatus === 'called') {
    update.called_at = now;
  } else if (normalizedStatus === 'waiting') {
    update.called_at = null;
    update.completed_at = null;
  } else if (normalizedStatus === 'no_show' || normalizedStatus === 'cancelled') {
    update.cancelled_at = now;
  }

  const { data, error } = await supabase
    .from('queues')
    .update(update)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .select('*');

  if (error) {
    return failure(error.message);
  }

  return wrapSuccess({ success: true, data: (data || []) }, data || []);
}

const api = {
  async patientLogin(patientId, gender) {
    const raw = await post(`${API_VERSION}/patient/login`, {
      patientId,
      personalId: patientId,
      gender: gender || 'male',
    });

    if (raw?.success === false) return raw;
    const data = normalizePatientData(raw, patientId, gender);
    return wrapSuccess({ ...raw, data }, data);
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
    return normalizeQueuePayload(raw);
  },

  async getQueuePosition(clinicId, patientId) {
    const raw = await get(`${API_VERSION}/queue/position?clinic=${encodeURIComponent(clinicId)}&user=${encodeURIComponent(patientId)}`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async queueDone(clinicId, patientId) {
    const raw = await post(`${API_VERSION}/queue/done`, { clinicId, patientId });
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async getSettings() {
    const raw = await get(`${API_VERSION}/settings`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async getQueueCount(clinicId) {
    const status = await this.getQueueStatus(clinicId);
    if (status?.success === false) return 0;
    return status.waitingCount ?? status?.data?.waitingCount ?? (Array.isArray(status?.queue) ? status.queue.filter((q) => String(q.status).toLowerCase() === 'waiting').length : 0);
  },

  async getRoute(patientId) {
    const raw = await get(`${API_VERSION}/route/get?patientId=${encodeURIComponent(patientId)}`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async createRoute(patientId, examType, gender, stations) {
    const raw = await post(`${API_VERSION}/route/create`, { patientId, examType, gender, stations });
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async getClinics() {
    const raw = await get(`${API_VERSION}/clinics`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async verifyPin(clinicId) {
    const clinics = await this.getClinics();
    if (clinics?.success === false) return clinics;
    const list = clinics.clinics || clinics.data || [];
    const clinic = Array.isArray(list) ? list.find((item) => String(item.id) === String(clinicId)) : null;
    if (!clinic) {
      return failure('Clinic not found');
    }
    return {
      success: true,
      isValid: true,
      session: {
        clinicId: clinic.id,
        clinicName: clinic.name_ar || clinic.name_en || clinic.name || clinicId,
      },
      clinic,
    };
  },

  async getQueueStatus(clinicId) {
    const raw = await get(`${API_VERSION}/queue/status?clinicId=${encodeURIComponent(clinicId)}`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async callNextPatient(clinicId, doctorId = null) {
    const raw = await post(`${API_VERSION}/queue/call`, { clinicId, clinic_id: clinicId, doctorId });
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async startExamination(queueId, doctorId = null) {
    const raw = await post(`${API_VERSION}/queue/start`, { queueId, doctorId });
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async advancePatient(queueId, doctorClinicId = null, version = null) {
    const raw = await post(`${API_VERSION}/queue/advance`, { queueId, doctorClinicId, version });
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async createQueue(firstArg, examType = null, gender = null, idempotencyKey = null) {
    if (isObject(firstArg)) {
      const raw = await post(`${API_VERSION}/queue/create`, firstArg);
      if (raw?.success === false) return raw;
      return normalizeQueuePayload(raw);
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

    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async updateQueueStatus(clinicId, patientId, status) {
    if (String(status || '').toLowerCase() === 'completed') {
      return this.queueDone(clinicId, patientId);
    }
    return directUpdateQueue(clinicId, patientId, status);
  },

  async getQueues() {
    const raw = await get(`${API_VERSION}/stats/queues`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async getQueueStats() {
    const raw = await get(`${API_VERSION}/stats/dashboard`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async adminLogin(username, password) {
    const raw = await post(`${API_VERSION}/admin/login`, { username, password });
    if (raw?.success === false) return raw;
    const data = normalizeLoginData(raw, username, 'ADMIN');
    return {
      ...wrapSuccess({ ...raw, data }, data),
      user: data.user,
      token: data.token,
    };
  },

  async doctorLogin(username, password) {
    const result = await this.adminLogin(username, password);
    if (result?.success === false) return result;

    const data = {
      ...(result.data || {}),
      username: result.data?.username || username,
      name: result.data?.name || username,
      role: 'DOCTOR',
    };

    return {
      ...wrapSuccess({ ...result, data }, data),
      user: data,
      token: result.token || result.data?.token || null,
    };
  },

  async recoverQueues() {
    const raw = await post(`${API_VERSION}/admin/queue/recover`, {});
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
  },

  async getHealthStatus() {
    const raw = await get(`${API_VERSION}/health`);
    if (raw?.success === false) return raw;
    return normalizeQueuePayload(raw);
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
