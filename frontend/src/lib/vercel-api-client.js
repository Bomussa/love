/**
 * Vercel API Client
 * Uses /api/v1/ endpoints for all backend communication
 * This ensures proper routing through Vercel to Supabase
 */

const API_BASE = '/api/v1';

/**
 * Generic API call helper
 */
async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
}

// ============================================
// PATIENT MANAGEMENT
// ============================================

export async function patientLogin(patientId, gender) {
  try {
    const data = await apiCall('/patient/login', {
      method: 'POST',
      body: { patient_id: patientId, gender },
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

export async function enterQueue(clinicId, patientData) {
  try {
    const data = await apiCall('/queue/enter', {
      method: 'POST',
      body: {
        clinic_id: clinicId,
        patient_id: patientData.id || patientData.patientId,
        gender: patientData.gender,
      },
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueueStatus(clinicId) {
  try {
    const data = await apiCall(`/queue/status?clinic_id=${clinicId}`);
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueuePosition(clinicId, patientId) {
  try {
    const data = await apiCall(`/queue/position?clinic_id=${clinicId}&patient_id=${patientId}`);
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
    const data = await apiCall('/queue/done', {
      method: 'POST',
      body: {
        clinic_id: clinicId,
        patient_id: patientData.id || patientData.patientId,
        pin: String(pin),
      },
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
    const data = await apiCall(`/pin/status?clinic_id=${clinicId}`);
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function generatePIN(clinicId, adminCode) {
  try {
    const data = await apiCall('/pin/generate', {
      method: 'POST',
      body: { clinic_id: clinicId, admin_code: adminCode },
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function verifyPIN(clinicId, pin) {
  try {
    const data = await apiCall('/pin/verify', {
      method: 'POST',
      body: { clinic_id: clinicId, pin: String(pin) },
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
    const data = await apiCall('/admin/status');
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueueStats() {
  try {
    const data = await apiCall('/stats/queues');
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getDashboardStats() {
  try {
    const data = await apiCall('/stats/dashboard');
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getActivePins(adminCode) {
  try {
    const data = await apiCall(`/pin/status?admin_code=${adminCode}`);
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
    const data = await apiCall(`/reports/daily?admin_code=${adminCode}`);
    return { success: true, report: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getWeeklyReport(adminCode) {
  try {
    const data = await apiCall(`/reports/weekly?admin_code=${adminCode}`);
    return { success: true, report: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getMonthlyReport(adminCode) {
  try {
    const data = await apiCall(`/reports/monthly?admin_code=${adminCode}`);
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
    const data = await apiCall('/health');
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
