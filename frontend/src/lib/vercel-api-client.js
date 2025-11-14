/**
 * Vercel API Client
 * This file provides a generic client for the Vercel API endpoints.
 */

const API_BASE_URL = '/api/v1';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `API request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return { success: false, error: error.message, data: null };
  }
}

const vercelApi = {
  get: (endpoint, options = {}) => {
    return fetchAPI(endpoint, { ...options, method: 'GET' });
  },
  post: (endpoint, body, options = {}) => {
    return fetchAPI(endpoint, { ...options, method: 'POST', body });
  },
  put: (endpoint, body, options = {}) => {
    return fetchAPI(endpoint, { ...options, method: 'PUT', body });
  },
  delete: (endpoint, options = {}) => {
    return fetchAPI(endpoint, { ...options, method: 'DELETE' });
  },
};

export default vercelApi;
