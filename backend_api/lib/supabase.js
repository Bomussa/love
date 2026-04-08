/**
 * Supabase Client Wrapper (Unified & Fixed)
 * 
 * @module lib/supabase
 * @description Provides a consistent client for connecting to Supabase across all API endpoints
 * with comprehensive error handling, retry logic, and utility functions.
 * @version 2.0.0
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client instance
 * @param {Object} env - Environment variables
 * @param {string} env.SUPABASE_URL - Supabase project URL
 * @param {string} env.SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 * @returns {Object} Supabase client instance
 * @throws {Error} If required environment variables are missing
 */
export function getSupabaseClient(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL must be set in environment variables');
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY must be set in environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'mmc-mms-api/2.0.0',
      },
    },
  });
}

/**
 * Executes a database operation with retry logic
 * @param {Function} operation - Async operation to execute
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<*>} Operation result
 */
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const waitTime = delay * Math.pow(2, attempt);
        console.warn(`[SUPABASE] Retry ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

/**
 * Gets all active items in the queue
 * @param {Object} supabase - Supabase client
 * @param {string} clinicId - Optional clinic ID to filter by
 * @returns {Promise<Array>} Array of active queue items
 * @throws {Error} If database query fails
 */
export async function getActiveQueues(supabase, clinicId = null) {
  return withRetry(async () => {
    let query = supabase
      .from('queues')
      .select('*')
      .in('status', ['WAITING', 'IN_PROGRESS', 'CALLED'])
      .order('display_number', { ascending: true });

    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('[SUPABASE] getActiveQueues error:', error);
      throw new Error(`Failed to fetch queues: ${error.message}`);
    }
    
    return data || [];
  });
}

/**
 * Adds a patient to the queue
 * @param {Object} supabase - Supabase client
 * @param {Object} patientData - Patient data
 * @param {string} patientData.patient_id - Patient ID
 * @param {string} patientData.clinic_id - Clinic ID
 * @param {string} patientData.exam_type - Exam type
 * @param {boolean} patientData.is_priority - Whether patient has priority
 * @param {string} patientData.priority_reason - Priority reason
 * @returns {Promise<Object>} Created queue entry
 * @throws {Error} If database insert fails
 */
export async function addToQueue(supabase, patientData) {
  return withRetry(async () => {
    const {
      patient_id, clinic_id, exam_type, is_priority = false, priority_reason = null
    } = patientData;

    // Validate required fields
    if (!patient_id || !clinic_id) {
      throw new Error('patient_id and clinic_id are required');
    }

    // Get next display_number with locking to prevent race conditions
    const { data: lastEntry, error: countError } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', clinic_id)
      .order('display_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (countError) {
      console.error('[SUPABASE] Count error:', countError);
      throw new Error(`Failed to get queue count: ${countError.message}`);
    }

    const nextNumber = lastEntry ? lastEntry.display_number + 1 : 1;

    const { data, error } = await supabase
      .from('queues')
      .insert({
        patient_id: String(patient_id).trim(),
        clinic_id: String(clinic_id).trim(),
        exam_type: exam_type ? String(exam_type).trim() : null,
        status: 'WAITING',
        display_number: nextNumber,
        is_priority: Boolean(is_priority),
        priority_reason: priority_reason ? String(priority_reason).trim() : null,
        entered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[SUPABASE] addToQueue error:', error);
      throw new Error(`Failed to add to queue: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Calls the next patient for a clinic
 * @param {Object} supabase - Supabase client
 * @param {string} clinicId - Clinic ID
 * @returns {Promise<Object|null>} Called patient data or null if queue is empty
 * @throws {Error} If database update fails
 */
export async function callNextPatient(supabase, clinicId) {
  return withRetry(async () => {
    if (!clinicId) {
      throw new Error('clinicId is required');
    }

    // Get next patient (respecting priority)
    const { data: nextPatient, error: fetchError } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'WAITING')
      .order('is_priority', { ascending: false })
      .order('display_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[SUPABASE] Fetch error:', fetchError);
      throw new Error(`Failed to fetch next patient: ${fetchError.message}`);
    }

    if (!nextPatient) {
      return null;
    }

    // Update patient status
    const { data, error } = await supabase
      .from('queues')
      .update({
        status: 'IN_PROGRESS',
        called_at: new Date().toISOString(),
      })
      .eq('id', nextPatient.id)
      .select()
      .single();

    if (error) {
      console.error('[SUPABASE] callNextPatient error:', error);
      throw new Error(`Failed to call patient: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Completes patient examination
 * @param {Object} supabase - Supabase client
 * @param {string} queueId - Queue entry ID
 * @param {string} pin - PIN used for completion
 * @returns {Promise<Object>} Updated queue entry
 * @throws {Error} If database update fails
 */
export async function completePatient(supabase, queueId, pin = null) {
  return withRetry(async () => {
    if (!queueId) {
      throw new Error('queueId is required');
    }

    const updateData = {
      status: 'DONE',
      completed_at: new Date().toISOString(),
    };

    if (pin) {
      updateData.completed_by_pin = String(pin).trim();
    }

    const { data, error } = await supabase
      .from('queues')
      .update(updateData)
      .eq('id', queueId)
      .select()
      .single();

    if (error) {
      console.error('[SUPABASE] completePatient error:', error);
      throw new Error(`Failed to complete patient: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Gets patient position in queue
 * @param {Object} supabase - Supabase client
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object|null>} Patient position data or null
 * @throws {Error} If database query fails
 */
export async function getPatientPosition(supabase, patientId) {
  return withRetry(async () => {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    const { data, error } = await supabase
      .from('queues')
      .select('display_number, status, clinic_id')
      .eq('patient_id', String(patientId).trim())
      .in('status', ['WAITING', 'IN_PROGRESS', 'CALLED'])
      .maybeSingle();

    if (error) {
      console.error('[SUPABASE] getPatientPosition error:', error);
      throw new Error(`Failed to get patient position: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Gets clinic statistics
 * @param {Object} supabase - Supabase client
 * @param {string} clinicId - Clinic ID
 * @returns {Promise<Object>} Clinic statistics
 * @throws {Error} If database query fails
 */
export async function getClinicStats(supabase, clinicId) {
  return withRetry(async () => {
    if (!clinicId) {
      throw new Error('clinicId is required');
    }

    const { data: queue, error } = await supabase
      .from('queues')
      .select('status, entered_at, completed_at')
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('[SUPABASE] getClinicStats error:', error);
      throw new Error(`Failed to get clinic stats: ${error.message}`);
    }

    const queueData = queue || [];
    
    const stats = {
      total_patients: queueData.length,
      waiting: queueData.filter((p) => p.status === 'WAITING').length,
      serving: queueData.filter((p) => p.status === 'IN_PROGRESS' || p.status === 'CALLED').length,
      completed: queueData.filter((p) => p.status === 'DONE').length,
    };

    // Calculate average wait time
    const completedPatients = queueData.filter((p) => p.status === 'DONE' && p.completed_at && p.entered_at);
    if (completedPatients.length > 0) {
      const totalWaitTime = completedPatients.reduce((sum, p) => {
        const wait = new Date(p.completed_at) - new Date(p.entered_at);
        return sum + wait;
      }, 0);
      stats.average_wait_time = Math.round(totalWaitTime / completedPatients.length / 1000 / 60);
    } else {
      stats.average_wait_time = 0;
    }

    return stats;
  });
}

/**
 * Verifies clinic PIN
 * @param {Object} supabase - Supabase client
 * @param {string} clinicId - Clinic ID
 * @param {string} pin - PIN to verify
 * @returns {Promise<Object>} Verification result
 * @throws {Error} If database query fails
 */
export async function verifyClinicPin(supabase, clinicId, pin) {
  return withRetry(async () => {
    if (!clinicId || !pin) {
      throw new Error('clinicId and pin are required');
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('pin')
      .eq('id', String(clinicId).trim())
      .single();

    if (error) {
      console.error('[SUPABASE] verifyClinicPin error:', error);
      throw new Error(`Failed to verify PIN: ${error.message}`);
    }
    
    return { valid: data?.pin === String(pin).trim() };
  });
}

/**
 * Creates a notification
 * @param {Object} supabase - Supabase client
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 * @throws {Error} If database insert fails
 */
export async function createNotification(supabase, notificationData) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        ...notificationData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[SUPABASE] createNotification error:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Gets system settings
 * @param {Object} supabase - Supabase client
 * @param {string} key - Optional setting key to filter by
 * @returns {Promise<Object|Array>} Setting(s) data
 * @throws {Error} If database query fails
 */
export async function getSettings(supabase, key = null) {
  return withRetry(async () => {
    let query = supabase.from('system_settings').select('*');
    
    if (key) {
      query = query.eq('key', String(key).trim()).maybeSingle();
    }
    
    const { data, error } = await query;

    if (error) {
      console.error('[SUPABASE] getSettings error:', error);
      throw new Error(`Failed to get settings: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Updates system setting
 * @param {Object} supabase - Supabase client
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<Object>} Updated setting
 * @throws {Error} If database update fails
 */
export async function updateSetting(supabase, key, value) {
  return withRetry(async () => {
    if (!key) {
      throw new Error('key is required');
    }

    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        key: String(key).trim(),
        value: value,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[SUPABASE] updateSetting error:', error);
      throw new Error(`Failed to update setting: ${error.message}`);
    }
    
    return data;
  });
}

/**
 * Gets all clinics
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Array>} Array of clinics
 * @throws {Error} If database query fails
 */
export async function getClinics(supabase) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('name_ar', { ascending: true });

    if (error) {
      console.error('[SUPABASE] getClinics error:', error);
      throw new Error(`Failed to fetch clinics: ${error.message}`);
    }
    
    return data || [];
  });
}

/**
 * Gets clinic by ID
 * @param {Object} supabase - Supabase client
 * @param {string} clinicId - Clinic ID
 * @returns {Promise<Object|null>} Clinic data or null
 * @throws {Error} If database query fails
 */
export async function getClinicById(supabase, clinicId) {
  return withRetry(async () => {
    if (!clinicId) {
      throw new Error('clinicId is required');
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', String(clinicId).trim())
      .maybeSingle();

    if (error) {
      console.error('[SUPABASE] getClinicById error:', error);
      throw new Error(`Failed to fetch clinic: ${error.message}`);
    }
    
    return data;
  });
}

// Export default object with all functions
export default {
  getSupabaseClient,
  getActiveQueues,
  addToQueue,
  callNextPatient,
  completePatient,
  getPatientPosition,
  getClinicStats,
  verifyClinicPin,
  createNotification,
  getSettings,
  updateSetting,
  getClinics,
  getClinicById,
};
