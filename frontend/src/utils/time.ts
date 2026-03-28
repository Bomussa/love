/**
 * Time utility functions
 * Using built-in Date functions for browser compatibility
 */

// Default timezone (Asia/Qatar)
const DEFAULT_TZ = 'Asia/Qatar';
const SERVICE_DAY_PIVOT = '05:00'; // Service day starts at 5 AM

/**
 * Get current time in ISO format
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Format date as YYYY-MM-DD in local timezone
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get local date key for Asia/Qatar timezone
 * Adjusts for service day pivot (5 AM)
 */
export function localDateKeyAsiaQatar(d = new Date()): string {
  try {
    // Create a formatter for the timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(d);
    const dateObj: any = {};
    
    parts.forEach(part => {
      dateObj[part.type] = part.value;
    });

    const localDate = new Date(
      `${dateObj.year}-${dateObj.month}-${dateObj.day}T${dateObj.hour}:${dateObj.minute}:${dateObj.second}`
    );

    // Parse pivot time
    const [pivotHour, pivotMinute] = SERVICE_DAY_PIVOT.split(':').map(Number);
    const pivotTime = new Date(localDate);
    pivotTime.setHours(pivotHour, pivotMinute, 0, 0);

    // If current time is before pivot, use previous day
    if (localDate.getTime() < pivotTime.getTime()) {
      localDate.setDate(localDate.getDate() - 1);
    }

    return formatDate(localDate);
  } catch (error) {
    console.error('Error formatting date:', error);
    return formatDate(d);
  }
}

/**
 * Get current date key
 */
export function getCurrentDateKey(): string {
  return localDateKeyAsiaQatar();
}

/**
 * Format time as HH:MM
 */
export function formatTime(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get time difference in minutes
 */
export function getTimeDifferenceInMinutes(start: Date, end: Date = new Date()): number {
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60));
}

/**
 * Check if time is within working hours
 */
export function isWithinWorkingHours(
  time: Date = new Date(),
  startHour: number = 7,
  endHour: number = 15
): boolean {
  const hours = time.getHours();
  return hours >= startHour && hours < endHour;
}

/**
 * Add minutes to date
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Add hours to date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
