import { assertNoSupabaseInClient } from '../guards/noSupabaseInClient';
export const API_CONTRACTS = {
  clinics: { path: '/api/v1/clinics', method: 'GET' },
  queues: { path: '/api/v1/queues', method: 'GET' },
  settings: { path: '/api/v1/settings', method: 'GET' },
  patientLogin: { path: '/api/v1/patient/login', method: 'POST' },
  pinVerify: { path: '/api/v1/pin/verify', method: 'POST' },
  queueEnter: { path: '/api/v1/queue/enter', method: 'POST' },
  queueStatus: { path: '/api/v1/queue/status', method: 'GET' },
  pinStatus: { path: '/api/v1/pin/status', method: 'GET' },
  pinGenerate: { path: '/api/v1/pin/generate', method: 'POST' }
};
const BASE = import.meta.env.VITE_API_BASE_URL || '';
async function request(key, options = {}) {
  assertNoSupabaseInClient();
  const contract = API_CONTRACTS[key];
  if (!contract) throw new Error(`Unknown API contract: ${key}`);
  const url = new URL(`${BASE}${contract.path}`, window.location.origin);
  if (options.params) Object.keys(options.params).forEach(p => url.searchParams.append(p, options.params[p]));
  const res = await fetch(url.toString(), {
    method: contract.method,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || json.error || 'API Request Failed');
  return json.data;
}
export const apiClient = {
  get: (key, params) => request(key, { params }),
  post: (key, body) => request(key, { body })
};
