/**
 * Supabase Edge Functions API Client
 * Uses Supabase Edge Functions for backend operations
 */

// Supabase Edge Functions Base URL
const EDGE_FUNCTIONS_URL = 'https://rujwuruuosffcxazymit.supabase.co/functions/v1';

// Supabase Anon Key (public key, safe to use in frontend)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1NzQ0NTAsImV4cCI6MjA0NjE1MDQ1MH0.KLdkqwQxQBcqJXbOlxcZOqN1zyFfvO7kEEhOKLXOhHM';

// Helper function to call Edge Functions
async function callEdgeFunction(functionName, body = {}, method = 'POST') {
  const url = `${EDGE_FUNCTIONS_URL}/${functionName}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  };

  if (method !== 'GET' && Object.keys(body).length > 0) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function ${functionName} failed: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    throw error;
  }
}

// ============================================
// 1. PATIENT MANAGEMENT
// ============================================

export async function patientLogin(personalId, gender) {
  return await callEdgeFunction('patient-login', { personalId, gender });
}

// ============================================
// 2. QUEUE MANAGEMENT
// ============================================

export async function enterQueue(clinicId, patientId) {
  return await callEdgeFunction('queue-enter', { clinicId, patientId });
}

export async function getQueueStatus(clinicId) {
  return await callEdgeFunction('queue-status', { clinicId });
}

export async function getPatientPosition(clinicId, patientId) {
  return await callEdgeFunction('queue-position', { clinicId, patientId });
}

export async function queueCall(clinicId) {
  return await callEdgeFunction('queue-call', { clinicId });
}

export async function queueDone(clinicId, patientId, pin) {
  return await callEdgeFunction('queue-done', { clinicId, patientId, pin });
}

export async function queueCancel(clinicId, patientId) {
  return await callEdgeFunction('queue-cancel', { clinicId, patientId });
}

// ============================================
// 3. PATHWAY MANAGEMENT
// ============================================

export async function createPathway(patientId, gender) {
  // Pathways might be created automatically by Edge Functions
  // Return success for compatibility
  return { success: true };
}

export async function getPathway(patientId) {
  // Get pathway from database or Edge Function
  return { success: true, pathway: null };
}

export async function updatePathwayStep(patientId, step) {
  // Update pathway step
  return { success: true };
}

// ============================================
// 4. NOTIFICATIONS
// ============================================

export async function addNotification(patientId, message, type = 'info') {
  return { success: true };
}

export async function getNotifications(patientId, unreadOnly = false) {
  return { success: true, notifications: [] };
}

export async function markNotificationRead(notificationId) {
  return { success: true };
}

// ============================================
// 5. CLINICS
// ============================================

export async function getClinics() {
  return { 
    success: true, 
    clinics: [
      { id: 'clinic1', name: 'العيادة الأولى', status: 'active' },
      { id: 'clinic2', name: 'العيادة الثانية', status: 'active' },
      { id: 'clinic3', name: 'العيادة الثالثة', status: 'active' }
    ] 
  };
}

// ============================================
// 6. PIN MANAGEMENT
// ============================================

export async function pinGenerate() {
  return await callEdgeFunction('pin-generate', {}, 'POST');
}

export async function pinStatus() {
  return await callEdgeFunction('pin-status', {}, 'GET');
}

// ============================================
// 7. ADMIN MANAGEMENT
// ============================================

export async function adminLogin(pin) {
  return await callEdgeFunction('admin-login', { pin });
}

export async function adminStatus() {
  return await callEdgeFunction('admin-status', {}, 'GET');
}

export async function adminSetCallInterval(interval) {
  return await callEdgeFunction('admin-set-call-interval', { interval });
}

// ============================================
// 8. REPORTS
// ============================================

export async function getDailyReport(date = null) {
  return { success: true, report: {} };
}

// ============================================
// 9. HEALTH CHECK
// ============================================

export async function health() {
  return await callEdgeFunction('health', {}, 'GET');
}

// Export all functions
export async function getPinStatus() {
  return await pinStatus();
}

export async function getAdminStatus() {
  return await adminStatus();
}

export default {
  // Patient
  patientLogin,
  
  // Queue
  enterQueue,
  getQueueStatus,
  getPatientPosition,
  queueCall,
  queueDone,
  queueCancel,
  
  // Pathway
  createPathway,
  getPathway,
  updatePathwayStep,
  
  // Notifications
  addNotification,
  getNotifications,
  markNotificationRead,
  
  // Clinics
  getClinics,
  
  // PIN
  pinGenerate,
  pinStatus,
  getPinStatus,
  
  // Admin
  adminLogin,
  adminStatus,
  getAdminStatus,
  adminSetCallInterval,
  
  // Reports
  getDailyReport,
  
  // Health
  health,
};
