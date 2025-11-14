/**
 * Vercel API Client
 * This file provides a client for the Vercel API endpoints
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
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PATIENT MANAGEMENT
// ============================================

export function patientLogin(personalId, gender) {
  return fetchAPI('/patient/login', {
    method: 'POST',
    body: { personalId, gender },
  });
}

// ============================================
// PATHWAY MANAGEMENT
// ============================================

export function createPathway(patientId, examType, gender) {
  return fetchAPI('/route/create', {
    method: 'POST',
    body: { patientId, examType, gender },
  });
}

export function getPathway(patientId) {
  return fetchAPI(`/route/get?patientId=${patientId}`);
}

export function updatePathwayStep(patientId, step) {
    return fetchAPI('/route/update', {
        method: 'POST',
        body: { patientId, step },
    });
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

export function enterQueue(sessionId, clinicId) {
  return fetchAPI('/queue/enter', {
    method: 'POST',
    body: { sessionId, clinicId },
  });
}

export function getQueueStatus(clinicId) {
  return fetchAPI(`/queue/status?clinicId=${clinicId}`);
}

export function queueCall(clinicId) {
  return fetchAPI('/queue/call', {
    method: 'POST',
    body: { clinicId },
  });
}

export function queueDone(sessionId, clinicId) {
  return fetchAPI('/queue/done', {
    method: 'POST',
    body: { sessionId, clinicId },
  });
}

// ============================================
// PIN MANAGEMENT
// ============================================

export function getPinStatus() {
  return fetchAPI('/pin/status');
}

export function verifyPin(clinicId, pin) {
  return fetchAPI('/pin/verify', {
    method: 'POST',
    body: { clinicId, pin },
  });
}

export function generatePin(clinicId) {
  return fetchAPI('/pin/generate', {
    method: 'POST',
    body: { clinicId },
  });
}

// ============================================
// REPORTS & STATISTICS
// ============================================

export function getDailyReport(date = null) {
  const queryString = date ? `?date=${date}` : '';
  return fetchAPI(`/reports/daily${queryString}`);
}

export function getDashboardStats() {
  return fetchAPI('/stats/dashboard');
}

export default {
  patientLogin,
  createPathway,
  getPathway,
  updatePathwayStep,
  enterQueue,
  getQueueStatus,
  queueCall,
  queueDone,
  getPinStatus,
  verifyPin,
  generatePin,
  getDailyReport,
  getDashboardStats,
};
