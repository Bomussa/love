/**
 * Supabase Backend API
 * Complete API for medical queue management system
 */

import { supabase } from './supabase-client';

// ============================================
// 1. PATIENT MANAGEMENT
// ============================================

/**
 * Register a new patient
 * @param {string} id - Patient ID
 * @param {string} gender - Patient gender ('male' or 'female')
 * @returns {Promise<Object>} Patient data
 */
export async function patientLogin(id, gender) {
  try {
    // Accept any ID without database verification
    // System doesn't store patient data permanently
    const patient = {
      id,
      gender,
      last_active: new Date().toISOString()
    };

    return { success: true, patient };
  } catch (error) {
    console.error('Error in patientLogin:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 2. PATHWAY MANAGEMENT
// ============================================

/**
 * Create a dynamic pathway for a patient
 * @param {string} patientId - Patient ID
 * @param {string} gender - Patient gender
 * @returns {Promise<Object>} Pathway data
 */
export async function createPathway(patientId, gender) {
  try {
    // Define pathways based on gender
    const malePathway = [
      'lab', 'radiology', 'vitals', 'ecg', 'audiology',
      'eyes', 'internal', 'ent', 'surgery', 'dental',
      'psychiatry', 'dermatology', 'orthopedics'
    ];

    const femalePathway = [
      'lab', 'radiology', 'vitals', 'ecg', 'audiology',
      'eyes', 'internal', 'ent', 'dental',
      'psychiatry', 'dermatology'
    ];

    const pathway = gender === 'male' ? malePathway : femalePathway;

    const { data, error } = await supabase
      .from('pathways')
      .insert([{
        patient_id: patientId,
        gender,
        pathway,
        current_step: 0,
        completed: false
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, pathway: data };
  } catch (error) {
    console.error('Error in createPathway:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get patient's pathway
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} Pathway data
 */
export async function getPathway(patientId) {
  try {
    const { data, error } = await supabase
      .from('pathways')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { success: false, error: 'No pathway found for this patient' };
    }
    return { success: true, pathway: data };
  } catch (error) {
    console.error('Error in getPathway:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update pathway progress
 * @param {string} patientId - Patient ID
 * @param {number} step - Current step number
 * @returns {Promise<Object>} Updated pathway
 */
export async function updatePathwayStep(patientId, step) {
  try {
    const { data, error } = await supabase
      .from('pathways')
      .update({ current_step: step })
      .eq('patient_id', patientId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, pathway: data };
  } catch (error) {
    console.error('Error in updatePathwayStep:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 3. QUEUE MANAGEMENT
// ============================================

/**
 * Enter a queue
 * @param {string} clinicId - Clinic ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} Queue entry data
 */
export async function enterQueue(clinicId, patientId) {
  try {
    // Get next display number
    const { data: maxNumber } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', clinicId)
      .order('display_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const displayNumber = (maxNumber?.display_number || 0) + 1;

    // Insert into queue
    const { data, error } = await supabase
      .from('queues')
      .insert([{
        clinic_id: clinicId,
        patient_id: patientId,
        display_number: displayNumber,
        status: 'waiting'
      }])
      .select()
      .single();

    if (error) throw error;

    // Add notification
    await addNotification(
      patientId,
      `تم دخولك إلى طابور ${clinicId}. رقمك: ${displayNumber}`,
      'success'
    );

    return { success: true, queue: data, displayNumber };
  } catch (error) {
    console.error('Error in enterQueue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get queue status for a clinic
 * @param {string} clinicId - Clinic ID
 * @returns {Promise<Object>} Queue status
 */
export async function getQueueStatus(clinicId) {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .in('status', ['waiting', 'serving'])
      .order('display_number', { ascending: true });

    if (error) throw error;

    const waiting = data.filter(q => q.status === 'waiting');
    const serving = data.find(q => q.status === 'serving');

    return {
      success: true,
      waiting: waiting.length,
      serving: serving ? serving.display_number : null,
      queue: data
    };
  } catch (error) {
    console.error('Error in getQueueStatus:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete a queue entry (requires PIN)
 * @param {string} clinicId - Clinic ID
 * @param {string} patientId - Patient ID
 * @param {string} pin - Clinic PIN
 * @returns {Promise<Object>} Result
 */
export async function queueDone(clinicId, patientId, pin) {
  try {
    // Verify PIN
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('pin_code, pin_expires_at, is_active')
      .eq('id', clinicId)
      .maybeSingle();

    if (clinicError) throw clinicError;
    if (!clinic) {
      return { success: false, error: 'العيادة غير موجودة' };
    }

    // Check if clinic is active
    if (!clinic.is_active) {
      return { success: false, error: 'العيادة غير نشطة حالياً' };
    }

    // Check if PIN has expired
    if (clinic.pin_expires_at && new Date(clinic.pin_expires_at) < new Date()) {
      return { success: false, error: 'رقم PIN منتهي الصلاحية' };
    }

    // Verify PIN
    if (clinic.pin_code && clinic.pin_code !== pin) {
      return { success: false, error: 'رقم PIN غير صحيح' };
    }

    // Update queue status
    const { data, error } = await supabase
      .from('queues')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_pin: pin
      })
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'waiting')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { success: false, error: 'لم يتم العثور على المريض في الطابور' };
    }

    // Add notification
    await addNotification(
      patientId,
      `تم إكمال زيارتك لـ ${clinicId}`,
      'success'
    );

    return { success: true, queue: data };
  } catch (error) {
    console.error('Error in queueDone:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get patient's position in queue
 * @param {string} clinicId - Clinic ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} Position data
 */
export async function getPatientPosition(clinicId, patientId) {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'waiting')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { success: false, error: 'Patient not found in queue' };
    }

    // Count how many are ahead
    const { count } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .lt('display_number', data.display_number);

    return {
      success: true,
      displayNumber: data.display_number,
      ahead: count || 0
    };
  } catch (error) {
    console.error('Error in getPatientPosition:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 4. NOTIFICATION MANAGEMENT
// ============================================

/**
 * Add a notification for a patient
 * @param {string} patientId - Patient ID
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('info', 'warning', 'success', 'error')
 * @returns {Promise<Object>} Notification data
 */
export async function addNotification(patientId, message, type = 'info') {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        patient_id: patientId,
        message,
        type,
        read: false
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, notification: data };
  } catch (error) {
    console.error('Error in addNotification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notifications for a patient
 * @param {string} patientId - Patient ID
 * @param {boolean} unreadOnly - Get only unread notifications
 * @returns {Promise<Object>} Notifications array
 */
export async function getNotifications(patientId, unreadOnly = false) {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, notifications: data };
  } catch (error) {
    console.error('Error in getNotifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} Result
 */
export async function markNotificationRead(notificationId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, notification: data };
  } catch (error) {
    console.error('Error in markNotificationRead:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 5. CLINIC MANAGEMENT
// ============================================

/**
 * Get all clinics
 * @returns {Promise<Object>} Clinics array
 */
export async function getClinics() {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    if (error) throw error;
    return { success: true, clinics: data };
  } catch (error) {
    console.error('Error in getClinics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get PIN status for all clinics
 * @returns {Promise<Object>} PIN status object
 */
export async function getPinStatus() {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name_ar, name_en, pin_code, pin_expires_at, is_active')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    if (error) throw error;

    const pinStatus = {};
    data.forEach(clinic => {
      // Only include clinics with active PINs
      if (clinic.pin_code && (!clinic.pin_expires_at || new Date(clinic.pin_expires_at) > new Date())) {
        pinStatus[clinic.id] = {
          clinicName: clinic.name_ar,
          pin: clinic.pin_code,
          expiresAt: clinic.pin_expires_at
        };
      }
    });

    return { success: true, pins: pinStatus };
  } catch (error) {
    console.error('Error in getPinStatus:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 6. REPORTS & STATISTICS
// ============================================

/**
 * Get daily report
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Daily report
 */
export async function getDailyReport(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('queue_history')
      .select('*')
      .gte('completed_at', `${targetDate}T00:00:00`)
      .lt('completed_at', `${targetDate}T23:59:59`);

    if (error) throw error;

    return {
      success: true,
      date: targetDate,
      total: data.length,
      avgWaitTime: data.length > 0
        ? Math.round(data.reduce((sum, q) => sum + q.wait_time_seconds, 0) / data.length)
        : 0
    };
  } catch (error) {
    console.error('Error in getDailyReport:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get admin status
 * @returns {Promise<Object>} Admin dashboard data
 */
export async function getAdminStatus() {
  try {
    // Get total patients today
    const today = new Date().toISOString().split('T')[0];
    const { count: totalToday } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .gte('entered_at', `${today}T00:00:00`);

    // Get waiting count
    const { count: waiting } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');

    // Get completed count today
    const { count: completed } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00`);

    // Get active PINs count
    const { count: activePins } = await supabase
      .from('clinics')
      .select('*', { count: 'exact', head: true })
      .eq('requires_pin', true);

    return {
      success: true,
      totalToday: totalToday || 0,
      waiting: waiting || 0,
      completed: completed || 0,
      activePins: activePins || 0
    };
  } catch (error) {
    console.error('Error in getAdminStatus:', error);
    return { success: false, error: error.message };
  }
}

// Export all functions
export default {
  // Patient
  patientLogin,
  
  // Pathway
  createPathway,
  getPathway,
  updatePathwayStep,
  
  // Queue
  enterQueue,
  getQueueStatus,
  queueDone,
  getPatientPosition,
  
  // Notifications
  addNotification,
  getNotifications,
  markNotificationRead,
  
  // Clinics
  getClinics,
  getPinStatus,
  
  // Reports
  getDailyReport,
  getAdminStatus
};
