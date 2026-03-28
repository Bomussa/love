/**
 * Centralized error handling system
 * Reduces code duplication and ensures consistent error handling
 */

// Error type constants
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTH_ERROR',
  AUTHORIZATION: 'AUTHZ_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Custom error class
 */
export class AppError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, details = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Parse error from various sources
 */
export function parseError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new AppError(
      error.message,
      ERROR_TYPES.VALIDATION,
      ERROR_SEVERITY.MEDIUM,
      { originalError: error }
    );
  }

  if (error instanceof SyntaxError) {
    return new AppError(
      'Invalid data format',
      ERROR_TYPES.VALIDATION,
      ERROR_SEVERITY.MEDIUM,
      { originalError: error }
    );
  }

  if (error?.response?.status === 401) {
    return new AppError(
      'Authentication required',
      ERROR_TYPES.AUTHENTICATION,
      ERROR_SEVERITY.HIGH,
      { status: 401, originalError: error }
    );
  }

  if (error?.response?.status === 403) {
    return new AppError(
      'Access denied',
      ERROR_TYPES.AUTHORIZATION,
      ERROR_SEVERITY.HIGH,
      { status: 403, originalError: error }
    );
  }

  if (error?.response?.status === 404) {
    return new AppError(
      'Resource not found',
      ERROR_TYPES.NOT_FOUND,
      ERROR_SEVERITY.LOW,
      { status: 404, originalError: error }
    );
  }

  if (error?.response?.status === 409) {
    return new AppError(
      'Conflict',
      ERROR_TYPES.CONFLICT,
      ERROR_SEVERITY.MEDIUM,
      { status: 409, originalError: error }
    );
  }

  if (error?.response?.status >= 500) {
    return new AppError(
      'Server error',
      ERROR_TYPES.SERVER,
      ERROR_SEVERITY.CRITICAL,
      { status: error.response.status, originalError: error }
    );
  }

  if (error?.name === 'AbortError') {
    return new AppError(
      'Request timeout',
      ERROR_TYPES.TIMEOUT,
      ERROR_SEVERITY.MEDIUM,
      { originalError: error }
    );
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      ERROR_TYPES.UNKNOWN,
      ERROR_SEVERITY.MEDIUM,
      { originalError: error }
    );
  }

  return new AppError(
    String(error),
    ERROR_TYPES.UNKNOWN,
    ERROR_SEVERITY.MEDIUM,
    { originalError: error }
  );
}

/**
 * Log error with context
 */
export function logError(error, context = {}) {
  const appError = parseError(error);

  const logEntry = {
    timestamp: appError.timestamp,
    type: appError.type,
    severity: appError.severity,
    message: appError.message,
    context,
    details: appError.details,
  };

  // Log to console based on severity
  if (appError.severity === ERROR_SEVERITY.CRITICAL) {
    console.error('[ERROR - CRITICAL]', logEntry);
  } else if (appError.severity === ERROR_SEVERITY.HIGH) {
    console.error('[ERROR - HIGH]', logEntry);
  } else if (appError.severity === ERROR_SEVERITY.MEDIUM) {
    console.warn('[ERROR - MEDIUM]', logEntry);
  } else {
    console.debug('[ERROR - LOW]', logEntry);
  }

  // Store in localStorage for audit
  try {
    const key = `error_log_${new Date().toISOString().slice(0, 10)}`;
    const existing = localStorage.getItem(key) || '';
    const newLog = JSON.stringify(logEntry) + '\n';
    localStorage.setItem(key, existing + newLog);
  } catch (e) {
    console.error('[ErrorHandler] Failed to store error log:', e);
  }

  return appError;
}

/**
 * Handle API error
 */
export function handleApiError(error, context = {}) {
  const appError = logError(error, { ...context, source: 'API' });
  return appError;
}

/**
 * Handle validation error
 */
export function handleValidationError(message, details = {}) {
  const error = new AppError(
    message,
    ERROR_TYPES.VALIDATION,
    ERROR_SEVERITY.LOW,
    details
  );
  logError(error, { source: 'VALIDATION' });
  return error;
}

/**
 * Handle authentication error
 */
export function handleAuthError(message = 'Authentication required', details = {}) {
  const error = new AppError(
    message,
    ERROR_TYPES.AUTHENTICATION,
    ERROR_SEVERITY.HIGH,
    details
  );
  logError(error, { source: 'AUTH' });
  return error;
}

/**
 * Create user-friendly error message
 */
export function getUserFriendlyMessage(error, language = 'en') {
  const appError = parseError(error);

  const messages = {
    en: {
      [ERROR_TYPES.NETWORK]: 'Network connection error. Please check your internet connection.',
      [ERROR_TYPES.VALIDATION]: 'Invalid input. Please check your data.',
      [ERROR_TYPES.AUTHENTICATION]: 'Please log in to continue.',
      [ERROR_TYPES.AUTHORIZATION]: 'You do not have permission to perform this action.',
      [ERROR_TYPES.NOT_FOUND]: 'The requested resource was not found.',
      [ERROR_TYPES.CONFLICT]: 'The operation conflicts with existing data.',
      [ERROR_TYPES.SERVER]: 'Server error. Please try again later.',
      [ERROR_TYPES.TIMEOUT]: 'Request timeout. Please try again.',
      [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred.',
    },
    ar: {
      [ERROR_TYPES.NETWORK]: 'خطأ في الاتصال بالشبكة. يرجى التحقق من الإنترنت.',
      [ERROR_TYPES.VALIDATION]: 'بيانات غير صحيحة. يرجى التحقق من المدخلات.',
      [ERROR_TYPES.AUTHENTICATION]: 'يرجى تسجيل الدخول للمتابعة.',
      [ERROR_TYPES.AUTHORIZATION]: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
      [ERROR_TYPES.NOT_FOUND]: 'المورد المطلوب غير موجود.',
      [ERROR_TYPES.CONFLICT]: 'العملية تتعارض مع البيانات الموجودة.',
      [ERROR_TYPES.SERVER]: 'خطأ في الخادم. يرجى المحاولة لاحقاً.',
      [ERROR_TYPES.TIMEOUT]: 'انتهت مهلة الطلب. يرجى المحاولة مجدداً.',
      [ERROR_TYPES.UNKNOWN]: 'حدث خطأ غير متوقع.',
    }
  };

  const msgMap = messages[language] || messages.en;
  return msgMap[appError.type] || msgMap[ERROR_TYPES.UNKNOWN];
}

/**
 * Retry handler with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`[ErrorHandler] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Safe async wrapper
 */
export async function safeAsync(fn, context = {}) {
  try {
    return await fn();
  } catch (error) {
    const appError = handleApiError(error, context);
    throw appError;
  }
}

/**
 * Clear old error logs (older than 7 days)
 */
export function clearOldErrorLogs() {
  try {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('error_log_')) {
        const dateStr = key.replace('error_log_', '');
        const date = new Date(dateStr).getTime();

        if (date < sevenDaysAgo) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error('[ErrorHandler] Failed to clear old error logs:', error);
  }
}

export default {
  ERROR_TYPES,
  ERROR_SEVERITY,
  AppError,
  parseError,
  logError,
  handleApiError,
  handleValidationError,
  handleAuthError,
  getUserFriendlyMessage,
  retryWithBackoff,
  safeAsync,
  clearOldErrorLogs,
};
