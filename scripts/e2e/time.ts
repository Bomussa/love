/**
 * Time utilities for E2E tests
 * Helpers to parse and validate server timestamps
 */

/**
 * Parse a server timestamp string (ISO 8601 or common formats)
 * @param timestamp - Timestamp string from server
 * @returns Date object or null if invalid
 */
export function parseServerTimestamp(timestamp: string | undefined | null): Date | null {
  if (!timestamp) return null;

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Check if a server timestamp falls within a time window
 * @param timestamp - Server timestamp to check
 * @param windowStart - Start of the window
 * @param windowEnd - End of the window
 * @param toleranceMs - Additional tolerance in milliseconds (default 2 minutes)
 * @returns true if timestamp is within window (with tolerance)
 */
export function isTimestampInWindow(
  timestamp: string | Date,
  windowStart: Date,
  windowEnd: Date,
  toleranceMs: number = 2 * 60 * 1000 // 2 minutes default
): boolean {
  const ts = typeof timestamp === 'string' ? parseServerTimestamp(timestamp) : timestamp;
  if (!ts) return false;

  const startWithTolerance = new Date(windowStart.getTime() - toleranceMs);
  const endWithTolerance = new Date(windowEnd.getTime() + toleranceMs);

  return ts >= startWithTolerance && ts <= endWithTolerance;
}

/**
 * Assert that entry and exit timestamps are valid and in correct order
 * @param entryTime - Entry timestamp
 * @param exitTime - Exit timestamp
 * @param testStart - When the test started
 * @param testEnd - When the test ended (defaults to now)
 * @param options - Validation options
 * @returns Validation result with details
 */
export interface TimestampValidationOptions {
  toleranceMs?: number;
  allowMissingExit?: boolean;
}

export interface TimestampValidationResult {
  valid: boolean;
  errors: string[];
  entryDate: Date | null;
  exitDate: Date | null;
}

export function validateEntryExitTimestamps(
  entryTime: string | undefined | null,
  exitTime: string | undefined | null,
  testStart: Date,
  testEnd: Date = new Date(),
  options: TimestampValidationOptions = {}
): TimestampValidationResult {
  const { toleranceMs = 2 * 60 * 1000, allowMissingExit = false } = options;
  const errors: string[] = [];

  // Parse timestamps
  const entryDate = parseServerTimestamp(entryTime);
  const exitDate = parseServerTimestamp(exitTime);

  // Check entry timestamp
  if (!entryDate) {
    errors.push('Entry timestamp is missing or invalid');
  } else if (!isTimestampInWindow(entryDate, testStart, testEnd, toleranceMs)) {
    errors.push(
      `Entry timestamp ${entryDate.toISOString()} is outside test window ` +
      `[${testStart.toISOString()} - ${testEnd.toISOString()}] with ${toleranceMs}ms tolerance`
    );
  }

  // Check exit timestamp
  if (!exitDate) {
    if (!allowMissingExit) {
      errors.push('Exit timestamp is missing or invalid');
    }
  } else {
    if (!isTimestampInWindow(exitDate, testStart, testEnd, toleranceMs)) {
      errors.push(
        `Exit timestamp ${exitDate.toISOString()} is outside test window ` +
        `[${testStart.toISOString()} - ${testEnd.toISOString()}] with ${toleranceMs}ms tolerance`
      );
    }

    // Check that exit is after entry
    if (entryDate && exitDate < entryDate) {
      errors.push(
        `Exit timestamp ${exitDate.toISOString()} is before entry timestamp ${entryDate.toISOString()}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    entryDate,
    exitDate,
  };
}

/**
 * Calculate duration between two timestamps in milliseconds
 * @param start - Start timestamp
 * @param end - End timestamp
 * @returns Duration in milliseconds or null if invalid
 */
export function calculateDuration(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number | null {
  const startDate = typeof start === 'string' ? parseServerTimestamp(start) : start;
  const endDate = typeof end === 'string' ? parseServerTimestamp(end) : end;

  if (!startDate || !endDate) return null;

  return endDate.getTime() - startDate.getTime();
}

/**
 * Format duration for human-readable output
 * @param durationMs - Duration in milliseconds
 * @returns Formatted string (e.g., "2m 30s")
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 0) return 'invalid';

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get current timestamp in ISO format for logging
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
