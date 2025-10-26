// Queue Enter - Add patient to clinic queue
// POST /api/v1/queue/enter
// Sequential numbers that never decrease
// MIGRATED TO SUPABASE

import { jsonResponse, validateRequiredFields } from '../../../_shared/utils.js';
import { logActivity } from '../../../_shared/activity-logger.js';
import { validateQueueEnter } from '../../../_shared/db-validator.js';
import { getSupabaseClient, addToQueue } from '../../../lib/supabase.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { clinic, user, name, exam_type } = body;
    
    const validationError = validateRequiredFields(body, ['clinic', 'user']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    // Initialize Supabase client
    const supabase = getSupabaseClient(env);
    
    // Check if patient already in queue
    const { data: existingEntry, error: checkError } = await supabase
      .from('queue')
      .select('*')
      .eq('patient_id', user)
      .eq('clinic_id', clinic)
      .in('status', ['waiting', 'called', 'in_progress'])
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing entry: ${checkError.message}`);
    }
    
    if (existingEntry) {
      // Already in queue
      const { count: waiting } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinic)
        .eq('status', 'waiting');
      
      return jsonResponse({
        success: true,
        clinic: clinic,
        user: user,
        number: existingEntry.position,
        status: existingEntry.status,
        entry_time: existingEntry.entered_at,
        waiting_count: waiting || 0,
        message: 'Already in queue'
      });
    }
    
    // Validate patient can enter this clinic (if validation function exists)
    if (typeof validateQueueEnter === 'function') {
      const validation = await validateQueueEnter(env, user, clinic);
      if (!validation.valid) {
        return jsonResponse({
          success: false,
          error: validation.error,
          code: validation.code,
          details: validation
        }, validation.code === 'PATIENT_NOT_FOUND' ? 404 : 403);
      }
    }
    
    const now = new Date();
    const entryTime = now.toISOString();
    
    // Get next position number
    const { data: lastEntry } = await supabase
      .from('queue')
      .select('position')
      .eq('clinic_id', clinic)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const assignedNumber = lastEntry ? lastEntry.position + 1 : 1;
    
    // Add patient to queue
    const { data: newEntry, error: insertError } = await supabase
      .from('queue')
      .insert({
        patient_id: user,
        patient_name: name || user,
        clinic_id: clinic,
        exam_type: exam_type || 'general',
        status: 'waiting',
        position: assignedNumber,
        entered_at: entryTime
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to add to queue: ${insertError.message}`);
    }
    
    // Get waiting count
    const { count: waiting } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic)
      .eq('status', 'waiting');
    
    // Get total entered and exited counts
    const { count: entered } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic);
    
    const { count: exited } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic)
      .in('status', ['completed', 'cancelled']);
    
    // Log activity
    if (typeof logActivity === 'function') {
      await logActivity(env, 'ENTER', {
        patientId: user,
        clinic: clinic,
        queueNumber: assignedNumber,
        details: {
          entered_count: entered || 0,
          exited_count: exited || 0,
          waiting_count: waiting || 0
        }
      });
    }
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      user: user,
      number: assignedNumber,
      status: 'waiting',
      entry_time: entryTime,
      counters: {
        entered: entered || 0,
        exited: exited || 0,
        waiting: waiting || 0
      }
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

