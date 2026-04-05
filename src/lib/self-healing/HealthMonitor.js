let state = { modules: {}, updatedAt: null };
const listeners = new Set();

export function getHealthState() { return state; }
export function getOverallStatus() { return 'ok'; }
export function subscribeToHealthChanges(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function startHealthMonitoring() {
  state = { ...state, updatedAt: new Date().toISOString() };
  listeners.forEach((l) => l(state));
}
export function stopHealthMonitoring() { return true; }
export function forceHealthCheck() { startHealthMonitoring(); return state; }
