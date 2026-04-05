export const STATUS = { OK: 'ok', DEGRADED: 'degraded' };
export const SEVERITY = { INFO: 'info', WARNING: 'warning', ERROR: 'error' };
export const MODULES = {};
export const PLAYBOOKS = {};
export const ERROR_SIGNATURES = {};
export const I18N_KEYS = {};
export const DEFAULT_TRANSLATIONS = {};

export const HEALTH_MONITOR_CONFIG = {};
export const REQUEST_MANAGER_CONFIG = {};
export const REALTIME_CONFIG = {};
export const RECOVERY_CONFIG = {};
export const REPAIR_LOG_CONFIG = {};

export const SAFE_MODE_CONFIG = {
  settingsKey: 'mmc.safe_mode',
  disabledFeatures: ['heavy-realtime', 'non-critical-animations'],
  preservedFeatures: ['queue-core', 'patient-login'],
};
