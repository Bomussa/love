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
