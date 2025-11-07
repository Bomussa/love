// Auto Call Next - Automatically call next patient in queue
// MIGRATED TO SUPABASE

import { jsonResponse } from '../../../_shared/utils.js';
import { getSupabaseClient, callNextPatient, createNotification } from '../../../lib/supabase.js';

export default async function handler(req, res) {
  try {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { clinic } = body;
    
    if (!clinic) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic parameter'
      }, 400);
    }
    
    const supabase = getSupabaseClient(env);
    
    // Call next patient
    const nextPatient = await callNextPatient(supabase, clinic);
    
    if (!nextPatient) {
      return jsonResponse({
        success: true,
        message: 'No patients waiting',
        clinic: clinic
      });
    }
    
    // Create notification
    await createNotification(supabase, {
      patient_id: nextPatient.patient_id,
      clinic_id: clinic,
      type: 'call',
      title: 'حان دورك',
      message: `يرجى التوجه إلى ${clinic}`
    });
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      called_patient: {
        id: nextPatient.patient_id,
        name: nextPatient.patient_name,
        position: nextPatient.position
      }
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

  } catch (error) {
    console.error('Error in api/v1/cron/auto-call-next.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
