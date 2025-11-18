/**
 * Vercel API Client
 * Connection to Vercel API endpoints
 * 
 * Architecture:
 * Frontend → Vercel API (/api/v1) → Supabase Edge Functions → Supabase Database
 * 
 * Benefits:
 * - Centralized API layer
 * - Better error handling
 * - Rate limiting
 * - Logging and monitoring
 */

// Base URL for Vercel API
const API_BASE = '/api/v1';

/**
 * Make API call to Vercel API
 * @param {string} endpoint - API endpoint (e.g., 'queue/status', 'pin/generate')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response data
 */
async function callAPI(endpoint, options = {}) {
  const url = `${API_BASE}/${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Vercel API] ${endpoint} failed:`, error);
    throw error;
  }
}

// ============================================
// PATIENT MANAGEMENT
// ============================================

export async function patientLogin(patientId, gender) {
  try {
    const data = await callAPI('patient/login', {
      method: 'POST',
      body: JSON.stringify({ patientId: patientId, gender }),
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

export async function enterQueue(clinicId, patientData, enter = true) {
  try {
    const data = await callAPI('queue/enter', {
      method: 'POST',
      body: JSON.stringify({
        clinic: clinicId,
        user: patientData.id || patientData.sessionId,
        isAutoEntry: enter,
      }),
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueueStatus(clinicId) {
  try {
    const data = await callAPI(`queue/status?clinic=${clinicId}`, {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueuePosition(clinicId, patientId) {
  try {
    const data = await callAPI(`queue/position?clinic=${clinicId}&user=${patientId}`, {
      method: 'GET',
    });
    return {
      success: true,
      displayNumber: data.display_number,
      ahead: data.ahead,
      totalWaiting: data.total_waiting,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function queueDone(clinicId, patientData, pin) {
  try {
    const data = await callAPI('queue/done', {
      method: 'POST',
      body: JSON.stringify({
        clinic: clinicId,
        user: patientData.id || patientData.sessionId,
        pin: String(pin),
      }),
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// PIN CODE MANAGEMENT
// ============================================

export async function getPinStatus(clinicId) {
  try {
    const data = await callAPI(`pin/status?clinic=${clinicId}`, {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function generatePIN(clinicId, adminCode) {
  try {
    const data = await callAPI('pin-generate', {
      method: 'POST',
      body: JSON.stringify({ clinic_id: clinicId, admin_code: adminCode }),
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function verifyPIN(clinicId, pin) {
  try {
    const data = await callAPI('pin/status', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId,
        verify_pin: String(pin),
      }),
    });
    return { success: true, valid: data.valid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// ADMIN MANAGEMENT
// ============================================

export async function getAdminStatus() {
  try {
    const data = await callAPI('admin/status', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueueStats() {
  try {
    const data = await callAPI('stats/queues', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getDashboardStats() {
  try {
    const data = await callAPI('stats/dashboard', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getActivePins(adminCode) {
  try {
    const data = await callAPI('pin/status', {
      method: 'POST',
      body: JSON.stringify({ admin_code: adminCode }),
    });
    return { success: true, pins: data.pins || [] };
  } catch (error) {
    return { success: false, error: error.message, pins: [] };
  }
}

// ============================================
// REPORTS
// ============================================

export async function getDailyReport(adminCode) {
  try {
    const data = await callAPI('stats-dashboard', {
      method: 'POST',
      body: JSON.stringify({
        report_type: 'daily',
        admin_code: adminCode,
      }),
    });
    return { success: true, report: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getWeeklyReport(adminCode) {
  try {
    const data = await callAPI('stats-dashboard', {
      method: 'POST',
      body: JSON.stringify({
        report_type: 'weekly',
        admin_code: adminCode,
      }),
    });
    return { success: true, report: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getMonthlyReport(adminCode) {
  try {
    const data = await callAPI('stats-dashboard', {
      method: 'POST',
      body: JSON.stringify({
        report_type: 'monthly',
        admin_code: adminCode,
      }),
    });
    return { success: true, report: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getRecentReports(adminCode) {
  try {
    const daily = await getDailyReport(adminCode);
    const weekly = await getWeeklyReport(adminCode);
    return {
      success: true,
      reports: [
        { type: 'daily', ...daily.report },
        { type: 'weekly', ...weekly.report },
      ],
    };
  } catch (error) {
    return { success: false, error: error.message, reports: [] };
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function healthCheck() {
  try {
    const data = await callAPI('health', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Default export
const vercelApiClient = {
  patientLogin,
  enterQueue,
  getQueueStatus,
  getQueuePosition,
  queueDone,
  getPinStatus,
  generatePIN,
  verifyPIN,
  getAdminStatus,
  getQueueStats,
  getDashboardStats,
  getActivePins,
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getRecentReports,
  healthCheck,
};

export default vercelApiClient;
