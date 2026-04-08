export async function softReloadOnce() {}
export async function hardRefresh() { window.location.reload(); }
export async function resetRealtimeSubscribe() {}
export async function apiRetryWithBackoff() {}
export async function safeCacheClear() {}
export async function enterReadOnlyMode() {}
export async function exitReadOnlyMode() {}
export async function i18nCacheRepair() {}
export async function notificationDedupRepair() {}
export function isReadOnlyMode() { return false; }
export function isFeatureDisabled() { return false; }
