/**
 * MMC Self-Healing System
 * Main entry point for all self-healing functionality
 */

// Constants
export {
  HEALTH_MONITOR_CONFIG,
  REQUEST_MANAGER_CONFIG,
  REALTIME_CONFIG,
  RECOVERY_CONFIG,
  SAFE_MODE_CONFIG,
  REPAIR_LOG_CONFIG,
  STATUS,
  SEVERITY,
  MODULES,
  PLAYBOOKS,
  ERROR_SIGNATURES,
  I18N_KEYS,
  DEFAULT_TRANSLATIONS,
} from './constants';

// Health Monitor
export {
  getHealthState,
  getOverallStatus,
  subscribeToHealthChanges,
  startHealthMonitoring,
  stopHealthMonitoring,
  forceHealthCheck,
} from './HealthMonitor';

// Recovery Playbooks
export {
  softReloadOnce,
  hardRefresh,
  resetRealtimeSubscribe,
  apiRetryWithBackoff,
  safeCacheClear,
  enterReadOnlyMode,
  exitReadOnlyMode,
  i18nCacheRepair,
  notificationDedupRepair,
  isReadOnlyMode,
  isFeatureDisabled as isPlaybookFeatureDisabled,
} from './RecoveryPlaybooks';

// Safe Mode Manager
export {
  initSafeMode,
  isSafeModeEnabled,
  enableSafeMode,
  disableSafeMode,
  toggleSafeMode,
  isFeatureDisabled,
  isFeaturePreserved,
  subscribeToSafeMode,
  getSafeModeStatus,
  injectSafeModeStyles,
} from './SafeModeManager';

// Repair Log
export {
  logRepair,
  generateCorrelationId,
  getDeviceFingerprint,
  getLocalRepairLogs,
  getFilteredLogs,
  clearLocalRepairLogs,
  exportLogsAsCSV,
  exportLogsAsJSON,
  getRepairStatistics,
  downloadLogs,
} from './RepairLog';

// Import for initialization
import { startHealthMonitoring } from './HealthMonitor';
import { initSafeMode, injectSafeModeStyles } from './SafeModeManager';
import { logRepair } from './RepairLog';
import { STATUS, SEVERITY } from './constants';

/**
 * Initialize the entire self-healing system
 * Call this once when the app starts
 */
export function initSelfHealingSystem() {
  console.log('[SelfHealing] Initializing self-healing system...');
  
  // Inject styles
  injectSafeModeStyles();
  
  // Initialize safe mode
  initSafeMode();
  
  // Start health monitoring
  startHealthMonitoring();
  
  // Log initialization
  logRepair({
    action: 'initSelfHealingSystem',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
    mode: STATUS.OK,
  });
  
  console.log('[SelfHealing] Self-healing system initialized');
  
  return true;
}

/**
 * Get full system status for admin dashboard
 */
export function getFullSystemStatus() {
  const { getHealthState, getOverallStatus } = require('./HealthMonitor');
  const { isSafeModeEnabled, getSafeModeStatus } = require('./SafeModeManager');
  const { isReadOnlyMode } = require('./RecoveryPlaybooks');
  const { getRepairStatistics } = require('./RepairLog');
  
  return {
    health: getHealthState(),
    overallStatus: getOverallStatus(),
    safeMode: {
      enabled: isSafeModeEnabled(),
      ...getSafeModeStatus(),
    },
    readOnlyMode: isReadOnlyMode(),
    repairStats: getRepairStatistics(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run a playbook by name (for admin UI)
 * @param {string} playbookName - Name of playbook to run
 * @param {Object} params - Parameters for playbook
 */
export async function runPlaybook(playbookName, params = {}) {
  const playbooks = require('./RecoveryPlaybooks');
  
  const playbookMap = {
    softReload: playbooks.softReloadOnce,
    resetRealtime: playbooks.resetRealtimeSubscribe,
    clearCache: playbooks.safeCacheClear,
    fixNotifications: playbooks.notificationDedupRepair,
    repairI18n: playbooks.i18nCacheRepair,
    enterReadOnly: playbooks.enterReadOnlyMode,
    exitReadOnly: playbooks.exitReadOnlyMode,
  };
  
  const playbook = playbookMap[playbookName];
  if (!playbook) {
    throw new Error(`Unknown playbook: ${playbookName}`);
  }
  
  return await playbook(params.module || 'admin', params);
}

export default {
  initSelfHealingSystem,
  getFullSystemStatus,
  runPlaybook,
};
