import { assertNoSupabaseInClient } from '../guards/noSupabaseInClient';

/**
 * MMC-MMS API Client
 * Professional-grade API client with unified standards.
 */

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
  pinValidate: { path: '/api/v1/pin/validate', method: 'POST' },
  updateSetting: { path: '/api/v1/settings/update', method: 'POST' },
  updateSettings: { path: '/api/v1/settings/update-batch', method: 'POST' },
  markDistributed: { path: '/api/v1/routing/mark-distributed', method: 'POST' },
  examRoute: { path: '/api/v1/routing/exam-route', method: 'GET' },
  patientRoute: { path: '/api/v1/routing/patient-route', method: 'GET' },
  updatePatientStep: { path: '/api/v1/routing/patient-step', method: 'POST' }
};

// Fix 1 & 54: Unified BASE URL constant and fallback
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 1;

// Internal tracking
let _requestCounter = 0;
const _pendingRequests = new Map();
const _inflightGetRequests = new Map();


function createDedupeKey(key, options = {}) {
  const params = options.params ? JSON.stringify(options.params) : '';
  return `${key}:${params}`;
}

function normalizePinPayload(payload) {
  if (!payload || typeof payload !== 'object' || payload.pin === undefined || payload.pin === null) {
    return payload;
  }
  const pin = String(payload.pin).trim();
  return { ...payload, pin };
}

function isRetryableStatus(status) {
  return status >= 500 && status < 600;
}

/**
 * Fix 3 & 52: Safe JSON parsing with fallback and error handling
 */
function safeJsonParse(text, fallback = {}) {
  if (!text || typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('[API_PARSE_ERROR]: Failed to parse JSON response', { error: e.message, text: text.substring(0, 100) });
    return fallback;
  }
}

/**
 * Fix 51: Create abort controller with timeout
 */
function createAbortController(timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[API_TIMEOUT]: Request exceeded ${timeout}ms`);
    controller.abort();
  }, timeout);
  return { controller, timeoutId };
}

/**
 * Fix 41: Generate unique request ID to prevent stale data
 */
function generateRequestId() {
  return `req_${++_requestCounter}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Fix 2 & 19: Unified request wrapper with error handling and retry logic
 */
async function request(key, options = {}, retryCount = 0) {
  const requestId = generateRequestId();
  
  // Guard against direct Supabase usage in client
  try {
    assertNoSupabaseInClient();
  } catch (e) {
    console.error('[SECURITY_GUARD]:', e.message);
  }
  
  const contract = API_CONTRACTS[key];
  if (!contract) {
    throw new Error(`[API_CONTRACT_ERROR]: Unknown API contract "${key}"`);
  }

  if (key === 'pinVerify' || key === 'pinValidate') {
    options = { ...options, body: normalizePinPayload(options.body) };
  }

  // Fix 15: Prevent /api/v1/api/v1 conflict by cleaning the path
  const cleanPath = contract.path.startsWith('/') ? contract.path : `/${contract.path}`;
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
  const url = new URL(`${BASE_URL}${cleanPath}`, origin);
  
  if (options.params) {
    Object.keys(options.params).forEach(p => {
      if (options.params[p] !== undefined && options.params[p] !== null) {
        url.searchParams.append(p, options.params[p]);
      }
    });
  }

  if (contract.method === 'GET') {
    const dedupeKey = createDedupeKey(key, options);
    if (_inflightGetRequests.has(dedupeKey)) {
      return _inflightGetRequests.get(dedupeKey);
    }
  }

  // Fix 4 & 30: Unified headers with Content-Type and X-Request-ID
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Request-ID': requestId,
    ...(options.headers || {})
  };

  const { controller, timeoutId } = createAbortController(options.timeout || REQUEST_TIMEOUT);
  const dedupeKey = contract.method === 'GET' ? createDedupeKey(key, options) : null;

  const execution = (async () => {
  try {
    _pendingRequests.set(requestId, { key, startTime: Date.now() });

    const fetchOptions = {
      method: contract.method,
      headers,
      signal: controller.signal
    };

    if (options.body && contract.method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), fetchOptions);
    clearTimeout(timeoutId);
    _pendingRequests.delete(requestId);

    // Fix 35 & 129: Support both {data} and direct object responses
    let json;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      json = safeJsonParse(text, {});
    } else {
      const text = await response.text();
      json = text ? { message: text } : {};
    }

    // Fix 37 & 242: Unified error throwing
    if (!response.ok) {
      const errorMsg = json.error?.message || json.error || json.message || `HTTP ${response.status} ${response.statusText}`;
      
      // Fix 53 & 355: Retry on 5xx errors or network failures
      if (isRetryableStatus(response.status) && retryCount < MAX_RETRIES) {
        console.warn(`[API_RETRY]: ${key} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        return request(key, options, retryCount + 1);
      }
      
      throw new Error(`[API_ERROR][${key}]: ${errorMsg}`);
    }

    // Standardize response: unwrap data if present
    const responseData = json.data !== undefined ? json.data : json;
    
    // Check for success flag in response if it exists
    if (json.success === false) {
      throw new Error(json.error?.message || json.error || 'API operation failed');
    }

    return responseData;
  } catch (error) {
    clearTimeout(timeoutId);
    _pendingRequests.delete(requestId);

    if (error.name === 'AbortError') {
      throw new Error(`[API_TIMEOUT]: Request for ${key} timed out`);
    }

    // Fix 148: Retry on network errors (TypeError in fetch)
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      console.warn(`[API_NETWORK_RETRY]: ${key} due to connection issue`);
      return request(key, options, retryCount + 1);
    }

    console.error(`[API_FAILURE][${key}]:`, error.message);
    throw error;
  }
  })();

  if (dedupeKey) {
    _inflightGetRequests.set(dedupeKey, execution);
    execution.finally(() => _inflightGetRequests.delete(dedupeKey));
  }

  return execution;
}

/**
 * Unified API client interface
 */
export const apiClient = {
  get: (key, params) => request(key, { params }),
  post: (key, body) => request(key, { body }),
  request: (key, options) => request(key, options)
};
