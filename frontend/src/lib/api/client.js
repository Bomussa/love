import { assertNoSupabaseInClient } from '../guards/noSupabaseInClient';

// Unified API contracts
export const API_CONTRACTS = {
  clinics: { path: '/api/v1/clinics', method: 'GET' },
  queues: { path: '/api/v1/queues', method: 'GET' },
  settings: { path: '/api/v1/settings', method: 'GET' },
  patientLogin: { path: '/api/v1/patient/login', method: 'POST' },
  pinVerify: { path: '/api/v1/pin/verify', method: 'POST' },
  queueEnter: { path: '/api/v1/queue/enter', method: 'POST' },
  queueStatus: { path: '/api/v1/queue/status', method: 'GET' },
  pinStatus: { path: '/api/v1/pin/status', method: 'GET' },
  pinGenerate: { path: '/api/v1/pin/generate', method: 'POST' },
  // Fix 31: Add explicit pin validate contract
  pinValidate: { path: '/api/v1/pin/validate', method: 'POST' }
};

// Unified BASE URL constant
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 1;

// Track pending requests to prevent stale data
let _requestCounter = 0;
const _pendingRequests = new Map();

/**
 * Safe JSON parsing with fallback
 */
function safeJsonParse(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('JSON parse error:', e, 'text:', text);
    return fallback;
  }
}

/**
 * Create abort controller with timeout
 */
function createAbortController(timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return { controller, timeoutId };
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${++_requestCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Unified request wrapper with retry logic
 */
async function request(key, options = {}, retryCount = 0) {
  const requestId = generateRequestId();
  assertNoSupabaseInClient();
  
  const contract = API_CONTRACTS[key];
  if (!contract) {
    throw new Error(`Unknown API contract: ${key}`);
  }

  const url = new URL(`${BASE_URL}${contract.path}`, window.location.origin);
  
  // Add query parameters
  if (options.params) {
    Object.keys(options.params).forEach(p => {
      url.searchParams.append(p, options.params[p]);
    });
  }

  // Unified headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  // Create abort controller with timeout
  const { controller, timeoutId } = createAbortController();

  try {
    // Track this request
    _pendingRequests.set(requestId, { key, startTime: Date.now() });

    const response = await fetch(url.toString(), {
      method: contract.method,
      headers: {
        ...headers,
        'X-Request-ID': requestId
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    _pendingRequests.delete(requestId);

    // Safe JSON parsing
    let json;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      json = safeJsonParse(text, {});
    } else {
      json = {};
    }

    // Handle non-success responses
    if (!response.ok) {
      const error = json.error?.message || json.error || `HTTP ${response.status}`;
      console.error(`API Error [${key}]:`, error);
      
      // Retry on network errors (5xx)
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        console.warn(`Retrying ${key} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        return request(key, options, retryCount + 1);
      }
      
      throw new Error(`[API_ERROR][${key}] ${error}`);
    }

    // Support both {data: ...} and direct object responses
    const responseData = json.data !== undefined ? json.data : json;
    
    if (!json.success && json.success !== undefined) {
      throw new Error(json.error?.message || json.error || 'API Request Failed');
    }

    return responseData;
  } catch (error) {
    clearTimeout(timeoutId);
    _pendingRequests.delete(requestId);

    // Handle abort/timeout
    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${key}`);
      throw new Error(`Request timeout: ${key}`);
    }

    // Retry on network errors
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      console.warn(`Retrying ${key} due to network error (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      return request(key, options, retryCount + 1);
    }

    console.error(`Request failed for ${key}:`, error.message);
    throw error;
  }
}

/**
 * Unified API client with get/post methods
 */
export const apiClient = {
  get: (key, params) => request(key, { params }),
  post: (key, body) => request(key, { body }),
  request: (key, options) => request(key, options)
};
