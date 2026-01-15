/**
 * Queue Management API - Standalone Endpoint
 * Handles all queue-related operations
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10'
);

// Helper functions
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const formatSuccess = (data) => ({ success: true, data });
const formatError = (message, code = 'ERROR') => ({ success: false, error: { message, code } });

export default async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const query = Object.fromEntries(url.searchParams);

  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body || {};
      }
    } catch (e) {
      return res.status(400).json(formatError('Invalid JSON body', 'INVALID_JSON'));
    }
  }

  console.log(`[Queue API] ${method} ${pathname}`, body || query);

  try {
    // ==================== GET QUEUE NUMBER ====================
    if (pathname.includes('/get-number') && method === 'POST') {
      const { patientId, clinicId, examType } = body;
      
      if (!patientId || !clinicId || !examType) {
        return res.status(400).json(formatError('Missing required fields: patientId, clinicId, examType', 'MISSING_FIELDS'));
      }

      try {
        // Call RPC function
        const { data, error } = await supabase.rpc('get_next_queue_number', {
          p_patient_id: patientId,
          p_clinic_id: clinicId,
          p_exam_type: examType
        });

        if (error) {
          console.error('[Queue API] RPC Error:', error);
          return res.status(500).json(formatError(`RPC Error: ${error.message}`, 'RPC_ERROR'));
        }

        console.log(`[Queue API] ✅ Queue number assigned: ${data} for patient ${patientId}`);

        return res.status(200).json(formatSuccess({
          patientId,
          clinicId,
          examType,
          queueNumber: data || 0,
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('[Queue API] Exception:', error);
        return res.status(500).json(formatError(error.message, 'QUEUE_ERROR'));
      }
    }

    // ==================== GET QUEUE STATUS ====================
    if (pathname.includes('/status') && method === 'GET') {
      const { patientId, clinicId, examType } = query;
      
      if (!patientId || !clinicId || !examType) {
        return res.status(400).json(formatError('Missing required query params', 'MISSING_PARAMS'));
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('patient_queue_numbers')
          .select('*')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)
          .eq('exam_type', examType)
          .eq('date', today)
          .maybeSingle();

        if (error) {
          console.error('[Queue API] Query Error:', error);
          return res.status(500).json(formatError(error.message, 'QUERY_ERROR'));
        }

        if (!data) {
          return res.status(200).json(formatSuccess({
            hasQueue: false,
            message: 'No queue number assigned yet'
          }));
        }

        // Count waiting ahead
        const { count } = await supabase
          .from('patient_queue_numbers')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .eq('exam_type', examType)
          .eq('date', today)
          .lt('queue_number', data.queue_number)
          .in('status', ['assigned', 'active']);

        return res.status(200).json(formatSuccess({
          hasQueue: true,
          queueNumber: data.queue_number,
          status: data.status,
          waitingAhead: count || 0,
          assignedAt: data.assigned_at,
          activatedAt: data.activated_at,
          completedAt: data.completed_at
        }));
      } catch (error) {
        console.error('[Queue API] Status Error:', error);
        return res.status(500).json(formatError(error.message, 'STATUS_ERROR'));
      }
    }

    // ==================== UPDATE QUEUE STATUS ====================
    if (pathname.includes('/update-status') && method === 'POST') {
      const { patientId, clinicId, examType, status } = body;
      
      if (!patientId || !clinicId || !examType || !status) {
        return res.status(400).json(formatError('Missing required fields', 'MISSING_FIELDS'));
      }

      const validStatuses = ['assigned', 'active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json(formatError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'INVALID_STATUS'));
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const updateData = {
          status,
          updated_at: new Date().toISOString()
        };

        if (status === 'active') {
          updateData.activated_at = new Date().toISOString();
        } else if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from('patient_queue_numbers')
          .update(updateData)
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)
          .eq('exam_type', examType)
          .eq('date', today)
          .select()
          .single();

        if (error) {
          console.error('[Queue API] Update Error:', error);
          return res.status(500).json(formatError(error.message, 'UPDATE_ERROR'));
        }

        console.log(`[Queue API] ✅ Status updated to ${status} for patient ${patientId}`);

        return res.status(200).json(formatSuccess({
          success: true,
          message: 'Queue status updated successfully',
          data
        }));
      } catch (error) {
        console.error('[Queue API] Update Exception:', error);
        return res.status(500).json(formatError(error.message, 'UPDATE_EXCEPTION'));
      }
    }

    // ==================== HEALTH CHECK ====================
    if (pathname.includes('/health') && method === 'GET') {
      return res.status(200).json(formatSuccess({
        status: 'healthy',
        service: 'queue-api',
        timestamp: new Date().toISOString()
      }));
    }

    // Fallback
    return res.status(404).json(formatError('Endpoint not found', 'NOT_FOUND', { path: pathname }));

  } catch (error) {
    console.error('[Queue API] Handler Error:', error);
    return res.status(500).json(formatError(error.message, 'INTERNAL_ERROR'));
  }
}
