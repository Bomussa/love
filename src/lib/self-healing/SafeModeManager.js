/**
 * MMC Self-Healing System - Safe Mode Manager
 * Manages safe mode toggle and feature disabling
 */

import { logRepair } from './RepairLog';
import {
  SAFE_MODE_CONFIG,
  STATUS,
  SEVERITY,
} from './constants';

// Safe mode state
let safeModeEnabled = false;
let listeners = new Set();

/**
 * Initialize safe mode from storage
 */
export function initSafeMode() {
  // Check localStorage for safe mode setting
  const stored = localStorage.getItem(SAFE_MODE_CONFIG.settingsKey);
  safeModeEnabled = stored === 'true';
  
  if (safeModeEnabled) {
    applySafeMode();
  }
  
  logRepair({
    action: 'initSafeMode',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
    details: { enabled: safeModeEnabled },
  });
  
  return safeModeEnabled;
}

/**
 * Check if safe mode is enabled
 */
export function isSafeModeEnabled() {
  return safeModeEnabled;
}

/**
 * Enable safe mode
 */
export function enableSafeMode() {
  if (safeModeEnabled) return true;
  
  safeModeEnabled = true;
  localStorage.setItem(SAFE_MODE_CONFIG.settingsKey, 'true');
  
  applySafeMode();
  notifyListeners();
  
  logRepair({
    action: 'enableSafeMode',
    module: 'system',
    severity: SEVERITY.WARNING,
    result: 'success',
    details: { disabledFeatures: SAFE_MODE_CONFIG.disabledFeatures },
  });
  
  return true;
}

/**
 * Disable safe mode
 */
export function disableSafeMode() {
  if (!safeModeEnabled) return true;
  
  safeModeEnabled = false;
  localStorage.removeItem(SAFE_MODE_CONFIG.settingsKey);
  
  removeSafeMode();
  notifyListeners();
  
  logRepair({
    action: 'disableSafeMode',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
  });
  
  return true;
}

/**
 * Toggle safe mode
 */
export function toggleSafeMode() {
  if (safeModeEnabled) {
    return disableSafeMode();
  } else {
    return enableSafeMode();
  }
}

/**
 * Apply safe mode restrictions
 */
function applySafeMode() {
  // Set global flag
  window.MMC_SAFE_MODE = true;
  
  // Show banner
  showSafeModeBanner();
  
  // Disable features
  SAFE_MODE_CONFIG.disabledFeatures.forEach(feature => {
    disableFeature(feature);
  });
  
  // Dispatch event
  window.dispatchEvent(new CustomEvent('mmc:safe-mode-enabled'));
}

/**
 * Remove safe mode restrictions
 */
function removeSafeMode() {
  // Remove global flag
  delete window.MMC_SAFE_MODE;
  
  // Hide banner
  hideSafeModeBanner();
  
  // Re-enable features
  SAFE_MODE_CONFIG.disabledFeatures.forEach(feature => {
    enableFeature(feature);
  });
  
  // Dispatch event
  window.dispatchEvent(new CustomEvent('mmc:safe-mode-disabled'));
}

/**
 * Disable a feature
 */
function disableFeature(featureName) {
  if (!window.MMC_DISABLED_FEATURES) {
    window.MMC_DISABLED_FEATURES = new Set();
  }
  window.MMC_DISABLED_FEATURES.add(featureName);
  
  // Dispatch feature-specific event
  window.dispatchEvent(new CustomEvent('mmc:feature-disabled', {
    detail: { feature: featureName },
  }));
}

/**
 * Enable a feature
 */
function enableFeature(featureName) {
  if (window.MMC_DISABLED_FEATURES) {
    window.MMC_DISABLED_FEATURES.delete(featureName);
  }
  
  // Dispatch feature-specific event
  window.dispatchEvent(new CustomEvent('mmc:feature-enabled', {
    detail: { feature: featureName },
  }));
}

/**
 * Check if a feature is disabled
 */
export function isFeatureDisabled(featureName) {
  if (!safeModeEnabled) return false;
  return window.MMC_DISABLED_FEATURES?.has(featureName) ||
         SAFE_MODE_CONFIG.disabledFeatures.includes(featureName);
}

/**
 * Check if a feature is preserved (critical)
 */
export function isFeaturePreserved(featureName) {
  return SAFE_MODE_CONFIG.preservedFeatures.includes(featureName);
}

/**
 * Show safe mode banner
 */
function showSafeModeBanner() {
  // Remove existing banner
  hideSafeModeBanner();
  
  const banner = document.createElement('div');
  banner.id = 'mmc-safe-mode-banner';
  banner.className = 'mmc-safe-mode-banner';
  banner.innerHTML = `
    <div class="mmc-banner-content">
      <span class="mmc-banner-icon">🛡️</span>
      <span class="mmc-banner-text">
        وضع الأمان مفعل - Safe Mode Active
      </span>
      <button class="mmc-banner-close" onclick="window.safeModeManager?.disableSafeMode()">✕</button>
    </div>
  `;
  
  document.body.appendChild(banner);
}

/**
 * Hide safe mode banner
 */
function hideSafeModeBanner() {
  const existing = document.getElementById('mmc-safe-mode-banner');
  if (existing) {
    existing.remove();
  }
}

/**
 * Subscribe to safe mode changes
 */
export function subscribeToSafeMode(callback) {
  listeners.add(callback);
  
  // Immediately call with current state
  callback(safeModeEnabled);
  
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Notify listeners of state change
 */
function notifyListeners() {
  listeners.forEach(callback => {
    try {
      callback(safeModeEnabled);
    } catch (e) {
      console.error('[SafeModeManager] Listener error:', e);
    }
  });
}

/**
 * Get safe mode status for UI
 */
export function getSafeModeStatus() {
  return {
    enabled: safeModeEnabled,
    disabledFeatures: SAFE_MODE_CONFIG.disabledFeatures,
    preservedFeatures: SAFE_MODE_CONFIG.preservedFeatures,
  };
}

/**
 * CSS styles for safe mode banner
 * Should be added to global CSS
 */
export const safeModeStyles = `
  .mmc-safe-mode-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #f59e0b, #d97706);
    color: white;
    padding: 8px 16px;
    z-index: 9999;
    font-family: 'Cairo', -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  .mmc-safe-mode-banner .mmc-banner-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .mmc-safe-mode-banner .mmc-banner-icon {
    font-size: 16px;
  }
  
  .mmc-safe-mode-banner .mmc-banner-text {
    font-weight: 500;
  }
  
  .mmc-safe-mode-banner .mmc-banner-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    font-size: 12px;
  }
  
  .mmc-safe-mode-banner .mmc-banner-close:hover {
    background: rgba(255,255,255,0.3);
  }
`;

/**
 * Inject safe mode styles
 */
export function injectSafeModeStyles() {
  if (document.getElementById('mmc-safe-mode-styles')) return;
  
  const styleEl = document.createElement('style');
  styleEl.id = 'mmc-safe-mode-styles';
  styleEl.textContent = safeModeStyles;
  document.head.appendChild(styleEl);
}

// Expose to window for banner close button
if (typeof window !== 'undefined') {
  window.safeModeManager = {
    enableSafeMode,
    disableSafeMode,
    toggleSafeMode,
    isEnabled: isSafeModeEnabled,
  };
}

export default {
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
};
