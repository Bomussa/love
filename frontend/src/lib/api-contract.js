const API_BASE = '/api/v1';

export const API_CONTRACT_ENDPOINTS = Object.freeze({
  qaDeepRun: `${API_BASE}/qa/deep_run`,
  healthz: `${API_BASE}/healthz`,
  login: `${API_BASE}/login`,
  queueEnter: `${API_BASE}/queue-enter`,
  queueCall: `${API_BASE}/queue-call`,
  queueStatus: `${API_BASE}/queue-status`,
  queueEngine: `${API_BASE}/queue-engine`,
  pinGenerate: `${API_BASE}/pin-generate`,
  pinVerify: `${API_BASE}/pin-verify`,
  pinStatus: `${API_BASE}/pin-status`,
  reportsDaily: `${API_BASE}/reports-daily`,
  statsDashboard: `${API_BASE}/stats-dashboard`,
  functionsProxy: `${API_BASE}/functions-proxy`,
  apiV1Status: `${API_BASE}/api-v1-status`,
});

export function getContractEndpoint(name) {
  const endpoint = API_CONTRACT_ENDPOINTS[name];
  if (!endpoint) {
    throw new Error(`Endpoint '${name}' is not defined in API contract`);
  }
  return endpoint;
}
