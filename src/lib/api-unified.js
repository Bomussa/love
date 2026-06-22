/**
 * Unified API Client - v5.0
 * REAL-TIME DATA ONLY: Removes all fake/simulated data logic.
 * Connects directly to Supabase via love-api.
 */

export const API_VERSION = 'v1';
const BASE = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

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

  return payload;
}

export const api = {
  patientLogin: (personalId, gender, examType) =>
    request('/patient/login', {
      method: 'POST',
      body: JSON.stringify({ personalId, gender, examType }),
    }),

  getQueueStatus: (clinicId, patientId) => {
    let url = `/queue/status?`;
    if (clinicId) url += `clinicId=${encodeURIComponent(clinicId)}&`;
    if (patientId) url += `patientId=${encodeURIComponent(patientId)}`;
    return request(url);
  },

  enterQueue: (data) =>
    request('/queue/enter', {
      method: 'POST',
      body: JSON.stringify({
        clinicId: data.clinicId,
        patientId: data.patientId,
        examType: data.examType,
        gender: data.gender,
      }),
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
      body: JSON.stringify({ queueId }),
    }),

  getClinics: () => request('/clinics'),

  adminLogin: (username, password) =>
    request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};

export default api;
