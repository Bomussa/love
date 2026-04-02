const API_VERSION = 'v1';
const VERSION_HEADER = 'x-api-version';

const ALLOWED_ENDPOINTS = Object.freeze({
  create: '/api/v1/queue/create',
  call: '/api/v1/queue/call',
  start: '/api/v1/queue/start',
  advance: '/api/v1/queue/advance',
  done: '/api/v1/queue/done',
  update: '/api/v1/queue/update',
  status: '/api/v1/queue/status',
  clinics: '/api/v1/clinics',
  verifyPin: '/api/v1/verify-pin',
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

  // Queue operations - no PIN required
  createQueue(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.create, payload);
  },

  callNextPatient(clinicId) {
    // Call next patient in queue - no PIN
    return callQueueEndpoint(ALLOWED_ENDPOINTS.call, { clinic_id: clinicId });
  },

  startQueue(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.start, payload);
  },

  advanceQueue(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.advance, payload);
  },

  queueDone(clinicId, patientId) {
    // Mark patient as done - no PIN
    return callQueueEndpoint(ALLOWED_ENDPOINTS.done, {
      clinic_id: clinicId,
      patient_id: patientId
    });
  },

  updateQueueStatus(clinicId, patientId, status) {
    // Update patient status (no_show, postpone, etc.) - no PIN
    return callQueueEndpoint(ALLOWED_ENDPOINTS.update, {
      clinic_id: clinicId,
      patient_id: patientId,
      status: status
    });
  },

  getQueueStatus(payload) {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.status, payload);
  },

  // Clinic operations - no PIN required
  getClinics() {
    return callQueueEndpoint(ALLOWED_ENDPOINTS.clinics, {});
  },

  verifyPin(clinicId, pin) {
    // Verify PIN for clinic - still accepts PIN but returns success for any value
    return callQueueEndpoint(ALLOWED_ENDPOINTS.verifyPin, {
      clinic_id: clinicId,
      pin: pin || '00'
    });
  },
};

export { API_VERSION, ApiVersionMismatchError };
export default api;
