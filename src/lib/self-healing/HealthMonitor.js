import { STATUS } from './constants';

let health = { status: STATUS.OK, checkedAt: null };
const listeners = new Set();
let timer = null;

export const getHealthState = () => health;
export const getOverallStatus = () => health.status;

export function subscribeToHealthChanges(cb) {
  listeners.add(cb);
  cb(health);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => cb(health));
}

export function forceHealthCheck() {
  health = { status: STATUS.OK, checkedAt: new Date().toISOString() };
  notify();
  return health;
}

export function startHealthMonitoring() {
  if (timer) return;
  forceHealthCheck();
  timer = setInterval(forceHealthCheck, 30000);
}

export function stopHealthMonitoring() {
  clearInterval(timer);
  timer = null;
}
