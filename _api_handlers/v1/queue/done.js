/**
 * Queue Done Endpoint
 * POST /api/v1/queue/done
 */

import SupabaseClient, { getSupabaseClient } from '../../lib/supabase.js';
import { emitQueueEvent } from '../../lib/helpers.js';

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
    const { clinic, user, pin, clinicId, patientId, ticket } = req.body;

    // Support both formats
    const clinicName = clinic || clinicId;
    const userId = user || patientId;

    if (!clinicName || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic or user'
      });
    }

    const { completePatient } = SupabaseClient;
    const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment

    // 1. Complete the patient using the Supabase helper
    const completedEntry = await completePatient(supabase, userId);

    if (!completedEntry) {
      return res.status(200).json({
        success: false,
        error: 'Patient not found or already completed'
      });
    }

    // 2. Emit event (assuming emitQueueEvent is adapted)
    // await emitQueueEvent(clinicName, userId, 'COMPLETED', 0);

    return res.status(200).json({
      success: true,
      clinic: clinicName,
      user: userId,
      message: 'Patient completed successfully'
    });

  } catch (error) {
    console.error('Error in api/v1/queue/done.js:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
