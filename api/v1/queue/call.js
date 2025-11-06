/**
 * Queue Call Next Endpoint
 * POST /api/v1/queue/call
 */

import SupabaseClient, { getSupabaseClient } from '../../lib/supabase.js';
import { validateClinic, emitQueueEvent } from '../../lib/helpers.js';

export default async function handler(req, res) {
  try {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { clinic, clinicId } = req.body;
    const clinicName = clinic || clinicId;

    if (!clinicName) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic'
      });
    }

    if (!validateClinic(clinicName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic'
      });
    }

    const { callNextPatient, getActiveQueues } = SupabaseClient;
    const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment

    // 1. Call the next patient using the Supabase helper
    const nextPatient = await callNextPatient(supabase, clinicName);

    if (!nextPatient) {
      return res.status(200).json({
        success: false,
        error: 'No patients waiting'
      });
    }

    // 2. Get remaining queue length for the response
    const activeQueues = await getActiveQueues(supabase, clinicName);
    const remaining = activeQueues.length;

    // 3. Emit event (assuming emitQueueEvent is adapted)
    // await emitQueueEvent(clinicName, nextPatient.patient_id, 'CALLED', nextPatient.position);

    return res.status(200).json({
      success: true,
      clinic: clinicName,
      current: {
        user: nextPatient.patient_id,
        number: nextPatient.id, // Using Supabase ID as the number for now
        status: nextPatient.status,
        enteredAt: nextPatient.entered_at
      },
      remaining: remaining
    });

  } catch (error) {
    console.error('Error in api/v1/queue/call.js:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
