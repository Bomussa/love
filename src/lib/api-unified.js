/**
 * Unified API Client - v4.1
 * Keeps current behavior, restores compatibility, and avoids throwing on API errors.
 */

export const API_VERSION = 'v1';
const BASE = import.meta.env.VITE_API_URL || '/api/v1';

function buildHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-API-Version': API_VERSION,
    ...extraHeaders,
  };
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function successResult(payload) {
  if (Array.isArray(payload)) {
    return { success: true, data: payload };
  }

  if (payload && typeof payload === 'object') {
    if (Object.prototype.hasOwnProperty.call(payload, 'success')) {
      return payload;
    }
    return { success: true, ...payload };
  }

  return { success: true, data: payload };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: buildHeaders(options.headers || {}),
    body: options.body,
  });

  const payload = await readJsonSafely(res);

  if (!res.ok) {
    return {
      success: false,
      status: res.status,
      error: payload?.error || payload?.message || `API ERROR: ${res.status}`,
      data: payload?.data ?? null,
    };
  }

  return successResult(payload);
}

function buildQueueBody(data = {}) {
  return {
    clinicId: data.clinicId || data.clinic_id,
    patientId: data.patientId || data.patient_id,
    patientName: data.patientName || data.patient_name,
    examType: data.examType || data.exam_type,
    gender: data.gender,
  };
}

export const api = {
  getQueueStatus: (clinicId) =>
    request(`/queue/status?clinicId=${encodeURIComponent(clinicId)}`),

  getStats: (clinicId) =>
    request(`/queue/status?clinicId=${encodeURIComponent(clinicId)}`),

  createQueue: (data) =>
    request('/queue/create', {
      method: 'POST',
      body: JSON.stringify(buildQueueBody(data)),
    }),

  enterQueue: (data) =>
    request('/queue/enter', {
      method: 'POST',
      body: JSON.stringify(buildQueueBody(data)),
    }),

  callNextPatient: (clinicId) =>
    request('/queue/call', {
      method: 'POST',
      body: JSON.stringify({ clinicId }),
    }),

  startExam: (queueId) =>
    request('/queue/start', {
      method: 'POST',
      body: JSON.stringify({ queueId }),
    }),

  advanceQueue: (queueId, clinicId) =>
    request('/queue/advance', {
      method: 'POST',
      body: JSON.stringify({ queueId, clinicId }),
    }),

  queueDone: (queueId) =>
    request('/queue/done', {
      method: 'POST',
      body: JSON.stringify({ queueId, id: queueId }),
    }),

  adminLogin: (username, password) =>
    request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  patientLogin: (personalId, gender) =>
    request('/patient/login', {
      method: 'POST',
      body: JSON.stringify({ personalId, gender }),
    }),

  getClinics: async () => {
    const result = await request('/clinics');
    if (Array.isArray(result?.data)) {
      return { success: true, clinics: result.data, data: result.data };
    }
    if (Array.isArray(result)) {
      return { success: true, clinics: result, data: result };
    }
    if (result && typeof result === 'object' && Array.isArray(result.data)) {
      return { success: true, clinics: result.data, data: result.data };
    }
    return result;
  },
};

export default api;
