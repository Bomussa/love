/**
 * Date Utilities for Asia/Qatar Timezone
 * Ensures consistency across the application
 */

export const QATAR_TIMEZONE = 'Asia/Qatar';

/**
 * Get current date in Qatar timezone
 * @returns {Date}
 */
export function getQatarDate() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: QATAR_TIMEZONE }));
}

/**
 * Get start of day (00:00:00.000) in Qatar timezone
 * @param {Date} date - Optional date to use
 * @returns {string} ISO string of start of day
 */
export function getQatarStartOfDay(date = getQatarDate()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  // Convert back to UTC for Supabase filtering but based on Qatar's 00:00
  const offset = 3; // Qatar is UTC+3
  const utcDate = new Date(d.getTime() - (offset * 60 * 60 * 1000));
  return utcDate.toISOString();
}

/**
 * Get end of day (23:59:59.999) in Qatar timezone
 * @param {Date} date - Optional date to use
 * @returns {string} ISO string of end of day
 */
export function getQatarEndOfDay(date = getQatarDate()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  
  const offset = 3; // Qatar is UTC+3
  const utcDate = new Date(d.getTime() - (offset * 60 * 60 * 1000));
  return utcDate.toISOString();
}

/**
 * Format date for display in Qatar timezone
 * @param {string|Date} date 
 * @returns {string}
 */
export function formatQatarTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('ar-QA', {
    timeZone: QATAR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
