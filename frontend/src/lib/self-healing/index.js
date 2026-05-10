/**
 * MMC Self-Healing System
 * Main entry point for all self-healing functionality
 */

import '../doctor-login-fix';

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

// Imports for initialization + admin helpers (ESM-safe; no require())
import { getHealthState, getOverallStatus, startHealthMonitoring } from './HealthMonitor';
import { initSafeMode, injectSafeModeStyles, isSafeModeEnabled, getSafeModeStatus } from './SafeModeManager';
import {
  softReloadOnce,
  hardRefresh,
  resetRealtimeSubscribe,
  safeCacheClear,
  enterReadOnlyMode,
  exitReadOnlyMode,
  i18nCacheRepair,
  notificationDedupRepair,
  isReadOnlyMode,
} from './RecoveryPlaybooks';
import { logRepair, getRepairStatistics } from './RepairLog';
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
 * IMPORTANT: Each playbook has its own signature; this router calls them correctly.
 *
 * @param {string} playbookName - Name of playbook to run
 * @param {Object} params - Parameters for playbook
 */
export async function runPlaybook(playbookName, params = {}) {
  const playbookMap = {
    softReload: softReloadOnce,
    hardRefresh: hardRefresh,
    resetRealtime: resetRealtimeSubscribe,
    clearCache: safeCacheClear,
    fixNotifications: notificationDedupRepair,
    repairI18n: i18nCacheRepair,
    enterReadOnly: enterReadOnlyMode,
    exitReadOnly: exitReadOnlyMode,
  };

  const playbook = playbookMap[playbookName];
  if (!playbook) {
    throw new Error(`Unknown playbook: ${playbookName}`);
  }

  // Route by playbook name to match the real function signature
  switch (playbookName) {
    case 'softReload':
      return await playbook(params.module || 'admin');
    case 'hardRefresh':
      return await playbook();
    case 'resetRealtime': {
      const clinicId = params.clinicId || params.clinic || params.module || 'admin';
      const options = params.options && typeof params.options === 'object' ? params.options : {};
      return await playbook(clinicId, options);
    }
    case 'clearCache':
      return await playbook(params.scope || 'all');
    case 'fixNotifications':
      return await playbook();
    case 'repairI18n':
      return await playbook();
    case 'enterReadOnly':
      return await playbook(params.reason || 'MANUAL_ADMIN');
    case 'exitReadOnly':
      return await playbook();
    default:
      return await playbook();
  }
}

export default {
  initSelfHealingSystem,
  getFullSystemStatus,
  runPlaybook,
};
