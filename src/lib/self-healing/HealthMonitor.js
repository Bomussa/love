/**
 * MMC Self-Healing System - Health Monitor
 * Continuously monitors system health and reports status
 */

import { supabase } from '../supabase-client';
import { logRepair } from './RepairLog';
import {
  HEALTH_MONITOR_CONFIG,
  STATUS,
  SEVERITY,
  MODULES,
  ERROR_SIGNATURES,
} from './constants';

// Health state
let healthState = {
  frontend: { status: STATUS.OK, lastCheck: null, failures: 0 },
  api: { status: STATUS.OK, lastCheck: null, failures: 0 },
  database: { status: STATUS.OK, lastCheck: null, failures: 0 },
  realtime: { status: STATUS.OK, lastCheck: null, failures: 0 },
  notifications: { status: STATUS.OK, lastCheck: null, failures: 0 },
};

// Check intervals
let checkIntervals = {};

// Listeners for status changes
const statusListeners = new Set();

/**
 * Get current health state
 * @returns {Object} Health state for all modules
 */
export function getHealthState() {
  return { ...healthState };
}

/**
 * Get overall system status
 * @returns {string} OK, DEGRADED, or FAIL
 */
export function getOverallStatus() {
  const statuses = Object.values(healthState).map(h => h.status);
  
  if (statuses.some(s => s === STATUS.FAIL)) {
    return STATUS.FAIL;
  }
  if (statuses.some(s => s === STATUS.DEGRADED)) {
    return STATUS.DEGRADED;
  }
  return STATUS.OK;
}

/**
 * Subscribe to health status changes
 * @param {Function} callback - Called when status changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToHealthChanges(callback) {
  statusListeners.add(callback);
  
  // Immediately call with current state
  callback(getHealthState(), getOverallStatus());
  
  return () => {
    statusListeners.delete(callback);
  };
}

/**
 * Notify listeners of status change
 */
function notifyStatusChange() {
  const state = getHealthState();
  const overall = getOverallStatus();
  
  statusListeners.forEach(callback => {
    try {
      callback(state, overall);
    } catch (e) {
      console.error('[HealthMonitor] Listener error:', e);
    }
  });
}

/**
 * Update module status
 * @param {string} module - Module name
 * @param {string} status - New status
 * @param {Object} details - Additional details
 */
function updateModuleStatus(module, status, details = {}) {
  const previousStatus = healthState[module].status;
  
  healthState[module] = {
    ...healthState[module],
    status,
    lastCheck: new Date().toISOString(),
    ...details,
  };
  
  // Log status changes
  if (previousStatus !== status) {
    logRepair({
      action: 'statusChange',
      module,
      severity: status === STATUS.FAIL ? SEVERITY.ERROR :
                status === STATUS.DEGRADED ? SEVERITY.WARNING : SEVERITY.INFO,
      mode: status,
      details: { previousStatus, ...details },
    });
    
    notifyStatusChange();
  }
}

/**
 * Check frontend health
 * - DOM ready
 * - No critical console errors
 * - Memory usage
 */
function checkFrontendHealth() {
  try {
    // Check DOM ready
    if (document.readyState !== 'complete') {
      updateModuleStatus(MODULES.FRONTEND, STATUS.DEGRADED, {
        reason: 'DOM not ready',
      });
      return;
    }
    
    // Check for critical errors (we track these via error boundary)
    const recentErrors = window.__MMC_RECENT_ERRORS__ || [];
    const recentCriticalErrors = recentErrors.filter(e => 
      Date.now() - e.timestamp < 60000
    );
    
    if (recentCriticalErrors.length > 3) {
      updateModuleStatus(MODULES.FRONTEND, STATUS.DEGRADED, {
        reason: 'Multiple recent errors',
        errorCount: recentCriticalErrors.length,
      });
      return;
    }
    
    // Check memory usage (if available)
    if (performance && performance.memory) {
      const memoryRatio = performance.memory.usedJSHeapSize / 
                          performance.memory.jsHeapSizeLimit;
      if (memoryRatio > 0.9) {
        updateModuleStatus(MODULES.FRONTEND, STATUS.DEGRADED, {
          reason: 'High memory usage',
          memoryRatio: Math.round(memoryRatio * 100),
        });
        return;
      }
    }
    
    updateModuleStatus(MODULES.FRONTEND, STATUS.OK, {
      domReady: true,
      recentErrors: recentCriticalErrors.length,
    });
    
    // Reset failure count on success
    healthState.frontend.failures = 0;
    
  } catch (error) {
    healthState.frontend.failures++;
    updateModuleStatus(MODULES.FRONTEND, STATUS.DEGRADED, {
      reason: 'Check failed',
      error: error.message,
    });
  }
}

/**
 * Check API health
 * - Ping health endpoint
 * - Check response time
 */
async function checkApiHealth() {
  try {
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 
      HEALTH_MONITOR_CONFIG.TIMEOUTS.API);
    
    const response = await fetch('/functions/v1/healthz', {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      healthState.api.failures++;
      const status = healthState.api.failures >= HEALTH_MONITOR_CONFIG.FAIL_THRESHOLD 
        ? STATUS.FAIL 
        : STATUS.DEGRADED;
      
      updateModuleStatus(MODULES.API, status, {
        reason: 'HTTP error',
        statusCode: response.status,
        responseTime,
        failures: healthState.api.failures,
      });
      return;
    }
    
    // Check response time
    if (responseTime > 3000) {
      updateModuleStatus(MODULES.API, STATUS.DEGRADED, {
        reason: 'Slow response',
        responseTime,
      });
      return;
    }
    
    updateModuleStatus(MODULES.API, STATUS.OK, {
      responseTime,
    });
    
    // Reset failure count on success
    healthState.api.failures = 0;
    
  } catch (error) {
    healthState.api.failures++;
    const status = healthState.api.failures >= HEALTH_MONITOR_CONFIG.FAIL_THRESHOLD 
      ? STATUS.FAIL 
      : STATUS.DEGRADED;
    
    updateModuleStatus(MODULES.API, status, {
      reason: error.name === 'AbortError' ? 'Timeout' : 'Network error',
      error: error.message,
      failures: healthState.api.failures,
    });
  }
}

/**
 * Check database health
 * - Simple SELECT query
 */
async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    
    const { data, error } = await supabase
      .from('clinics')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      healthState.database.failures++;
      const status = healthState.database.failures >= HEALTH_MONITOR_CONFIG.FAIL_THRESHOLD 
        ? STATUS.FAIL 
        : STATUS.DEGRADED;
      
      updateModuleStatus(MODULES.DATABASE, status, {
        reason: 'Query failed',
        error: error.message,
        failures: healthState.database.failures,
      });
      return;
    }
    
    // Check response time
    if (responseTime > 3000) {
      updateModuleStatus(MODULES.DATABASE, STATUS.DEGRADED, {
        reason: 'Slow query',
        responseTime,
      });
      return;
    }
    
    updateModuleStatus(MODULES.DATABASE, STATUS.OK, {
      responseTime,
    });
    
    // Reset failure count on success
    healthState.database.failures = 0;
    
  } catch (error) {
    healthState.database.failures++;
    const status = healthState.database.failures >= HEALTH_MONITOR_CONFIG.FAIL_THRESHOLD 
      ? STATUS.FAIL 
      : STATUS.DEGRADED;
    
    updateModuleStatus(MODULES.DATABASE, status, {
      reason: 'Exception',
      error: error.message,
      failures: healthState.database.failures,
    });
  }
}

/**
 * Check realtime health
 * - Connection state
 * - Last heartbeat
 */
function checkRealtimeHealth() {
  try {
    // Get Supabase realtime state
    const channels = supabase.getChannels ? supabase.getChannels() : [];
    const hasActiveChannels = channels.length > 0;
    
    // Check last heartbeat (if we track it)
    const lastHeartbeat = window.__MMC_LAST_HEARTBEAT__;
    const heartbeatAge = lastHeartbeat ? Date.now() - lastHeartbeat : Infinity;
    
    if (!hasActiveChannels && heartbeatAge > 25000) {
      healthState.realtime.failures++;
      const status = healthState.realtime.failures >= HEALTH_MONITOR_CONFIG.DEGRADED_THRESHOLD 
        ? STATUS.DEGRADED 
        : STATUS.OK;
      
      updateModuleStatus(MODULES.REALTIME, status, {
        reason: 'No active channels',
        channelCount: channels.length,
        heartbeatAge: Math.round(heartbeatAge / 1000),
        failures: healthState.realtime.failures,
      });
      return;
    }
    
    if (heartbeatAge > 25000) {
      healthState.realtime.failures++;
      updateModuleStatus(MODULES.REALTIME, STATUS.DEGRADED, {
        reason: 'Heartbeat timeout',
        heartbeatAge: Math.round(heartbeatAge / 1000),
        failures: healthState.realtime.failures,
      });
      return;
    }
    
    updateModuleStatus(MODULES.REALTIME, STATUS.OK, {
      channelCount: channels.length,
      heartbeatAge: Math.round(heartbeatAge / 1000),
    });
    
    // Reset failure count on success
    healthState.realtime.failures = 0;
    
  } catch (error) {
    healthState.realtime.failures++;
    updateModuleStatus(MODULES.REALTIME, STATUS.DEGRADED, {
      reason: 'Check failed',
      error: error.message,
    });
  }
}

/**
 * Check notifications health
 * - Delivery tracking
 * - Duplicate detection
 */
function checkNotificationsHealth() {
  try {
    // Check for notification storms (many notifications in short time)
    const recentNotifications = window.__MMC_RECENT_NOTIFICATIONS__ || [];
    const oneMinuteAgo = Date.now() - 60000;
    const recentCount = recentNotifications.filter(n => n.time > oneMinuteAgo).length;
    
    if (recentCount > 20) {
      updateModuleStatus(MODULES.NOTIFICATIONS, STATUS.DEGRADED, {
        reason: 'Notification storm detected',
        recentCount,
      });
      return;
    }
    
    // Check dedup system
    const dedupMap = window.notificationDedupMap;
    if (dedupMap && dedupMap.size > 1000) {
      updateModuleStatus(MODULES.NOTIFICATIONS, STATUS.DEGRADED, {
        reason: 'Dedup map too large',
        dedupSize: dedupMap.size,
      });
      return;
    }
    
    updateModuleStatus(MODULES.NOTIFICATIONS, STATUS.OK, {
      recentCount,
      dedupSize: dedupMap?.size || 0,
    });
    
    // Reset failure count on success
    healthState.notifications.failures = 0;
    
  } catch (error) {
    healthState.notifications.failures++;
    updateModuleStatus(MODULES.NOTIFICATIONS, STATUS.DEGRADED, {
      reason: 'Check failed',
      error: error.message,
    });
  }
}

/**
 * Start health monitoring
 */
export function startHealthMonitoring() {
  // Stop any existing monitoring
  stopHealthMonitoring();
  
  // Initial checks
  checkFrontendHealth();
  checkRealtimeHealth();
  checkNotificationsHealth();
  
  // Start periodic checks
  checkIntervals.frontend = setInterval(
    checkFrontendHealth,
    HEALTH_MONITOR_CONFIG.CHECK_INTERVALS.FRONTEND
  );
  
  checkIntervals.api = setInterval(
    checkApiHealth,
    HEALTH_MONITOR_CONFIG.CHECK_INTERVALS.API
  );
  
  checkIntervals.database = setInterval(
    checkDatabaseHealth,
    HEALTH_MONITOR_CONFIG.CHECK_INTERVALS.DATABASE
  );
  
  checkIntervals.realtime = setInterval(
    checkRealtimeHealth,
    HEALTH_MONITOR_CONFIG.CHECK_INTERVALS.REALTIME
  );
  
  checkIntervals.notifications = setInterval(
    checkNotificationsHealth,
    HEALTH_MONITOR_CONFIG.CHECK_INTERVALS.FRONTEND
  );
  
  logRepair({
    action: 'startHealthMonitoring',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
  });
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitoring() {
  Object.values(checkIntervals).forEach(interval => {
    clearInterval(interval);
  });
  checkIntervals = {};
  
  logRepair({
    action: 'stopHealthMonitoring',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
  });
}

/**
 * Force health check for a module
 * @param {string} module - Module name
 */
export async function forceHealthCheck(module) {
  switch (module) {
    case MODULES.FRONTEND:
      checkFrontendHealth();
      break;
    case MODULES.API:
      await checkApiHealth();
      break;
    case MODULES.DATABASE:
      await checkDatabaseHealth();
      break;
    case MODULES.REALTIME:
      checkRealtimeHealth();
      break;
    case MODULES.NOTIFICATIONS:
      checkNotificationsHealth();
      break;
    default:
      // Check all
      checkFrontendHealth();
      await checkApiHealth();
      await checkDatabaseHealth();
      checkRealtimeHealth();
      checkNotificationsHealth();
  }
  
  return getHealthState();
}

export default {
  getHealthState,
  getOverallStatus,
  subscribeToHealthChanges,
  startHealthMonitoring,
  stopHealthMonitoring,
  forceHealthCheck,
};
