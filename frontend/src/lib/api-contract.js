const FUNCTIONS_BASE = '/functions/v1';

export const API_CONTRACT_ENDPOINTS = Object.freeze({
  healthz: `${FUNCTIONS_BASE}/healthz`,
  login: `${FUNCTIONS_BASE}/login`,
  queueEnter: `${FUNCTIONS_BASE}/queue-enter`,
  queueCall: `${FUNCTIONS_BASE}/queue-call`,
  queueStatus: `${FUNCTIONS_BASE}/queue-status`,
  queueEngine: `${FUNCTIONS_BASE}/queue-engine`,
  pinGenerate: `${FUNCTIONS_BASE}/pin-generate`,
  pinVerify: `${FUNCTIONS_BASE}/pin-verify`,
  pinStatus: `${FUNCTIONS_BASE}/pin-status`,
  reportsDaily: `${FUNCTIONS_BASE}/reports-daily`,
  statsDashboard: `${FUNCTIONS_BASE}/stats-dashboard`,
  functionsProxy: `${FUNCTIONS_BASE}/functions-proxy`,
  apiV1Status: `${FUNCTIONS_BASE}/api-v1-status`,
});

export function getContractEndpoint(name) {
  const endpoint = API_CONTRACT_ENDPOINTS[name];
  if (!endpoint) {
    throw new Error(`Endpoint '${name}' is not defined in API contract`);
  }
  return endpoint;
}
