/**
 * API Handlers - Main API Request Handlers
 * 
 * @module lib/api-handlers
 * @description Comprehensive API handlers with validation, error handling,
 * and security features for the Military Medical Committee System.
 * @version 2.0.0
 */

import { initializeKVStores } from './supabase-enhanced.js';
import { createAdminToken, verifyAdminBearerToken as verifyAdminBearer, hasValidAdminSecret, hashPassword, validatePassword, resolveAdminLoginStatus } from './admin-auth.js';
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
  handleError,
} from './helpers-enhanced.js';
import { optimizeRoute, createOptimizedRoute } from './routing.js';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  generateAnnualReport,
  generateAnnualReport as generateYearlyReport,
} from './reports.js';

// Initialize Supabase-backed KV stores
const {
  KV_ADMIN, KV_PINS, KV_QUEUES, KV_EVENTS, KV_LOCKS, KV_CACHE, supabase,
} = initializeKVStores(process.env);

/**
 * Verifies admin bearer token from authorization header
 * @param {string} authorizationHeader - Authorization header value
 * @returns {boolean} Whether token is valid
 */
function verifyAdminBearerToken(authorizationHeader) {
  return verifyAdminBearer(authorizationHeader, process.env.ADMIN_AUTH_SECRET);
}

/**
 * Gets authorization header from request headers
 * @param {Object} headers - Request headers
 * @returns {string} Authorization header value
 */
function getAuthorizationHeader(headers = {}) {
  return headers.authorization || headers.Authorization || '';
}

/**
 * Validates request body against schema
 * @param {Object} body - Request body
 * @param {Array} requiredFields - Required field names
 * @returns {Object} Validation result
 */
function validateBody(body, requiredFields = []) {
  const errors = [];
  
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>\"']/g, '');
}

/**
 * Main API Handler
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get client IP and check rate limit
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, 100, 60000);

  if (!rateLimit.allowed) {
    return res.status(429).json(formatError('Too many requests', 'RATE_LIMIT_EXCEEDED', {
      resetAt: new Date(rateLimit.resetAt).toISOString(),
    }));
  }

  // Parse URL and method
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url, `https://${host}`);
  const { pathname } = url;
  const { method } = req;
  const query = Object.fromEntries(url.searchParams);

  // Log request
  logRequest(req, { pathname, method });

  // Parse body for write requests
  let body = {};
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    try {
      if (req._mmcParsedBody && typeof req._mmcParsedBody === 'object') {
        body = req._mmcParsedBody;
      } else if (req.body && typeof req.body === 'object') {
        body = req.body;
      } else {
        body = await parseBody(req);
      }
    } catch (error) {
      console.error('[API_HANDLERS] Body parse error:', error);
      return res.status(400).json(formatError('Invalid request body', 'INVALID_BODY'));
    }
  }

  try {
    // ==================== STATUS & HEALTH ====================

    if (pathname === '/api/v1/status' && method === 'GET') {
      // Check database connectivity
      let dbStatus = 'healthy';
      try {
        const { error } = await supabase.from('clinics').select('id', { count: 'exact', head: true });
        if (error) dbStatus = 'degraded';
      } catch (e) {
        dbStatus = 'unhealthy';
      }

      return res.status(200).json(formatSuccess({
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        mode: 'online',
        backend: 'up',
        platform: 'vercel',
        timestamp: new Date().toISOString(),
        db: dbStatus,
        kv: {
          admin: true,
          pins: true,
          queues: true,
          events: true,
          locks: true,
          cache: true,
        },
      }));
    }

    // ==================== CLINICS ====================

    if (pathname === '/api/v1/clinics' && method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('clinics')
          .select('*')
          .order('name_ar', { ascending: true });

        if (error) throw error;

        return res.status(200).json(formatSuccess(data || []));
      } catch (error) {
        console.error('[API_HANDLERS] Get clinics error:', error);
        return res.status(500).json(formatError('Failed to fetch clinics', 'DB_ERROR'));
      }
    }

    // ==================== PATIENT MANAGEMENT ====================

    if ((pathname === '/api/v1/patient/login' || pathname === '/api/v1/patients/login') && method === 'POST') {
      // Validate request body
      const validation = validateBody(body, ['personalId', 'gender']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_FIELDS'));
      }

      const { personalId, gender } = body;

      // Validate inputs
      if (!validatePersonalId(personalId)) {
        return res.status(400).json(formatError('Invalid personal ID format', 'INVALID_PERSONAL_ID'));
      }

      if (!validateGender(gender)) {
        return res.status(400).json(formatError('Invalid gender', 'INVALID_GENDER'));
      }

      // Generate session
      const sessionId = generateSessionId();
      const normalizedGender = normalizeGender(gender);

      const sessionData = {
        personalId: sanitizeString(personalId),
        gender: normalizedGender,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ip: clientIP,
      };

      try {
        await KV_ADMIN.put(`session:${sessionId}`, sessionData, { expirationTtl: 86400 });

        return res.status(200).json(formatSuccess({
          sessionId,
          expiresAt: sessionData.expiresAt,
          personalId: sessionData.personalId,
          gender: sessionData.gender,
        }, 'Login successful'));
      } catch (error) {
        console.error('[API_HANDLERS] Session creation error:', error);
        return res.status(500).json(formatError('Failed to create session', 'SESSION_ERROR'));
      }
    }

    if (pathname.startsWith('/api/v1/patient/') && method === 'GET') {
      const sessionId = pathname.split('/').pop();

      if (!sessionId) {
        return res.status(400).json(formatError('Missing session ID', 'MISSING_SESSION_ID'));
      }

      try {
        const sessionData = await KV_ADMIN.get(`session:${sessionId}`);

        if (!sessionData) {
          return res.status(404).json(formatError('Session not found', 'SESSION_NOT_FOUND'));
        }

        // Check expiration
        if (new Date(sessionData.expiresAt) < new Date()) {
          return res.status(401).json(formatError('Session expired', 'SESSION_EXPIRED'));
        }

        return res.status(200).json(formatSuccess({
          personalId: sessionData.personalId,
          gender: sessionData.gender,
          createdAt: sessionData.createdAt,
          expiresAt: sessionData.expiresAt,
        }));
      } catch (error) {
        console.error('[API_HANDLERS] Session fetch error:', error);
        return res.status(500).json(formatError('Failed to fetch session', 'SESSION_ERROR'));
      }
    }

    // ==================== QUEUE MANAGEMENT ====================

    if (pathname === '/api/v1/queue/enter' && method === 'POST') {
      const validation = validateBody(body, ['sessionId', 'clinicId']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_FIELDS'));
      }

      const { sessionId, clinicId, patientName, examType } = body;

      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      // Verify session
      let sessionData;
      try {
        sessionData = await KV_ADMIN.get(`session:${sessionId}`);
        if (!sessionData) {
          return res.status(401).json(formatError('Invalid session', 'INVALID_SESSION'));
        }
        if (new Date(sessionData.expiresAt) < new Date()) {
          return res.status(401).json(formatError('Session expired', 'SESSION_EXPIRED'));
        }
      } catch (error) {
        console.error('[API_HANDLERS] Session verification error:', error);
        return res.status(500).json(formatError('Failed to verify session', 'SESSION_ERROR'));
      }

      // Get or create queue
      const queueKey = `queue:${clinicId}`;
      let queue;
      try {
        queue = await KV_QUEUES.get(queueKey) || { patients: [], current: 0, lastUpdated: null };
      } catch (error) {
        console.error('[API_HANDLERS] Queue fetch error:', error);
        queue = { patients: [], current: 0, lastUpdated: null };
      }

      // Check if already in queue
      const existingIndex = queue.patients.findIndex((p) => p.sessionId === sessionId);
      if (existingIndex !== -1) {
        return res.status(200).json(formatSuccess({
          position: existingIndex + 1,
          queueLength: queue.patients.length,
          estimatedWait: (existingIndex + 1) * 5,
          alreadyInQueue: true,
        }));
      }

      // Add patient to queue
      const position = queue.patients.length + 1;
      queue.patients.push({
        sessionId,
        personalId: sessionData.personalId,
        patientName: patientName || null,
        examType: examType || null,
        position,
        enteredAt: new Date().toISOString(),
      });

      queue.lastUpdated = new Date().toISOString();

      try {
        await KV_QUEUES.put(queueKey, queue);

        // Emit event
        await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
          type: 'PATIENT_ENTERED',
          clinicId,
          sessionId,
          position,
          timestamp: new Date().toISOString(),
        }, { expirationTtl: 3600 });

        // Also insert into database for persistence
        try {
          await supabase.from('queues').insert({
            patient_id: sessionData.personalId,
            clinic_id: clinicId,
            exam_type: examType,
            status: 'waiting',
            display_number: position,
            entered_at: new Date().toISOString(),
          });
        } catch (dbError) {
          console.warn('[API_HANDLERS] DB insert warning:', dbError);
          // Continue even if DB insert fails (KV is primary)
        }

        return res.status(200).json(formatSuccess({
          position,
          queueLength: queue.patients.length,
          estimatedWait: position * 5,
          display_number: position,
        }, 'Successfully entered queue'));
      } catch (error) {
        console.error('[API_HANDLERS] Queue update error:', error);
        return res.status(500).json(formatError('Failed to enter queue', 'QUEUE_ERROR'));
      }
    }

    if (pathname === '/api/v1/queue/status' && method === 'GET') {
      const clinicId = query.clinicId || query.clinic;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing required parameter: clinicId|clinic', 'MISSING_CLINIC_ID'));
      }

      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      try {
        const queueKey = `queue:${clinicId}`;
        const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: 0, lastUpdated: null };

        // Also fetch from database for complete picture
        let dbQueues = [];
        try {
          const { data } = await supabase
            .from('queues')
            .select('*')
            .eq('clinic_id', clinicId)
            .in('status', ['waiting', 'serving', 'called'])
            .order('display_number', { ascending: true });
          dbQueues = data || [];
        } catch (dbError) {
          console.warn('[API_HANDLERS] DB fetch warning:', dbError);
        }

        return res.status(200).json(formatSuccess({
          clinicId,
          queueLength: queue.patients.length,
          currentNumber: queue.current,
          patients: queue.patients.map((p) => ({
            position: p.position,
            patientId: p.personalId,
            enteredAt: p.enteredAt,
          })),
          dbPatients: dbQueues.map(q => ({
            id: q.id,
            position: q.display_number,
            status: q.status,
            patientId: q.patient_id,
          })),
          lastUpdated: queue.lastUpdated,
        }));
      } catch (error) {
        console.error('[API_HANDLERS] Queue status error:', error);
        return res.status(500).json(formatError('Failed to fetch queue status', 'QUEUE_ERROR'));
      }
    }

    if (pathname === '/api/v1/queue/call' && method === 'POST') {
      const validation = validateBody(body, ['clinicId']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_CLINIC_ID'));
      }

      const { clinicId } = body;

      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      try {
        const queueKey = `queue:${clinicId}`;
        const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: 0, lastUpdated: null };

        if (queue.patients.length === 0) {
          return res.status(200).json(formatSuccess({
            clinicId,
            currentNumber: queue.current,
            message: 'Queue is empty',
          }));
        }

        // Call next patient
        const nextPatient = queue.patients.shift();
        queue.current = nextPatient.position;
        queue.lastUpdated = new Date().toISOString();

        await KV_QUEUES.put(queueKey, queue);

        // Update database
        try {
          await supabase
            .from('queues')
            .update({ 
              status: 'called', 
              called_at: new Date().toISOString() 
            })
            .eq('clinic_id', clinicId)
            .eq('patient_id', nextPatient.personalId)
            .eq('status', 'waiting');
        } catch (dbError) {
          console.warn('[API_HANDLERS] DB update warning:', dbError);
        }

        // Emit event
        await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
          type: 'PATIENT_CALLED',
          clinicId,
          sessionId: nextPatient.sessionId,
          position: nextPatient.position,
          timestamp: new Date().toISOString(),
        }, { expirationTtl: 3600 });

        return res.status(200).json(formatSuccess({
          clinicId,
          currentNumber: queue.current,
          patient: nextPatient,
        }, 'Patient called successfully'));
      } catch (error) {
        console.error('[API_HANDLERS] Call next error:', error);
        return res.status(500).json(formatError('Failed to call next patient', 'CALL_ERROR'));
      }
    }

    // ==================== PIN MANAGEMENT ====================

    if (pathname === '/api/v1/pin/verify' && method === 'POST') {
      const validation = validateBody(body, ['pin', 'clinicId']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_FIELDS'));
      }

      const { pin, clinicId } = body;
      const normalizedPin = String(pin).trim();

      try {
        // First check KV store
        const storedPinData = await KV_PINS.get(`pin:${clinicId}`);

        if (storedPinData) {
          if (storedPinData.pin !== normalizedPin) {
            return res.status(401).json(formatError('Invalid PIN', 'INVALID_PIN'));
          }

          if (new Date(storedPinData.expiresAt) < new Date()) {
            return res.status(401).json(formatError('PIN expired', 'PIN_EXPIRED'));
          }

          return res.status(200).json(formatSuccess({
            verified: true,
            valid: true,
            clinicId,
            source: 'kv'
          }, 'PIN verified successfully'));
        }

        // Fallback to database
        const { data: dbPin, error } = await supabase
          .from('pins')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('pin', normalizedPin)
          .is('used_at', null)
          .gte('valid_until', new Date().toISOString())
          .maybeSingle();

        if (error || !dbPin) {
          return res.status(401).json(formatError('Invalid PIN', 'INVALID_PIN'));
        }

        return res.status(200).json(formatSuccess({
          verified: true,
          valid: true,
          clinicId,
          source: 'db'
        }, 'PIN verified successfully'));
      } catch (error) {
        console.error('[API_HANDLERS] PIN verify error:', error);
        return res.status(500).json(formatError('Failed to verify PIN', 'PIN_ERROR'));
      }
    }

    if (pathname === '/api/v1/pin/validate' && method === 'POST') {
      const validation = validateBody(body, ['pin', 'clinicId']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_FIELDS'));
      }

      const { pin, clinicId } = body;
      const normalizedPin = String(pin).trim();

      try {
        const { data: pinData, error } = await supabase
          .from('pins')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('pin', normalizedPin)
          .is('used_at', null)
          .gte('valid_until', new Date().toISOString())
          .maybeSingle();

        if (error || !pinData) {
          return res.status(200).json(formatSuccess({
            valid: false,
            verified: false,
            isValid: false,
          }));
        }

        return res.status(200).json(formatSuccess({
          valid: true,
          verified: true,
          isValid: true,
          pin: pinData,
        }));
      } catch (error) {
        console.error('[API_HANDLERS] PIN validate error:', error);
        return res.status(500).json(formatError('Failed to validate PIN', 'PIN_ERROR'));
      }
    }

    if (pathname === '/api/v1/pin/status' && method === 'GET') {
      const clinicId = query.clinicId || query.clinic;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing clinicId parameter', 'MISSING_CLINIC_ID'));
      }

      try {
        const { data: pinData, error } = await supabase
          .from('pins')
          .select('*')
          .eq('clinic_id', clinicId)
          .is('used_at', null)
          .gte('valid_until', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        return res.status(200).json(formatSuccess({
          has_active_pin: !!pinData,
          pin: pinData?.pin || null,
          valid_until: pinData?.valid_until || null,
          checked_at: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('[API_HANDLERS] PIN status error:', error);
        return res.status(500).json(formatError('Failed to get PIN status', 'PIN_ERROR'));
      }
    }

    if (pathname === '/api/v1/pin/generate' && method === 'POST') {
      const validation = validateBody(body, ['clinic_id']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_CLINIC_ID'));
      }

      const { clinic_id } = body;

      if (!validateClinicId(clinic_id)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      try {
        // Generate new PIN
        const newPin = generatePIN();
        const expiresAt = new Date();
        expiresAt.setHours(23, 59, 59, 999);

        // Insert into database
        const { data: pinData, error } = await supabase
          .from('pins')
          .insert({
            clinic_id,
            pin: newPin,
            valid_until: expiresAt.toISOString(),
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        // Also store in KV
        await KV_PINS.put(`pin:${clinic_id}`, {
          pin: newPin,
          expiresAt: expiresAt.toISOString(),
          createdAt: new Date().toISOString(),
        });

        return res.status(200).json(formatSuccess({
          pin: newPin,
          valid_until: expiresAt.toISOString(),
          clinic_id,
        }, 'PIN generated successfully'));
      } catch (error) {
        console.error('[API_HANDLERS] PIN generate error:', error);
        return res.status(500).json(formatError('Failed to generate PIN', 'PIN_ERROR'));
      }
    }

    // ==================== QUEUE DONE/COMPLETE ====================

    if (pathname === '/api/v1/queue/done' && method === 'POST') {
      const validation = validateBody(body, ['clinicId', 'patientId', 'pin']);
      if (!validation.valid) {
        return res.status(400).json(formatError(validation.errors.join(', '), 'MISSING_FIELDS'));
      }

      const { clinicId, patientId, pin } = body;
      const normalizedPin = String(pin).trim();
      const nowIso = new Date().toISOString();

      try {
        // Verify PIN
        const { data: pinData, error: pinError } = await supabase
          .from('pins')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('pin', normalizedPin)
          .is('used_at', null)
          .gte('valid_until', nowIso)
          .maybeSingle();

        if (pinError || !pinData) {
          return res.status(401).json(formatError('Invalid or expired PIN', 'INVALID_PIN'));
        }

        // Complete queue entry
        const { data: completedRows, error: queueError } = await supabase
          .from('queues')
          .update({
            status: 'completed',
            completed_at: nowIso,
            completed_by_pin: normalizedPin,
          })
          .eq('clinic_id', clinicId)
          .eq('patient_id', patientId)
          .in('status', ['waiting', 'called', 'serving', 'in_service', 'in_progress'])
          .select('id, clinic_id, patient_id, status, completed_at');

        if (queueError) {
          throw queueError;
        }

        if (!completedRows || completedRows.length === 0) {
          return res.status(404).json(formatError('Active queue entry not found', 'QUEUE_ENTRY_NOT_FOUND'));
        }

        // Mark PIN as used
        await supabase
          .from('pins')
          .update({ used_at: nowIso })
          .eq('id', pinData.id);

        return res.status(200).json(formatSuccess({
          completed: true,
          clinicId,
          patientId,
          rows: completedRows,
        }, 'Queue item completed successfully'));
      } catch (error) {
        console.error('[API_HANDLERS] Queue done error:', error);
        return res.status(500).json(formatError('Failed to complete queue item', 'QUEUE_COMPLETE_FAILED'));
      }
    }

    // ==================== ADMIN OPERATIONS ====================

    if (pathname === '/api/v1/admin/login' && method === 'POST') {
      const validation = validateBody(body, ['username', 'password']);
      if (!validation.valid) {
        return res.status(400).json(formatError('Missing username or password', 'MISSING_CREDENTIALS'));
      }

      const { username, password } = body;

      try {
        const { data: admin, error: adminError } = await supabase
          .from('admins')
          .select('*')
          .eq('username', sanitizeString(username))
          .maybeSingle();

        if (adminError) {
          console.error('[API_HANDLERS] Admin fetch error:', adminError);
          return res.status(500).json(formatError('Database error during authentication', 'DB_ERROR'));
        }

        const loginStatus = resolveAdminLoginStatus({
          username: sanitizeString(username),
          password,
          admin,
        });

        if (loginStatus !== 200) {
          return res.status(loginStatus).json(formatError('Invalid username or password', 'INVALID_CREDENTIALS'));
        }

        if (!hasValidAdminSecret(process.env.ADMIN_AUTH_SECRET)) {
          return res.status(503).json(formatError('Server admin token configuration is missing or weak', 'ADMIN_SECRET_MISSING'));
        }

        const nowMs = Date.now();
        const token = createAdminToken({
          id: admin?.id || username,
          username: sanitizeString(username),
          role: admin?.role || 'SUPER_ADMIN',
        }, process.env.ADMIN_AUTH_SECRET, nowMs);

        return res.status(200).json(formatSuccess({
          success: true,
          session: {
            username: sanitizeString(username),
            role: admin?.role || 'SUPER_ADMIN',
            token,
            expiresAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString()
          }
        }, 'Login successful'));
      } catch (error) {
        console.error('[API_HANDLERS] Admin login error:', error);
        return res.status(500).json(formatError('Internal server error', 'INTERNAL_ERROR'));
      }
    }

    if (pathname.startsWith('/api/v1/admin/')) {
      const authHeader = getAuthorizationHeader(req.headers);
      if (!verifyAdminBearerToken(authHeader)) {
        return res.status(401).json(formatError('Unauthorized admin access', 'UNAUTHORIZED'));
      }

      // Admin reports route
      if (pathname === '/api/v1/admin/reports/daily' && method === 'GET') {
        try {
          const report = await generateDailyReport(query.date || new Date().toISOString().split('T')[0]);
          return res.status(200).json(formatSuccess(report));
        } catch (error) {
          console.error('[API_HANDLERS] Report error:', error);
          return res.status(500).json(formatError('Failed to generate report', 'REPORT_ERROR'));
        }
      }

      // ==================== ADMIN USERS MANAGEMENT ====================
      
      // Get all users
      if (pathname === '/api/v1/admin/users' && method === 'GET') {
        try {
          const { data: users, error } = await supabase
            .from('admins')
            .select('id, username, role, created_at, last_login, is_active')
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.status(200).json(formatSuccess(users || []));
        } catch (error) {
          console.error('[API_HANDLERS] Get users error:', error);
          return res.status(500).json(formatError('Failed to fetch users', 'USERS_ERROR'));
        }
      }

      // Create new user
      if (pathname === '/api/v1/admin/users' && method === 'POST') {
        const validation = validateBody(body, ['username', 'password', 'role']);
        if (!validation.valid) {
          return res.status(400).json(formatError(validation.error, 'VALIDATION_ERROR'));
        }

        const { username, password, role } = body;

        try {
          // Check if username already exists
          const { data: existingUser } = await supabase
            .from('admins')
            .select('id')
            .eq('username', username)
            .single();

          if (existingUser) {
            return res.status(409).json(formatError('Username already exists', 'USERNAME_EXISTS'));
          }

          const passwordValidation = validatePassword(password);
          if (!passwordValidation.valid) {
            return res.status(400).json(formatError(passwordValidation.reason, 'WEAK_PASSWORD'));
          }

          const hashedPassword = hashPassword(password);

          // Create user
          const { data: newUser, error } = await supabase
            .from('admins')
            .insert({
              username: sanitizeString(username),
              password_hash: hashedPassword,
              role: role || 'ADMIN',
              is_active: true,
              created_at: new Date().toISOString()
            })
            .select('id, username, role, created_at, is_active')
            .single();

          if (error) throw error;

          return res.status(201).json(formatSuccess(newUser, 'User created successfully'));
        } catch (error) {
          console.error('[API_HANDLERS] Create user error:', error);
          return res.status(500).json(formatError('Failed to create user', 'CREATE_USER_ERROR'));
        }
      }

      // Update user
      if (pathname.startsWith('/api/v1/admin/users/') && method === 'PATCH') {
        const userId = pathname.split('/').pop();
        const { username, password, role, is_active } = body;

        try {
          const updateData = {};
          if (username) updateData.username = sanitizeString(username);
          if (password) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
              return res.status(400).json(formatError(passwordValidation.reason, 'WEAK_PASSWORD'));
            }
            updateData.password_hash = hashPassword(password);
          }
          if (role) updateData.role = role;
          if (is_active !== undefined) updateData.is_active = is_active;
          updateData.updated_at = new Date().toISOString();

          const { data: updatedUser, error } = await supabase
            .from('admins')
            .update(updateData)
            .eq('id', userId)
            .select('id, username, role, created_at, updated_at, is_active')
            .single();

          if (error) throw error;

          return res.status(200).json(formatSuccess(updatedUser, 'User updated successfully'));
        } catch (error) {
          console.error('[API_HANDLERS] Update user error:', error);
          return res.status(500).json(formatError('Failed to update user', 'UPDATE_USER_ERROR'));
        }
      }

      // Delete user
      if (pathname.startsWith('/api/v1/admin/users/') && method === 'DELETE') {
        const userId = pathname.split('/').pop();

        try {
          const { error } = await supabase
            .from('admins')
            .delete()
            .eq('id', userId);

          if (error) throw error;

          return res.status(200).json(formatSuccess({ deleted: true }, 'User deleted successfully'));
        } catch (error) {
          console.error('[API_HANDLERS] Delete user error:', error);
          return res.status(500).json(formatError('Failed to delete user', 'DELETE_USER_ERROR'));
        }
      }

      // ==================== ADMIN PIN CODES MANAGEMENT ====================
      
      // Get all PIN codes
      if (pathname === '/api/v1/admin/pins' && method === 'GET') {
        try {
          const { data: pins, error } = await supabase
            .from('pins')
            .select('*, clinics(name, name_ar)')
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.status(200).json(formatSuccess(pins || []));
        } catch (error) {
          console.error('[API_HANDLERS] Get pins error:', error);
          return res.status(500).json(formatError('Failed to fetch PIN codes', 'PINS_ERROR'));
        }
      }

      // Create new PIN code
      if (pathname === '/api/v1/admin/pins' && method === 'POST') {
        const validation = validateBody(body, ['clinic_id']);
        if (!validation.valid) {
          return res.status(400).json(formatError(validation.error, 'VALIDATION_ERROR'));
        }

        const { clinic_id, pin: customPin, valid_hours = 24 } = body;

        try {
          // Generate PIN if not provided (2 digits only)
          const newPin = customPin ? String(customPin).padStart(2, '0') : generatePIN(2);

          // Calculate expiration
          const validUntil = new Date();
          validUntil.setHours(validUntil.getHours() + valid_hours);

          const { data: newPinData, error } = await supabase
            .from('pins')
            .insert({
              clinic_id,
              pin: newPin,
              valid_until: validUntil.toISOString(),
              created_at: new Date().toISOString(),
              is_active: true
            })
            .select('*')
            .single();

          if (error) throw error;

          return res.status(201).json(formatSuccess(newPinData, 'PIN code created successfully'));
        } catch (error) {
          console.error('[API_HANDLERS] Create PIN error:', error);
          return res.status(500).json(formatError('Failed to create PIN code', 'CREATE_PIN_ERROR'));
        }
      }

      // Delete PIN code
      if (pathname.startsWith('/api/v1/admin/pins/') && method === 'DELETE') {
        const pinId = pathname.split('/').pop();

        try {
          const { error } = await supabase
            .from('pins')
            .delete()
            .eq('id', pinId);

          if (error) throw error;

          return res.status(200).json(formatSuccess({ deleted: true }, 'PIN code deleted successfully'));
        } catch (error) {
          console.error('[API_HANDLERS] Delete PIN error:', error);
          return res.status(500).json(formatError('Failed to delete PIN code', 'DELETE_PIN_ERROR'));
        }
      }
    }

    // ==================== SETTINGS ====================

    if (pathname === '/api/v1/settings' && method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*');

        if (error) throw error;

        // Convert to key-value object
        const settings = {};
        (data || []).forEach(setting => {
          settings[setting.key] = setting.value;
        });

        return res.status(200).json(formatSuccess(settings));
      } catch (error) {
        console.error('[API_HANDLERS] Settings error:', error);
        return res.status(500).json(formatError('Failed to fetch settings', 'SETTINGS_ERROR'));
      }
    }

    // ==================== ROUTING ====================

    if (pathname === '/api/v1/routing/exam-route' && method === 'GET') {
      const { examType, gender } = query;

      if (!examType || !gender) {
        return res.status(400).json(formatError('Missing examType or gender', 'MISSING_PARAMS'));
      }

      try {
        const route = await createOptimizedRoute(examType, gender);
        return res.status(200).json(formatSuccess(route));
      } catch (error) {
        console.error('[API_HANDLERS] Routing error:', error);
        return res.status(500).json(formatError('Failed to get exam route', 'ROUTING_ERROR'));
      }
    }

    // Default 404
    return res.status(404).json(formatError('Route not found', 'NOT_FOUND'));

  } catch (error) {
    console.error('[API_HANDLERS] Unhandled error:', error);
    return handleError(error, res);
  }
}
