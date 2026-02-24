/**
 * MMC Self-Healing System - Recovery Playbooks
 * Recovery actions for various failure scenarios
 */

import { logRepair } from './RepairLog';
import {
  RECOVERY_CONFIG,
  STATUS,
  SEVERITY,
  PLAYBOOKS,
  ERROR_SIGNATURES,
} from './constants';

// Circuit breakers store
const circuitBreakers = new Map();

/**
 * Circuit Breaker class
 */
class CircuitBreaker {
  constructor(key, threshold = 5, windowMs = 60000, openMs = 30000) {
    this.key = key;
    this.threshold = threshold;
    this.windowMs = windowMs;
    this.openMs = openMs;
    this.failures = [];
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.openedAt = null;
  }

  recordSuccess() {
    this.failures = [];
    this.state = 'CLOSED';
    this.openedAt = null;
  }

  recordFailure() {
    const now = Date.now();
    this.failures.push(now);
    
    // Remove old failures outside window
    this.failures = this.failures.filter(t => now - t < this.windowMs);
    
    if (this.failures.length >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }

  canExecute() {
    if (this.state === 'CLOSED') return true;
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.openMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    
    return true; // HALF_OPEN
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures.length,
      threshold: this.threshold,
    };
  }
}

/**
 * Get or create circuit breaker
 */
function getCircuitBreaker(key) {
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, new CircuitBreaker(key));
  }
  return circuitBreakers.get(key);
}

/**
 * Delay utility
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Soft reload once per session
 * Resets module state without full page reload
 */
export async function softReloadOnce(moduleName) {
  const tokenKey = `${RECOVERY_CONFIG.softReload.tokenPrefix}${moduleName}`;
  
  // Check if already attempted
  if (sessionStorage.getItem(tokenKey)) {
    logRepair({
      action: PLAYBOOKS.SOFT_RELOAD,
      module: moduleName,
      severity: SEVERITY.WARNING,
      result: 'skipped',
      details: { reason: 'ALREADY_ATTEMPTED' },
    });
    return { success: false, reason: 'ALREADY_ATTEMPTED' };
  }
  
  // Set token to prevent loops
  sessionStorage.setItem(tokenKey, 'true');
  
  try {
    // Reset module state
    if (window.__MMC_MODULE_STATES__ && window.__MMC_MODULE_STATES__[moduleName]) {
      window.__MMC_MODULE_STATES__[moduleName] = {};
    }
    
    // Clear module cache
    const moduleCachePrefix = `mmc_cache_${moduleName}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(moduleCachePrefix)) {
        localStorage.removeItem(key);
      }
    }
    
    // Trigger re-render via event
    window.dispatchEvent(new CustomEvent('mmc:soft-reload', {
      detail: { module: moduleName },
    }));
    
    logRepair({
      action: PLAYBOOKS.SOFT_RELOAD,
      module: moduleName,
      severity: SEVERITY.INFO,
      result: 'success',
    });
    
    return { success: true };
    
  } catch (error) {
    logRepair({
      action: PLAYBOOKS.SOFT_RELOAD,
      module: moduleName,
      severity: SEVERITY.ERROR,
      result: 'failed',
      error,
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Hard refresh (last resort)
 * Full page reload, but only once per session
 */
export async function hardRefresh() {
  const tokenKey = RECOVERY_CONFIG.hardRefresh.tokenKey;
  
  // Check if already attempted
  if (sessionStorage.getItem(tokenKey)) {
    return { success: false, reason: 'ALREADY_ATTEMPTED' };
  }
  
  // Set token
  sessionStorage.setItem(tokenKey, 'true');
  
  logRepair({
    action: PLAYBOOKS.HARD_REFRESH,
    module: 'system',
    severity: SEVERITY.WARNING,
    result: 'initiated',
  });
  
  // Reload page
  window.location.reload();
  
  return { success: true };
}

/**
 * Reset realtime subscription with backoff
 */
export async function resetRealtimeSubscribe(clinicId, options = {}) {
  const { maxAttempts = RECOVERY_CONFIG.resubscribeBackoffMs.length } = options;
  const backoffMs = RECOVERY_CONFIG.resubscribeBackoffMs;
  
  logRepair({
    action: PLAYBOOKS.RESET_REALTIME,
    module: 'realtime',
    severity: SEVERITY.WARNING,
    result: 'initiated',
    details: { clinicId, maxAttempts },
  });
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Unsubscribe existing channels
      if (window.supabase) {
        window.supabase.removeAllChannels();
      }
      
      // Wait backoff period
      await delay(backoffMs[attempt] || backoffMs[backoffMs.length - 1]);
      
      // Re-subscribe (if clinicId provided)
      if (clinicId && window.supabase) {
        const channel = window.supabase
          .channel(`queue:${clinicId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'queues',
            filter: `clinic_id=eq.${clinicId}`,
          }, (payload) => {
            window.dispatchEvent(new CustomEvent('mmc:queue-update', {
              detail: payload,
            }));
          })
          .subscribe();
        
        // Wait for subscription confirmation
        await delay(500);
        
        // Update heartbeat tracking
        window.__MMC_LAST_HEARTBEAT__ = Date.now();
      }
      
      logRepair({
        action: PLAYBOOKS.RESET_REALTIME,
        module: 'realtime',
        severity: SEVERITY.INFO,
        result: 'success',
        attemptsCount: attempt + 1,
      });
      
      return { success: true, attempts: attempt + 1 };
      
    } catch (error) {
      logRepair({
        action: PLAYBOOKS.RESET_REALTIME,
        module: 'realtime',
        severity: SEVERITY.WARNING,
        result: 'retry',
        attemptsCount: attempt + 1,
        error,
      });
    }
  }
  
  // All attempts failed - enable polling fallback
  enablePollingFallback(clinicId);
  
  logRepair({
    action: PLAYBOOKS.RESET_REALTIME,
    module: 'realtime',
    severity: SEVERITY.ERROR,
    result: 'fallback_to_polling',
    attemptsCount: maxAttempts,
  });
  
  return { success: false, fallback: 'polling' };
}

/**
 * Enable polling fallback when realtime fails
 */
function enablePollingFallback(clinicId) {
  if (window.__MMC_POLLING_INTERVAL__) {
    clearInterval(window.__MMC_POLLING_INTERVAL__);
  }
  
  window.__MMC_POLLING_ACTIVE__ = true;
  
  // Start polling
  window.__MMC_POLLING_INTERVAL__ = setInterval(async () => {
    if (!window.__MMC_POLLING_ACTIVE__) return;
    
    try {
      // Fetch queue status via API
      const response = await fetch(`/functions/v1/queue-status?clinic=${clinicId}`);
      if (response.ok) {
        const data = await response.json();
        window.dispatchEvent(new CustomEvent('mmc:queue-update', {
          detail: { new: data },
        }));
      }
    } catch (e) {
      // Silent fail - will retry on next interval
    }
  }, RECOVERY_CONFIG.realtime.pollingIntervalMs);
  
  // Try to return to realtime after stability period
  setTimeout(() => {
    window.__MMC_POLLING_ACTIVE__ = false;
    clearInterval(window.__MMC_POLLING_INTERVAL__);
    resetRealtimeSubscribe(clinicId);
  }, RECOVERY_CONFIG.realtime.stabilityThresholdMs);
}

/**
 * API retry with backoff and circuit breaker
 */
export async function apiRetryWithBackoff(requestFn, options = {}) {
  const {
    maxRetries = RECOVERY_CONFIG.apiRetry.maxRetries,
    baseDelayMs = RECOVERY_CONFIG.apiRetry.baseBackoffMs,
    maxDelayMs = RECOVERY_CONFIG.apiRetry.maxBackoffMs,
    timeoutMs = RECOVERY_CONFIG.apiRetry.timeoutMs,
    circuitKey = 'default',
  } = options;
  
  const breaker = getCircuitBreaker(circuitKey);
  
  if (!breaker.canExecute()) {
    logRepair({
      action: PLAYBOOKS.API_RETRY,
      module: 'api',
      severity: SEVERITY.WARNING,
      result: 'circuit_open',
      details: breaker.getState(),
    });
    return { success: false, reason: 'CIRCUIT_OPEN' };
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Apply timeout
      const result = await Promise.race([
        requestFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        ),
      ]);
      
      breaker.recordSuccess();
      
      logRepair({
        action: PLAYBOOKS.API_RETRY,
        module: 'api',
        severity: SEVERITY.INFO,
        result: 'success',
        attemptsCount: attempt + 1,
      });
      
      return { success: true, data: result, attempts: attempt + 1 };
      
    } catch (error) {
      breaker.recordFailure();
      
      const delayMs = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      
      logRepair({
        action: PLAYBOOKS.API_RETRY,
        module: 'api',
        severity: SEVERITY.WARNING,
        result: 'retry',
        attemptsCount: attempt + 1,
        error,
        details: { delayMs },
      });
      
      if (attempt < maxRetries - 1) {
        await delay(delayMs + Math.random() * 100); // Jitter
      }
    }
  }
  
  return { success: false, reason: 'MAX_RETRIES_EXCEEDED' };
}

/**
 * Safe cache clear - only scoped keys
 */
export function safeCacheClear(scope = 'all') {
  const protectedKeys = RECOVERY_CONFIG.cacheClear.protectedKeys;
  const protectedPrefixes = RECOVERY_CONFIG.cacheClear.protectedPrefixes;
  
  const clearablePrefixes = {
    data: ['cached_queues', 'cached_stats', 'cached_clinics', 'mmc_cache_'],
    ui: ['ui_state', 'scroll_position', 'expanded_panels'],
    temp: ['temp_', 'draft_', 'preview_'],
    all: ['cached_', 'ui_state', 'temp_', 'draft_', 'preview_', 'mmc_cache_'],
  };
  
  const prefixes = clearablePrefixes[scope] || clearablePrefixes.all;
  let clearedCount = 0;
  const clearedKeys = [];
  
  // Clear localStorage
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    // Skip protected keys
    if (protectedKeys.includes(key)) continue;
    if (protectedPrefixes.some(p => key.startsWith(p))) continue;
    
    // Check if key matches clearable prefix
    const shouldClear = prefixes.some(prefix => 
      key.startsWith(prefix) || key.includes(prefix)
    );
    
    if (shouldClear) {
      localStorage.removeItem(key);
      clearedCount++;
      clearedKeys.push(key);
    }
  }
  
  // Clear sessionStorage (non-critical only)
  const sessionProtected = ['sh_reload_', 'sh_hard_refresh_', 'mmc_safe_mode'];
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    if (!sessionProtected.some(p => key.startsWith(p))) {
      sessionStorage.removeItem(key);
    }
  }
  
  logRepair({
    action: PLAYBOOKS.SAFE_CACHE_CLEAR,
    module: 'cache',
    severity: SEVERITY.INFO,
    result: 'success',
    details: { scope, clearedCount, clearedKeys: clearedKeys.slice(0, 10) },
  });
  
  return { success: true, clearedCount, clearedKeys };
}

/**
 * Enter read-only mode
 */
export function enterReadOnlyMode(reason = 'API_UNAVAILABLE') {
  // Set global flag
  window.MMC_READ_ONLY = true;
  window.MMC_READ_ONLY_REASON = reason;
  window.MMC_READ_ONLY_SINCE = Date.now();
  
  // Persist in session
  sessionStorage.setItem('mmc_read_only', 'true');
  sessionStorage.setItem('mmc_read_only_reason', reason);
  
  // Disable non-critical features
  window.MMC_DISABLED_FEATURES = [
    'queue_entry',
    'patient_registration',
    'admin_mutations',
    'pin_generation',
    'settings_changes',
  ];
  
  // Show banner
  showReadOnlyBanner(reason);
  
  // Start health check polling
  startReadOnlyHealthCheck();
  
  logRepair({
    action: PLAYBOOKS.READ_ONLY_MODE,
    module: 'system',
    severity: SEVERITY.ERROR,
    result: 'activated',
    details: { reason },
  });
  
  return { success: true, disabledFeatures: window.MMC_DISABLED_FEATURES };
}

/**
 * Exit read-only mode
 */
export function exitReadOnlyMode() {
  window.MMC_READ_ONLY = false;
  delete window.MMC_READ_ONLY_REASON;
  delete window.MMC_READ_ONLY_SINCE;
  delete window.MMC_DISABLED_FEATURES;
  
  sessionStorage.removeItem('mmc_read_only');
  sessionStorage.removeItem('mmc_read_only_reason');
  
  hideReadOnlyBanner();
  
  logRepair({
    action: PLAYBOOKS.EXIT_READ_ONLY,
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'deactivated',
  });
  
  return { success: true };
}

/**
 * Show read-only banner
 */
function showReadOnlyBanner(reason) {
  // Remove existing banner
  hideReadOnlyBanner();
  
  const banner = document.createElement('div');
  banner.id = 'mmc-read-only-banner';
  banner.className = 'mmc-read-only-banner';
  banner.innerHTML = `
    <div class="mmc-banner-content">
      <span class="mmc-banner-icon">⚠️</span>
      <span class="mmc-banner-text">
        وضع القراءة فقط - Limited Mode
        ${reason ? `(${reason})` : ''}
      </span>
    </div>
  `;
  
  document.body.appendChild(banner);
}

/**
 * Hide read-only banner
 */
function hideReadOnlyBanner() {
  const existing = document.getElementById('mmc-read-only-banner');
  if (existing) {
    existing.remove();
  }
}

/**
 * Start health check for read-only mode
 */
function startReadOnlyHealthCheck() {
  const checkInterval = setInterval(async () => {
    if (!window.MMC_READ_ONLY) {
      clearInterval(checkInterval);
      return;
    }
    
    try {
      const response = await fetch('/functions/v1/healthz', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        exitReadOnlyMode();
        clearInterval(checkInterval);
      }
    } catch (e) {
      // Still down, continue checking
    }
  }, RECOVERY_CONFIG.readOnlyMode.healthCheckIntervalMs);
}

/**
 * i18n cache repair
 */
export async function i18nCacheRepair() {
  try {
    // Clear i18n cache
    localStorage.removeItem('i18n_cache');
    localStorage.removeItem('i18n_language');
    
    // Get current language
    const currentLang = localStorage.getItem('language') || 'ar';
    
    // Reload translations (if we have a reload function)
    if (window.__MMC_RELOAD_I18N__) {
      await window.__MMC_RELOAD_I18N__(currentLang);
    }
    
    logRepair({
      action: PLAYBOOKS.I18N_REPAIR,
      module: 'i18n',
      severity: SEVERITY.INFO,
      result: 'success',
      details: { language: currentLang },
    });
    
    return { success: true };
    
  } catch (error) {
    // Fallback to Arabic
    localStorage.setItem('language', 'ar');
    
    logRepair({
      action: PLAYBOOKS.I18N_REPAIR,
      module: 'i18n',
      severity: SEVERITY.WARNING,
      result: 'fallback',
      details: { fallback: 'ar' },
    });
    
    return { success: true, fallback: 'ar' };
  }
}

/**
 * Notification dedup repair
 */
export function notificationDedupRepair() {
  // Clear dedup tracking
  window.notificationDedupMap = new Map();
  
  // Clear recent notifications
  window.__MMC_RECENT_NOTIFICATIONS__ = [];
  
  // Clear stuck toasts
  document.querySelectorAll('.notification-toast, .toast, [class*="toast"]').forEach(el => {
    el.remove();
  });
  
  logRepair({
    action: PLAYBOOKS.NOTIFICATION_DEDUP,
    module: 'notifications',
    severity: SEVERITY.INFO,
    result: 'success',
  });
  
  return { success: true };
}

/**
 * Check if read-only mode is active
 */
export function isReadOnlyMode() {
  return window.MMC_READ_ONLY === true ||
         sessionStorage.getItem('mmc_read_only') === 'true';
}

/**
 * Check if a feature is disabled
 */
export function isFeatureDisabled(featureName) {
  if (!isReadOnlyMode()) return false;
  return window.MMC_DISABLED_FEATURES?.includes(featureName);
}

export default {
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
  isFeatureDisabled,
  getCircuitBreaker: (key) => getCircuitBreaker(key).getState(),
};
