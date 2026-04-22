/** Queue Settings */
export const DEFAULT_QUEUE_SETTINGS = {
  queueIntervalSeconds: 120,
  patientMaxWaitSeconds: 240,
  examMaxSeconds: 300,
  refreshIntervalSeconds: 30,
  nearTurnRefreshSeconds: 7,
  autoCallEnabled: true,
  timeoutHandlerEnabled: true,
  examTimeoutEnabled: true,
  notificationsEnabled: true,
  showCountdownTimer: true,
  showQueuePosition: true,
  showEstimatedWait: true,
  showAheadCount: true,
  notifyNearAhead: 3,
  graceMinutes: 4,
  noticeTtlSeconds: 30,
};

const STORAGE_KEY = 'mmc_queue_settings';
const ACTIVE_WAITING_STATES = new Set(['waiting', 'queued', 'ready', 'pending']);
const ACTIVE_EXAM_STATES = new Set(['called', 'in', 'in_progress', 'serving']);
const TERMINAL_STATES = new Set(['done', 'completed', 'cancelled', 'absent', 'no_show']);

const normalizeStatus = (status) => String(status || '').toLowerCase();
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function getQueueSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_QUEUE_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.error(e);
  }
  return { ...DEFAULT_QUEUE_SETTINGS };
}

export function saveQueueSettings(settings) {
  const merged = { ...DEFAULT_QUEUE_SETTINGS, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('queueSettingsUpdated', { detail: merged }));
  return true;
}

export function updateQueueSetting(key, value) {
  const current = getQueueSettings();
  current[key] = value;
  return saveQueueSettings(current);
}

export function resetQueueSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_QUEUE_SETTINGS));
  window.dispatchEvent(new CustomEvent('queueSettingsUpdated', { detail: DEFAULT_QUEUE_SETTINGS }));
  return { ...DEFAULT_QUEUE_SETTINGS };
}

export const secondsToMinutes = (s) => Math.round(s / 60);
export const minutesToSeconds = (m) => m * 60;

export function getEstimatedWaitTime(position) {
  const settings = getQueueSettings();
  const safePosition = Math.max(0, Number(position) || 0);
  return Math.ceil(safePosition * (settings.queueIntervalSeconds / 60));
}

export function isNearTurn(position) {
  return Number(position) <= getQueueSettings().notifyNearAhead;
}

export function getRemainingTime(calledAt, status, queuePosition = null, fallbackSeconds = null) {
  const settings = getQueueSettings();
  const now = Date.now();
  const normalized = normalizeStatus(status);
  const numericCalledAt = toNumber(calledAt);
  const numericQueuePosition = toNumber(queuePosition);
  const numericFallbackSeconds = toNumber(fallbackSeconds);

  if (ACTIVE_EXAM_STATES.has(normalized)) {
    const elapsed = numericCalledAt !== null ? Math.floor((now - numericCalledAt) / 1000) : 0;
    const base = normalized === 'in' || normalized === 'in_progress' || normalized === 'serving'
      ? settings.examMaxSeconds
      : settings.patientMaxWaitSeconds;
    const remaining = Math.max(0, base - elapsed);
    return remaining;
  }

  if (ACTIVE_WAITING_STATES.has(normalized)) {
    if (numericQueuePosition !== null) {
      return Math.max(1, getEstimatedWaitTime(numericQueuePosition) * 60);
    }

    if (numericCalledAt !== null && numericCalledAt > 0 && numericCalledAt < 10000) {
      return Math.max(1, getEstimatedWaitTime(numericCalledAt) * 60);
    }

    return settings.patientMaxWaitSeconds;
  }

  if (TERMINAL_STATES.has(normalized)) {
    return 0;
  }

  if (numericFallbackSeconds !== null) {
    return Math.max(0, numericFallbackSeconds);
  }

  if (numericQueuePosition !== null) {
    return Math.max(1, getEstimatedWaitTime(numericQueuePosition) * 60);
  }

  return settings.patientMaxWaitSeconds;
}

export function shouldSkipPatient(calledAt, status) {
  if (!getQueueSettings().timeoutHandlerEnabled) return false;
  return getRemainingTime(calledAt, status) <= 0;
}

export function onQueueSettingsChange(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener('queueSettingsUpdated', handler);
  return () => window.removeEventListener('queueSettingsUpdated', handler);
}

export default {
  DEFAULT_QUEUE_SETTINGS,
  getQueueSettings,
  saveQueueSettings,
  updateQueueSetting,
  resetQueueSettings,
  secondsToMinutes,
  minutesToSeconds,
  getEstimatedWaitTime,
  isNearTurn,
  getRemainingTime,
  shouldSkipPatient,
  onQueueSettingsChange,
};
