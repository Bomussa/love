const BASE = "/api/v1";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API ERROR: ${res.status}`);
  }

  return res.json();
}

export const api = {
  enterQueue: (data) =>
    request("/queue/enter", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getQueueStatus: (clinicId) =>
    request(`/queue/status?clinicId=${clinicId}`),

  callNextPatient: (clinicId) =>
    request("/queue/call", {
      method: "POST",
      body: JSON.stringify({ clinicId }),
    }),

  queueDone: (id) =>
    request("/queue/done", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
};

export default api;
