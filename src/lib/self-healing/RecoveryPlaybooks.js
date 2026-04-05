let readOnlyMode = false;

export async function softReloadOnce() { return true; }
export async function hardRefresh() { return true; }
export async function resetRealtimeSubscribe() { return true; }
export async function apiRetryWithBackoff(task) { return task?.(); }
export async function safeCacheClear() { return true; }
export async function enterReadOnlyMode() { readOnlyMode = true; return true; }
export async function exitReadOnlyMode() { readOnlyMode = false; return true; }
export async function i18nCacheRepair() { return true; }
export async function notificationDedupRepair() { return true; }
export function isReadOnlyMode() { return readOnlyMode; }
export function isFeatureDisabled() { return false; }
