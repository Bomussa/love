const BASE = "/api/v1";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API ERROR: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // مراجع الانتظار
  getClinicWaitingCount: (clinicId) =>
    request(`/queue/status?clinicId=${clinicId}`),

  getQueueStatus: (clinicId) =>
    request(`/queue/status?clinicId=${clinicId}`),

  // عمليات الطابور
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
    
  // إحصائيات
  getStats: (clinicId) =>
    request(`/queue/stats?clinicId=${clinicId}`),
};

export default api;
