let readOnlyMode = false;

export const softReloadOnce = async () => true;
export const hardRefresh = async () => true;
export const resetRealtimeSubscribe = async () => true;
export const apiRetryWithBackoff = async (fn) => fn();
export const safeCacheClear = async () => true;
export const i18nCacheRepair = async () => true;
export const notificationDedupRepair = async () => true;

export async function enterReadOnlyMode() {
  readOnlyMode = true;
  return true;
}

export async function exitReadOnlyMode() {
  readOnlyMode = false;
  return true;
}

export const isReadOnlyMode = () => readOnlyMode;
export const isFeatureDisabled = () => false;
