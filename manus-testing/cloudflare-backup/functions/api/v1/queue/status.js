// Queue Status - Get current queue status for a clinic
// Returns current serving number, total length, and waiting count
// MIGRATED TO SUPABASE

import { jsonResponse } from '../../../_shared/utils.js';
import { getSupabaseClient } from '../../../lib/supabase.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const clinic = url.searchParams.get('clinic');
    
    if (!clinic) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic parameter'
      }, 400);
    }
    
    // Initialize Supabase client
    const supabase = getSupabaseClient(env);
    
    // Get all queue entries for this clinic
    const { data: queueList, error } = await supabase
      .from('queue')
      .select('*')
      .eq('clinic_id', clinic)
      .order('position', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch queue: ${error.message}`);
    }
    
    // Get current patient (the one being called/in service)
    const currentPatient = queueList.find(item => 
      item.status === 'called' || item.status === 'in_progress'
    );
    
    // Count by status
    const waiting = queueList.filter(item => item.status === 'waiting').length;
    const inService = queueList.filter(item => 
      item.status === 'called' || item.status === 'in_progress'
    ).length;
    const completed = queueList.filter(item => item.status === 'completed').length;
    const total = queueList.length;
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      current: currentPatient ? currentPatient.position : null,
      current_display: currentPatient ? currentPatient.position : 0,
      current_patient: currentPatient ? {
        id: currentPatient.patient_id,
        name: currentPatient.patient_name,
        position: currentPatient.position
      } : null,
      total: total,
      waiting: waiting,
      in_service: inService,
      completed: completed,
      queue_list: queueList.filter(item => item.status === 'waiting').map(item => ({
        id: item.patient_id,
        name: item.patient_name,
        position: item.position,
        entered_at: item.entered_at
      }))
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

