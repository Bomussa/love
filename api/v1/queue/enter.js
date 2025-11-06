/**
 * Queue Enter Endpoint
 * POST /api/v1/queue/enter
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
    const { clinic, user, isAutoEntry, examType } = req.body;

    if (!clinic || !user) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic or user'
      });
    }

    if (!validateClinic(clinic)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic'
      });
    }

    const { addToQueue, getPatientPosition } = SupabaseClient;
    const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment

    // 1. Check if user is already in queue (Supabase handles uniqueness, but we check for better UX)
    const existingPosition = await getPatientPosition(supabase, user);
    if (existingPosition && (existingPosition.status === 'waiting' || existingPosition.status === 'called')) {
      // User is already in queue, return their current position
      const { data: activeQueue } = await supabase
        .from('queue')
        .select('id')
        .eq('clinic_id', clinic)
        .in('status', ['waiting', 'called'])
        .order('position', { ascending: true });

      const position = activeQueue.findIndex(q => q.id === existingPosition.id) + 1;
      const ahead = position > 0 ? position - 1 : 0;

      return res.status(200).json({
        success: true,
        clinic: clinic,
        user: user,
        status: 'ALREADY_IN_QUEUE',
        ahead: ahead,
        display_number: position,
        position: position,
        message: 'You are already in the queue'
      });
    }

    // 2. Prepare data for Supabase
    const patientData = {
      patient_id: user,
      patient_name: user, // Placeholder for now
      clinic_id: clinic,
      exam_type: examType || 'general',
      status: isAutoEntry ? 'called' : 'waiting', // If auto-entry, set status to 'called'
      entered_at: new Date().toISOString(),
      called_at: isAutoEntry ? new Date().toISOString() : null
    };

    // 3. Use the helper function to add to queue, which handles position and insertion
    const newEntry = await addToQueue(supabase, patientData);

    // 4. Get final position for response
    const finalPosition = await getPatientPosition(supabase, user);
    const { data: activeQueue } = await supabase
      .from('queue')
      .select('id')
      .eq('clinic_id', clinic)
      .in('status', ['waiting', 'called'])
      .order('position', { ascending: true });

    const position = activeQueue.findIndex(q => q.id === finalPosition.id) + 1;
    const ahead = position > 0 ? position - 1 : 0;

    // 5. Emit event (assuming emitQueueEvent is adapted to use Supabase data)
    // await emitQueueEvent(clinic, 'enter', newEntry);

    return res.status(200).json({
      success: true,
      clinic: clinic,
      user: user,
      status: finalPosition.status.toUpperCase(),
      ahead: ahead,
      display_number: position,
      position: position
    });

  } catch (error) {
    console.error('Error in api/v1/queue/enter.js:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
