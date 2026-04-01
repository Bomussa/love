/**
 * MMC Frontend API Service v5.0.0
 * - All data from Supabase via backend API (single source of truth)
 * - PIN system REMOVED - no PIN anywhere
 * - Doctor-controlled queue flow
 * - /queue/create is the canonical entry (was the bug causing missing medical path screen)
 */

const API_VERSION = "/api/v1";

function resolveApiBases() {
  const bases = [];
  try {
    const envBase = import.meta.env?.VITE_API_BASE?.trim();
    if (envBase) bases.push(envBase);
  } catch {}
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") bases.push("http://localhost:3000");
    bases.push(window.location.origin);
  }
  return [...new Set(bases)];
}

class ApiService {
  constructor() {
    this._bases = null;
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this._syncOffline());
      if (navigator.onLine) setTimeout(() => this._syncOffline(), 1000);
    }
  }

  get bases() {
    if (!this._bases) this._bases = resolveApiBases();
    return this._bases;
  }

  async request(endpoint, options = {}) {
    const config = {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    };
    let lastError = null;
    for (const base of this.bases) {
      try {
        const response = await fetch(`${base}${endpoint}`, config);
        const text = await response.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        if (!response.ok) { lastError = new Error(data?.error || `HTTP ${response.status}`); continue; }
        return data;
      } catch (err) { lastError = err; continue; }
    }
    const method = (options.method || "GET").toUpperCase();
    if (["POST","PUT","DELETE"].includes(method)) {
      this._queueOffline(endpoint, options);
      return { success: true, offline: true, queued: true };
    }
    throw lastError || new Error("Server unreachable");
  }

  _queueOffline(ep, opts) {
    try {
      const q = JSON.parse(localStorage.getItem("mms.offlineQueue") || "[]");
      q.push({ id: Date.now(), endpoint: ep, options: opts, timestamp: new Date().toISOString() });
      localStorage.setItem("mms.offlineQueue", JSON.stringify(q));
    } catch {}
  }

  async _syncOffline() {
    try {
      const q = JSON.parse(localStorage.getItem("mms.offlineQueue") || "[]");
      if (!q.length) return;
      const remaining = [];
      for (const op of q) {
        try { await this.request(op.endpoint, op.options); }
        catch { remaining.push(op); }
      }
      localStorage.setItem("mms.offlineQueue", JSON.stringify(remaining));
    } catch {}
  }

  // ── Patient ──
  async patientLogin(patientId, gender) {
    return this.request(`${API_VERSION}/patient/login`, {
      method: "POST", body: JSON.stringify({ personalId: patientId, gender }),
    });
  }

  // ── Queue — canonical create (FIXED: this endpoint was missing → caused missing medical path screen) ──
  async createQueue(sessionId, examType, gender, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    return this.request(`${API_VERSION}/queue/create`, {
      method: "POST", headers,
      body: JSON.stringify({ sessionId, examType, gender, patientId: sessionId }),
    });
  }

  async getQueueStatus(queueIdOrClinicId, isClinic = false) {
    const param = isClinic ? `clinicId=${queueIdOrClinicId}` : `queueId=${queueIdOrClinicId}`;
    return this.request(`${API_VERSION}/queue/status?${param}`);
  }

  async getQueuePosition(clinicId, userId) {
    return this.request(`${API_VERSION}/queue/position?clinic=${clinicId}&user=${userId}`);
  }

  async getQueueCount(clinicId) {
    try {
      const r = await this.request(`${API_VERSION}/queue/status?clinicId=${clinicId}`);
      return r?.data?.waitingCount || 0;
    } catch { return 0; }
  }

  async callNextPatient(clinicId, doctorId = null) {
    return this.request(`${API_VERSION}/queue/call`, {
      method: "POST", body: JSON.stringify({ clinicId, doctorId }),
    });
  }

  async startExamination(queueId, doctorId = null) {
    return this.request(`${API_VERSION}/queue/start`, {
      method: "POST", body: JSON.stringify({ queueId, doctorId }),
    });
  }

  async advancePatient(queueId, doctorClinicId = null, version = null) {
    return this.request(`${API_VERSION}/queue/advance`, {
      method: "POST", body: JSON.stringify({ queueId, doctorClinicId, version }),
    });
  }

  // ── Routes ──
  async createRoute(patientId, examType, gender, stations) {
    return this.request(`${API_VERSION}/route/create`, {
      method: "POST", body: JSON.stringify({ patientId, examType, gender, stations }),
    });
  }

  async getRoute(patientId) {
    return this.request(`${API_VERSION}/route/get?patientId=${patientId}`);
  }

  // ── Clinics — LIVE from Supabase via API (not hardcoded) ──
  async getClinics() {
    return this.request(`${API_VERSION}/clinics`);
  }

  // ── Stats ──
  async getQueues()     { return this.request(`${API_VERSION}/stats/queues`); }
  async getQueueStats() { return this.request(`${API_VERSION}/stats/dashboard`); }

  // ── Admin ──
  async adminLogin(username, password) {
    return this.request(`${API_VERSION}/admin/login`, {
      method: "POST", body: JSON.stringify({ username, password }),
    });
  }

  async recoverQueues() {
    return this.request(`${API_VERSION}/admin/queue/recover`, { method: "POST" });
  }

  // ── Settings (live from backend, not hardcoded) ──
  async getSettings() { return this.request(`${API_VERSION}/settings`); }

  // ── Health ──
  async getHealthStatus() { return this.request(`${API_VERSION}/health`); }

  // ── Legacy shims (no PIN, backward compat) ──
  async enterQueue(clinicId, userId, isAutoEntry = false, name = null, queueType = null) {
    return this.request(`${API_VERSION}/queue/enter`, {
      method: "POST", body: JSON.stringify({ clinic: clinicId, user: userId, isAutoEntry, name, queueType }),
    });
  }

  async queueDone(clinicId, userId) {
    return this.request(`${API_VERSION}/queue/done`, {
      method: "POST", body: JSON.stringify({ clinicId, patientId: userId }),
    });
  }

  // PIN system removed — shims return safe no-op
  async generatePIN()   { return { success: false, message: "PIN system removed" }; }
  async getPinStatus()  { return { success: true,  message: "PIN system removed", doctorControl: true }; }
  async getActivePins() { return { success: true,  pins: [] }; }
  async clinicExit()    { return { success: true,  message: "Controlled by doctor" }; }
  async completeClinic(clinicId, user) { return this.queueDone(clinicId, user); }

  connectSSE(clinic, callback) { return { close: () => {} }; }
}

const api = new ApiService();
export default api;
export { api };
