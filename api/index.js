/**
 * Main API Router for Vercel Serverless Functions
 * Routes all /api/* requests to appropriate handlers
 * Self-contained version
 */

// @ts-nocheck
import { initializeKVStores } from './lib/supabase-enhanced.js';
import { 
  parseBody, 
  setCorsHeaders, 
  getClientIP, 
  checkRateLimit,
  validatePersonalId,
  validateGender,
  normalizeGender,
  validateClinicId,
  generateSessionId,
  generatePIN,
  formatError,
  formatSuccess,
  logRequest,
  handleError
} from './lib/helpers-enhanced.js';

// Initialize Supabase Client
const { supabase } = initializeKVStores(process.env);

export default async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const query = Object.fromEntries(url.searchParams);

  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try { body = await parseBody(req); } catch (e) {}
  }

  console.log(`[API] ${method} ${pathname}`);

  try {
    // ==================== PIN STATUS ====================
    if (pathname.includes('/pin/status') && method === 'GET') {
      const { clinic } = query;
      if (!clinic) return res.status(400).json(formatError('Missing clinic', 'MISSING_CLINIC'));

      const { data: clinicData, error } = await supabase
        .from('clinics')
        .select('id, pin_code, pin_expires_at, name_ar')
        .eq('id', clinic)
        .single();

      if (error || !clinicData) {
         return res.status(200).json(formatSuccess({
             success: true,
             clinic,
             pin: null,
             isExpired: true,
             message: 'Clinic not found'
         }));
      }

      const now = new Date();
      const expires = clinicData.pin_expires_at ? new Date(clinicData.pin_expires_at) : null;
      // Allow 5 minutes grace or just strict check
      const isActive = clinicData.pin_code && expires && expires > now;

      // Force return PIN for Admin usage
      return res.status(200).json(formatSuccess({
        success: true,
        clinic: clinic,
        clinicName: clinicData.name_ar,
        pin: clinicData.pin_code, // ALWAYS RETURN PIN
        isExpired: !isActive,
        validUntil: clinicData.pin_expires_at,
        serverTime: now.toISOString()
      }));
    }

    // ==================== PIN GENERATE ====================
    if (pathname.includes('/pin/generate') && method === 'POST') {
      const { clinicId } = body;
      if (!clinicId) return res.status(400).json(formatError('Missing clinicId', 'MISSING_ID'));

      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999);

      // Update Clinics
      const { error: updateError } = await supabase
        .from('clinics')
        .update({
            pin_code: pin,
            pin_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', clinicId);

      if (updateError) {
          console.error('DB Update Error', updateError);
          return res.status(500).json(formatError('DB Error', 'DB_ERROR'));
      }

      // Log to Pins
      await supabase.from('pins').insert({
          clinic_code: clinicId,
          pin: pin,
          is_active: true,
          expires_at: expiresAt.toISOString()
      });

      return res.status(200).json(formatSuccess({
          pin,
          expiresAt: expiresAt.toISOString()
      }));
    }

    // ==================== QUEUE SYSTEM ====================
    // Get queue number for patient
    if (pathname.includes('/queue/get-number') && method === 'POST') {
      const { patientId, clinicId, examType } = body;
      
      if (!patientId || !clinicId || !examType) {
        return res.status(400).json(formatError('Missing required fields', 'MISSING_FIELDS'));
      }

      try {
        // Call RPC function
        const { data, error } = await supabase.rpc('get_next_queue_number', {
          p_patient_id: patientId,
          p_clinic_id: clinicId,
          p_exam_type: examType
        });

        if (error) {
          console.error('RPC Error:', error);
          return res.status(500).json(formatError('Failed to get queue number', 'RPC_ERROR'));
        }

        return res.status(200).json(formatSuccess({
          patientId,
          clinicId,
          examType,
          queueNumber: data || 0,
          date: new Date().toISOString().split('T')[0]
        }));
      } catch (error) {
        console.error('Queue Error:', error);
        return res.status(500).json(formatError(error.message, 'QUEUE_ERROR'));
      }
    }

    // Get queue status
    if (pathname.includes('/queue/status') && method === 'GET') {
      const { patientId, clinicId, examType } = query;
      
      if (!patientId || !clinicId || !examType) {
        return res.status(400).json(formatError('Missing required fields', 'MISSING_FIELDS'));
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
          .single();

        if (error || !data) {
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
        console.error('Queue Status Error:', error);
        return res.status(500).json(formatError(error.message, 'QUEUE_STATUS_ERROR'));
      }
    }

    // Update queue status
    if (pathname.includes('/queue/update-status') && method === 'POST') {
      const { patientId, clinicId, examType, status } = body;
      
      if (!patientId || !clinicId || !examType || !status) {
        return res.status(400).json(formatError('Missing required fields', 'MISSING_FIELDS'));
      }

      const validStatuses = ['assigned', 'active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json(formatError('Invalid status', 'INVALID_STATUS'));
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
          console.error('Update Error:', error);
          return res.status(500).json(formatError('Failed to update status', 'UPDATE_ERROR'));
        }

        return res.status(200).json(formatSuccess({
          success: true,
          message: 'Queue status updated successfully',
          data
        }));
      } catch (error) {
        console.error('Queue Update Error:', error);
        return res.status(500).json(formatError(error.message, 'QUEUE_UPDATE_ERROR'));
      }
    }

    // ==================== ADMIN STATUS ====================
    if (pathname.includes('/admin/status') && method === 'GET') {
        return res.status(200).json(formatSuccess({
            status: 'operational',
            mode: 'direct_vercel_node',
            timestamp: new Date().toISOString()
        }));
    }

    // Fallback
    return res.status(404).json(formatError('Endpoint not found', 'NOT_FOUND', { path: pathname }));

  } catch (error) {
    console.error('Handler Error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
