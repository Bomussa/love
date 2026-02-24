/**
 * MMC Self-Healing System - Repair Log
 * Logging service for self-healing actions
 * Integrates with existing activityLogger.js
 */

import { logActivity } from '../activityLogger';
import {
  REPAIR_LOG_CONFIG,
  SEVERITY,
  STATUS,
} from './constants';

/**
 * Generate unique correlation ID for tracing
 */
export function generateCorrelationId() {
  return `sh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get device fingerprint for logging
 */
export function getDeviceFingerprint() {
  return localStorage.getItem('mmc_device_id') || 'unknown';
}

/**
 * Log a self-healing action
 * @param {Object} params - Log parameters
 * @returns {Object} Log entry
 */
export function logRepair({
  action,
  module,
  severity = SEVERITY.INFO,
  errorSignature = null,
  actionTaken = null,
  attemptsCount = 1,
  mode = STATUS.OK,
  correlationId = null,
  result = 'success',
  details = {},
  error = null,
}) {
  const id = generateCorrelationId();
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    id,
    type: REPAIR_LOG_CONFIG.activityType,
    timestamp,
    action,
    module,
    severity,
    errorSignature,
    actionTaken: actionTaken || action,
    attemptsCount,
    mode,
    correlationId: correlationId || id,
    result,
    details: JSON.stringify(details),
    error: error ? error.message || String(error) : null,
    deviceId: getDeviceFingerprint(),
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
  };

  // Log to console for debugging
  const consoleMethod = severity === SEVERITY.ERROR ? 'error' : 
                        severity === SEVERITY.WARNING ? 'warn' : 'log';
  console[consoleMethod](`[SelfHealing] ${action}:`, logEntry);

  // Log to activity logger (existing system)
  try {
    logActivity(REPAIR_LOG_CONFIG.activityType, {
      action,
      module,
      severity,
      errorSignature,
      actionTaken,
      attemptsCount,
      mode,
      correlationId: logEntry.correlationId,
      result,
      details: logEntry.details,
      notes: `Self-healing: ${action} - ${result}`,
    });
  } catch (e) {
    // If activity logger fails, at least we have console log
    console.error('[SelfHealing] Failed to log to activity logger:', e);
  }

  // Store in localStorage for quick access in admin UI
  try {
    const logs = getLocalRepairLogs();
    logs.unshift(logEntry);
    
    // Keep only recent logs
    while (logs.length > REPAIR_LOG_CONFIG.maxLocalLogs) {
      logs.pop();
    }
    
    localStorage.setItem('mmc_self_healing_logs', JSON.stringify(logs));
  } catch (e) {
    // Storage might be full
    console.warn('[SelfHealing] Failed to store log locally:', e);
  }

  return logEntry;
}

/**
 * Get all repair logs from localStorage
 * @returns {Array} Array of log entries
 */
export function getLocalRepairLogs() {
  try {
    const logs = localStorage.getItem('mmc_self_healing_logs');
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error('[SelfHealing] Failed to get local logs:', e);
    return [];
  }
}

/**
 * Get filtered repair logs
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered logs
 */
export function getFilteredLogs(filters = {}) {
  let logs = getLocalRepairLogs();
  
  if (filters.severity) {
    logs = logs.filter(log => log.severity === filters.severity);
  }
  
  if (filters.module) {
    logs = logs.filter(log => log.module === filters.module);
  }
  
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  
  if (filters.mode) {
    logs = logs.filter(log => log.mode === filters.mode);
  }
  
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    logs = logs.filter(log => new Date(log.timestamp) >= start);
  }
  
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    logs = logs.filter(log => new Date(log.timestamp) <= end);
  }
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    logs = logs.filter(log => 
      log.action.toLowerCase().includes(search) ||
      log.module.toLowerCase().includes(search) ||
      (log.errorSignature && log.errorSignature.toLowerCase().includes(search))
    );
  }
  
  return logs;
}

/**
 * Clear all local repair logs
 */
export function clearLocalRepairLogs() {
  localStorage.removeItem('mmc_self_healing_logs');
  logRepair({
    action: 'clearLogs',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
  });
}

/**
 * Export logs as CSV
 * @param {Array} logs - Logs to export (optional, defaults to all)
 * @returns {string} CSV content
 */
export function exportLogsAsCSV(logs = null) {
  const data = logs || getLocalRepairLogs();
  
  if (data.length === 0) {
    return '';
  }
  
  const columns = [
    'timestamp',
    'action',
    'module',
    'severity',
    'errorSignature',
    'actionTaken',
    'attemptsCount',
    'mode',
    'result',
    'correlationId',
    'deviceId',
    'url',
  ];
  
  const headers = {
    timestamp: 'التاريخ والوقت',
    action: 'الإجراء',
    module: 'الوحدة',
    severity: 'الخطورة',
    errorSignature: 'نوع الخطأ',
    actionTaken: 'الإجراء المتخذ',
    attemptsCount: 'عدد المحاولات',
    mode: 'الوضع',
    result: 'النتيجة',
    correlationId: 'معرف التتبع',
    deviceId: 'رقم الجهاز',
    url: 'الرابط',
  };
  
  // Header row
  const headerRow = columns.map(col => headers[col] || col).join(',');
  
  // Data rows
  const rows = data.map(log => 
    columns.map(col => {
      let value = log[col];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [headerRow, ...rows].join('\n');
}

/**
 * Export logs as JSON
 * @param {Array} logs - Logs to export (optional, defaults to all)
 * @returns {string} JSON content
 */
export function exportLogsAsJSON(logs = null) {
  const data = logs || getLocalRepairLogs();
  return JSON.stringify(data, null, 2);
}

/**
 * Get repair statistics
 * @param {Object} filters - Filter criteria
 * @returns {Object} Statistics
 */
export function getRepairStatistics(filters = {}) {
  const logs = getFilteredLogs(filters);
  
  const stats = {
    total: logs.length,
    bySeverity: {},
    byModule: {},
    byAction: {},
    byMode: {},
    byResult: {},
    successRate: 0,
    averageAttempts: 0,
  };
  
  let totalAttempts = 0;
  let successCount = 0;
  
  logs.forEach(log => {
    // Count by severity
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    
    // Count by module
    stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1;
    
    // Count by action
    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    
    // Count by mode
    stats.byMode[log.mode] = (stats.byMode[log.mode] || 0) + 1;
    
    // Count by result
    stats.byResult[log.result] = (stats.byResult[log.result] || 0) + 1;
    
    // Sum attempts
    totalAttempts += log.attemptsCount || 1;
    
    // Count successes
    if (log.result === 'success') {
      successCount++;
    }
  });
  
  // Calculate rates
  stats.successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 0;
  stats.averageAttempts = logs.length > 0 ? totalAttempts / logs.length : 0;
  
  return stats;
}

/**
 * Download logs as file
 * @param {string} format - 'csv' or 'json'
 * @param {Array} logs - Logs to download
 */
export function downloadLogs(format = 'csv', logs = null) {
  const data = logs || getLocalRepairLogs();
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `mmc-self-healing-logs-${timestamp}.${format}`;
  
  let content;
  let mimeType;
  
  if (format === 'csv') {
    content = exportLogsAsCSV(data);
    mimeType = 'text/csv;charset=utf-8;';
  } else {
    content = exportLogsAsJSON(data);
    mimeType = 'application/json';
  }
  
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logRepair({
    action: 'downloadLogs',
    module: 'system',
    severity: SEVERITY.INFO,
    result: 'success',
    details: { format, count: data.length, filename },
  });
}

export default {
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
};
