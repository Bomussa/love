const logs = [];

export function generateCorrelationId() {
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDeviceFingerprint() {
  if (typeof navigator === 'undefined') return 'server';
  return `${navigator.userAgent || 'unknown'}::${navigator.language || 'n/a'}`;
}

export function logRepair(entry) {
  logs.push({ ...entry, correlationId: entry.correlationId || generateCorrelationId(), at: new Date().toISOString() });
}

export const getLocalRepairLogs = () => [...logs];
export const getFilteredLogs = (predicate = () => true) => logs.filter(predicate);
export const clearLocalRepairLogs = () => { logs.length = 0; };
export const exportLogsAsCSV = () => logs.map((l) => JSON.stringify(l)).join('\n');
export const exportLogsAsJSON = () => JSON.stringify(logs, null, 2);
export const getRepairStatistics = () => ({ total: logs.length });
export const downloadLogs = () => exportLogsAsJSON();
