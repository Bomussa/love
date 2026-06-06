function emitRecoveryEvent(name, detail = {}) {
  if (typeof window === 'undefined') return false
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }))
    return true
  } catch {
    return false
  }
}

export async function softReloadOnce() {
  emitRecoveryEvent('mmc:soft-reload-once')
  return true
}

export async function hardRefresh() {
  // Avoid full page reloads that can break the patient journey.
  // Recovery is handled via targeted cache refreshes and retry bridges.
  return softReloadOnce()
}

export async function resetRealtimeSubscribe() {
  emitRecoveryEvent('mmc:realtime-reset')
  return true
}

export async function apiRetryWithBackoff() {
  emitRecoveryEvent('mmc:api-retry')
  return true
}

export async function safeCacheClear() {
  emitRecoveryEvent('mmc:cache-clear')
  return true
}

export async function enterReadOnlyMode() {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem('mmc_read_only_mode', 'true')
    emitRecoveryEvent('mmc:read-only-enter')
    return true
  } catch {
    return false
  }
}

export async function exitReadOnlyMode() {
  if (typeof window === 'undefined') return false
  try {
    localStorage.removeItem('mmc_read_only_mode')
    emitRecoveryEvent('mmc:read-only-exit')
    return true
  } catch {
    return false
  }
}

export async function i18nCacheRepair() {
  emitRecoveryEvent('mmc:i18n-repair')
  return true
}

export async function notificationDedupRepair() {
  emitRecoveryEvent('mmc:notification-dedup-repair')
  return true
}

export function isReadOnlyMode() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('mmc_read_only_mode') === 'true'
}

export function isFeatureDisabled() {
  return false
}