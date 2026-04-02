const API_VERSION = 'v1';
const VERSION_HEADER = 'x-api-version';

const ALLOWED_ENDPOINTS = Object.freeze({
  create: '/api/v1/queue/create',
  start: '/api/v1/queue/start',
  advance: '/api/v1/queue/advance',
  status: '/api/v1/queue/status',
});

class ApiVersionMismatchError extends Error {
  constructor(expected, received) {
    super(`API version mismatch. expected=${expected}, received=${received || 'missing'}`);
    this.name = 'ApiVersionMismatchError';
    this.expected = expected;
    this.received = received || null;
  }
}

let versionBlocked = false;

async function callQueueEndpoint(url, payload = {}) {
  if (versionBlocked) {
    throw new ApiVersionMismatchError(API_VERSION, 'blocked');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Version': API_VERSION,
    },
    body: JSON.stringify(payload),
  });

  const serverVersion = response.headers.get(VERSION_HEADER);
  if (serverVersion && serverVersion !== API_VERSION) {
    versionBlocked = true;
    throw new ApiVersionMismatchError(API_VERSION, serverVersion);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      error: data?.error || data?.message || `HTTP ${response.status}`,
      status: response.status,
    };
  }

  return {
    success: true,
    ...data,
  };
}

const api = {
  endpoints: ALLOWED_ENDPOINTS,
  isVersionBlocked: () => versionBlocked,

  createQueue(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.create, payload);
  },

  startQueue(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.start, payload);
  },

  advanceQueue(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.advance, payload);
  },

  getQueueStatus(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.status, payload);
  },
};

export { API_VERSION, ApiVersionMismatchError };
export default api;
