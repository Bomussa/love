/**
 * Unified API Client - v3.2
 * Bridges frontend requests to the love-api backend.
 * Fixed: Unified all endpoints under /api/v1/queue/*
 */

const BASE = "/api/v1";

async function request(path, options = {}) {
  // Ensure we use the full URL for the backend if needed, 
  // but Vercel rewrites handle this in production.
  const res = await fetch(`${BASE}${path}`, {
    headers: { 
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API ERROR: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Queue Status & Stats
  getQueueStatus: (clinicId) =>
    request(`/queue/status?clinicId=${clinicId}`),

  getStats: (clinicId) =>
    request(`/queue/status?clinicId=${clinicId}`),

  // Queue Operations
  enterQueue: (data) =>
    request("/queue/enter", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  callNextPatient: (clinicId) =>
    request("/queue/call", {
      method: "POST",
      body: JSON.stringify({ clinicId }),
    }),

  startExam: (queueId) =>
    request("/queue/start", {
      method: "POST",
      body: JSON.stringify({ queueId }),
    }),

  advanceQueue: (queueId, clinicId) =>
    request("/queue/advance", {
      method: "POST",
      body: JSON.stringify({ queueId, clinicId }),
    }),

  queueDone: (id) =>
    request("/queue/done", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
    
  // Admin & Auth
  adminLogin: (username, password) =>
    request("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
};

export default api;
