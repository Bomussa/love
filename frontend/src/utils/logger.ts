/**
 * Browser-compatible logger utility
 * Removed fs/path dependencies for client-side use
 */

/**
 * Append audit log entry
 * In browser environment, logs are stored in localStorage
 */
export async function appendAudit(line: string) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const key = `audit_${date}`;
    
    // Get existing logs
    const existing = localStorage.getItem(key) || '';
    
    // Append new log
    const timestamp = new Date().toISOString();
    const newLog = `${timestamp} ${line}\n`;
    
    // Store in localStorage (with size limit)
    const combined = existing + newLog;
    const maxSize = 1024 * 100; // 100KB per day
    
    if (combined.length > maxSize) {
      // Keep only recent logs
      const lines = combined.split('\n').slice(-1000);
      localStorage.setItem(key, lines.join('\n'));
    } else {
      localStorage.setItem(key, combined);
    }
  } catch (error) {
    console.error('[Logger] Failed to append audit log:', error);
  }
}

/**
 * Console logger with prefix
 */
export const log = (...args: any[]) => console.log('[MMS]', ...args);

/**
 * Error logger
 */
export const logError = (...args: any[]) => console.error('[MMS Error]', ...args);

/**
 * Warning logger
 */
export const logWarn = (...args: any[]) => console.warn('[MMS Warn]', ...args);

/**
 * Debug logger
 */
export const logDebug = (...args: any[]) => console.debug('[MMS Debug]', ...args);

/**
 * Get audit logs for a specific date
 */
export function getAuditLogs(date?: string): string {
  try {
    const logDate = date || new Date().toISOString().slice(0, 10);
    const key = `audit_${logDate}`;
    return localStorage.getItem(key) || '';
  } catch (error) {
    console.error('[Logger] Failed to get audit logs:', error);
    return '';
  }
}

/**
 * Clear old audit logs (older than 30 days)
 */
export function clearOldAuditLogs() {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('audit_')) {
        const dateStr = key.replace('audit_', '');
        const date = new Date(dateStr).getTime();
        
        if (date < thirtyDaysAgo) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error('[Logger] Failed to clear old audit logs:', error);
  }
}
