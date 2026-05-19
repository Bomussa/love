const SESSION_API_BASE = '/api/v1/session';

async function sessionRequest(path, payload) {
  const response = await fetch(`${SESSION_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Version': 'v1',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error || `HTTP_${response.status}`);
    error.response = { data, status: response.status };
    throw error;
  }

  return data;
}

export const sessionApiClient = {
  validateToken(token) {
    return sessionRequest('/validate', { token });
  },

  registerDevice(token, device) {
    return sessionRequest('/device', { token, device });
  },
};

export default sessionApiClient;
