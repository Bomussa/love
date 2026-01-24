/**
 * Error Handler Module
 * وحدة معالجة الأخطاء المركزية
 * 
 * @module error-handler
 * @description معالجة موحدة للأخطاء مع رسائل مفهومة للمستخدم
 */

// ============================================================================
// Error Types - أنواع الأخطاء
// ============================================================================

export const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER: 'SERVER_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

// ============================================================================
// Error Messages - رسائل الأخطاء
// ============================================================================

const errorMessages = {
  ar: {
    [ErrorTypes.NETWORK]: 'خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت.',
    [ErrorTypes.AUTH]: 'خطأ في المصادقة. يرجى تسجيل الدخول مرة أخرى.',
    [ErrorTypes.VALIDATION]: 'البيانات المدخلة غير صحيحة. يرجى التحقق والمحاولة مرة أخرى.',
    [ErrorTypes.NOT_FOUND]: 'المورد المطلوب غير موجود.',
    [ErrorTypes.SERVER]: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
    [ErrorTypes.TIMEOUT]: 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.',
    [ErrorTypes.UNKNOWN]: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.'
  },
  en: {
    [ErrorTypes.NETWORK]: 'Network connection error. Please check your internet connection.',
    [ErrorTypes.AUTH]: 'Authentication error. Please login again.',
    [ErrorTypes.VALIDATION]: 'Invalid input data. Please check and try again.',
    [ErrorTypes.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorTypes.SERVER]: 'Server error occurred. Please try again later.',
    [ErrorTypes.TIMEOUT]: 'Request timed out. Please try again.',
    [ErrorTypes.UNKNOWN]: 'An unexpected error occurred. Please try again later.'
  }
};

// ============================================================================
// Error Classification - تصنيف الأخطاء
// ============================================================================

/**
 * تصنيف الخطأ بناءً على نوعه
 * @param {Error} error - الخطأ
 * @returns {string} نوع الخطأ
 */
export function classifyError(error) {
  if (!error) return ErrorTypes.UNKNOWN;
  
  // أخطاء الشبكة
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return ErrorTypes.NETWORK;
  }
  
  if (error.message?.toLowerCase().includes('network')) {
    return ErrorTypes.NETWORK;
  }
  
  // أخطاء المصادقة
  if (error.status === 401 || error.status === 403) {
    return ErrorTypes.AUTH;
  }
  
  if (error.message?.toLowerCase().includes('unauthorized') || 
      error.message?.toLowerCase().includes('forbidden')) {
    return ErrorTypes.AUTH;
  }
  
  // أخطاء التحقق
  if (error.status === 400 || error.status === 422) {
    return ErrorTypes.VALIDATION;
  }
  
  // غير موجود
  if (error.status === 404) {
    return ErrorTypes.NOT_FOUND;
  }
  
  // أخطاء الخادم
  if (error.status >= 500) {
    return ErrorTypes.SERVER;
  }
  
  // انتهاء المهلة
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return ErrorTypes.TIMEOUT;
  }
  
  return ErrorTypes.UNKNOWN;
}

// ============================================================================
// Error Handling - معالجة الأخطاء
// ============================================================================

/**
 * الحصول على رسالة خطأ مفهومة للمستخدم
 * @param {Error} error - الخطأ
 * @param {string} language - اللغة ('ar' | 'en')
 * @returns {string} رسالة الخطأ
 */
export function getUserFriendlyMessage(error, language = 'ar') {
  const errorType = classifyError(error);
  const messages = errorMessages[language] || errorMessages.ar;
  
  return messages[errorType] || messages[ErrorTypes.UNKNOWN];
}

/**
 * معالجة الخطأ وإرجاع كائن موحد
 * @param {Error} error - الخطأ
 * @param {string} language - اللغة
 * @returns {Object} كائن الخطأ الموحد
 */
export function handleError(error, language = 'ar') {
  const errorType = classifyError(error);
  const message = getUserFriendlyMessage(error, language);
  
  // تسجيل الخطأ للتتبع (في الإنتاج يمكن إرساله لخدمة مراقبة)
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorHandler]', {
      type: errorType,
      originalError: error,
      message: error.message,
      stack: error.stack
    });
  }
  
  return {
    success: false,
    error: {
      type: errorType,
      message: message,
      originalMessage: error.message,
      timestamp: new Date().toISOString()
    }
  };
}

// ============================================================================
// API Error Handler - معالج أخطاء API
// ============================================================================

/**
 * معالج أخطاء API مع إعادة المحاولة
 * @param {Function} apiCall - دالة API
 * @param {Object} options - خيارات
 * @returns {Promise} نتيجة API
 */
export async function withErrorHandling(apiCall, options = {}) {
  const {
    retries = 2,
    retryDelay = 1000,
    language = 'ar',
    onError = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // لا نعيد المحاولة لأخطاء المصادقة أو التحقق
      const errorType = classifyError(error);
      if (errorType === ErrorTypes.AUTH || errorType === ErrorTypes.VALIDATION) {
        break;
      }
      
      // انتظار قبل إعادة المحاولة
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }
  
  const result = handleError(lastError, language);
  
  if (onError) {
    onError(result.error);
  }
  
  return result;
}

// ============================================================================
// React Error Boundary Helper - مساعد Error Boundary
// ============================================================================

/**
 * إنشاء رسالة خطأ لـ Error Boundary
 * @param {Error} error - الخطأ
 * @param {Object} errorInfo - معلومات الخطأ من React
 * @param {string} language - اللغة
 * @returns {Object} معلومات الخطأ للعرض
 */
export function createErrorBoundaryInfo(error, errorInfo, language = 'ar') {
  const errorType = classifyError(error);
  const message = getUserFriendlyMessage(error, language);
  
  return {
    type: errorType,
    message: message,
    componentStack: errorInfo?.componentStack,
    canRetry: errorType !== ErrorTypes.AUTH,
    suggestions: getSuggestions(errorType, language)
  };
}

/**
 * الحصول على اقتراحات لحل الخطأ
 * @param {string} errorType - نوع الخطأ
 * @param {string} language - اللغة
 * @returns {string[]} قائمة الاقتراحات
 */
function getSuggestions(errorType, language) {
  const suggestions = {
    ar: {
      [ErrorTypes.NETWORK]: [
        'تحقق من اتصالك بالإنترنت',
        'حاول تحديث الصفحة',
        'انتظر قليلاً ثم حاول مرة أخرى'
      ],
      [ErrorTypes.AUTH]: [
        'قم بتسجيل الدخول مرة أخرى',
        'تأكد من صحة بيانات الدخول'
      ],
      [ErrorTypes.VALIDATION]: [
        'تحقق من البيانات المدخلة',
        'تأكد من ملء جميع الحقول المطلوبة'
      ],
      [ErrorTypes.SERVER]: [
        'حاول مرة أخرى بعد قليل',
        'إذا استمرت المشكلة، تواصل مع الدعم الفني'
      ],
      [ErrorTypes.TIMEOUT]: [
        'تحقق من سرعة الإنترنت',
        'حاول مرة أخرى'
      ]
    },
    en: {
      [ErrorTypes.NETWORK]: [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again'
      ],
      [ErrorTypes.AUTH]: [
        'Please login again',
        'Verify your credentials'
      ],
      [ErrorTypes.VALIDATION]: [
        'Check your input data',
        'Make sure all required fields are filled'
      ],
      [ErrorTypes.SERVER]: [
        'Try again in a few moments',
        'Contact support if the problem persists'
      ],
      [ErrorTypes.TIMEOUT]: [
        'Check your internet speed',
        'Try again'
      ]
    }
  };
  
  const langSuggestions = suggestions[language] || suggestions.ar;
  return langSuggestions[errorType] || [];
}

export default {
  ErrorTypes,
  classifyError,
  getUserFriendlyMessage,
  handleError,
  withErrorHandling,
  createErrorBoundaryInfo
};
