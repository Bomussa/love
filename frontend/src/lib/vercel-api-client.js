/**
 * Supabase Edge Functions API Client
 * Direct connection to Supabase Edge Functions
 * 
 * Benefits:
 * - No Vercel serverless functions limit
 * - Faster response (direct to Supabase)
 * - Lower latency
 * - 100% free
 */

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

// Base URL for Edge Functions
const EDGE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

/**
 * Make API call to Supabase Edge Function
 * @param {string} endpoint - Edge function name
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response data
 */
async function callEdgeFunction(endpoint, options = {}) {
  const url = `${EDGE_FUNCTIONS_BASE}/${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Edge Function] ${endpoint} error:`, response.status, errorText);
      throw new Error(`Edge Function error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Edge Function] ${endpoint} failed:`, error);
    throw error;
  }
}

// ============================================
// PATIENT MANAGEMENT
// ============================================

export async function patientLogin(patientId, gender) {
  try {
    const data = await callEdgeFunction('patient-login', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, gender }),
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
    const data = await callEdgeFunction('queue-enter', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_id: patientData.id || patientData.patientId,
        gender: patientData.gender,
      }),
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueueStatus(clinicId) {
  try {
    const data = await callEdgeFunction('queue-status', {
      method: 'POST',
      body: JSON.stringify({ clinic_id: clinicId }),
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueuePosition(clinicId, patientId) {
  try {
    const data = await callEdgeFunction('queue-position', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_id: patientId,
      }),
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
    const data = await callEdgeFunction('queue-done', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_id: patientData.id || patientData.patientId,
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
    const data = await callEdgeFunction('pin-status', {
      method: 'POST',
      body: JSON.stringify({ clinic_id: clinicId }),
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function generatePIN(clinicId, adminCode) {
  try {
    const data = await callEdgeFunction('pin-generate', {
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
    const data = await callEdgeFunction('pin-status', {
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
    const data = await callEdgeFunction('admin-status', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getQueueStats() {
  try {
    const data = await callEdgeFunction('stats-queues', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getDashboardStats() {
  try {
    const data = await callEdgeFunction('stats-dashboard', {
      method: 'GET',
    });
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getActivePins(adminCode) {
  try {
    const data = await callEdgeFunction('pin-status', {
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
    const data = await callEdgeFunction('stats-dashboard', {
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
    const data = await callEdgeFunction('stats-dashboard', {
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
    const data = await callEdgeFunction('stats-dashboard', {
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
    const data = await callEdgeFunction('health', {
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
