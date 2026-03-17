/**
 * Main API Router for Vercel Serverless Functions
 * Routes all /api/* requests to appropriate handlers
 * Enhanced with complete endpoints and proper error handling
 */

import { initializeKVStores } from './supabase-enhanced.js';
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
} from './reports.js';

// Initialize Supabase-backed KV stores
const {
  KV_ADMIN, KV_PINS, KV_QUEUES, KV_EVENTS, KV_LOCKS, KV_CACHE, supabase,
} = initializeKVStores(process.env);

const securityLogger = {
  warn: (event, payload) => {
    console.warn(`[SECURITY] ${event}`, payload);
  },
};

const adminSessionStore = {
  get: async (sessionId) => KV_ADMIN.get(`session:${sessionId}`),
};

let adminSessionResolver = (sessionId) => adminSessionStore.get(sessionId);

function logSecurityEvent(event, req, details = {}) {
  securityLogger.warn(event, {
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
    ip: getClientIP(req),
    userAgent: req.headers['user-agent'] || '',
    ...details,
  });
}

async function validateAdminSession(req) {
  const adminSessionId = req.headers['x-admin-session-id'];

  if (!adminSessionId) {
    return { ok: false, reason: 'missing_admin_session' };
  }

  const session = await adminSessionResolver(adminSessionId);
  if (!session) {
    return { ok: false, reason: 'invalid_admin_session' };
  }

  if (session.role !== 'admin') {
    return { ok: false, reason: 'insufficient_admin_role' };
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return { ok: false, reason: 'admin_session_expired' };
  }

  return { ok: true, session };
}

function getLengthBucket(value) {
  if (!value) return null;
  if (value.length < 16) return '<16';
  if (value.length < 32) return '16-31';
  if (value.length < 64) return '32-63';
  return '64+';
}

function mapSecretsMetadata(secrets) {
  return secrets.map((secret) => ({
    name: secret.name,
    present: Boolean(secret.value),
    lengthBucket: getLengthBucket(secret.value),
  }));
}

export const __securityInternals = {
  mapSecretsMetadata,
  validateAdminSession,
  setAdminSessionResolver: (resolver) => {
    adminSessionResolver = resolver || ((sessionId) => adminSessionStore.get(sessionId));
  },
};

async function writeAuthAudit({ username, success, ip, userAgent, reason }) {
  const payload = {
    email: username || 'unknown',
    success: Boolean(success),
    ip_address: ip || null,
    user_agent: userAgent || null,
    error_message: reason || null,
  };

  try {
    await supabase.from('login_audit').insert(payload);
  } catch (error) {
    console.error('[AuthAudit] failed to write login_audit:', error);
  }

  try {
    await supabase.from('activity_logs').insert({
      action_type: success ? 'admin_login_success' : 'admin_login_failure',
      user_name: username || 'unknown',
      details: reason || (success ? 'login successful' : 'login failed'),
      ip_address: ip || null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // activity_logs قد لا يكون موجوداً في كل البيئات
  }
}

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
  const url = new URL(req.url, `https://${req.headers.host}`);
  const { pathname } = url;
  const { method } = req;
  const query = Object.fromEntries(url.searchParams);

  // Log request
  logRequest(req, { pathname, method });

  // Parse body for POST/PUT requests
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
      return res.status(400).json(formatError('Invalid request body', 'INVALID_BODY'));
    }
  }

  try {
    // ==================== STATUS & HEALTH ====================

    if (pathname === '/api/v1/status' && method === 'GET') {
      return res.status(200).json(formatSuccess({
        status: 'healthy',
        mode: 'online',
        backend: 'up',
        platform: 'vercel',
        timestamp: new Date().toISOString(),
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

    // ==================== PATIENT MANAGEMENT ====================

    if (pathname === '/api/v1/patient/login' && method === 'POST') {
      const { personalId, gender } = body;

      // Validate inputs
      if (!personalId || !gender) {
        return res.status(400).json(formatError('Missing required fields: personalId, gender', 'MISSING_FIELDS'));
      }

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
        personalId,
        gender: normalizedGender,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ip: clientIP,
      };

      await KV_ADMIN.put(`session:${sessionId}`, sessionData, { expirationTtl: 86400 });

      return res.status(200).json(formatSuccess({
        sessionId,
        expiresAt: sessionData.expiresAt,
      }, 'Login successful'));
    }

    if (pathname.startsWith('/api/v1/patient/') && method === 'GET') {
      const sessionId = pathname.split('/').pop();

      if (!sessionId) {
        return res.status(400).json(formatError('Missing session ID', 'MISSING_SESSION_ID'));
      }

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
    }

    // ==================== QUEUE MANAGEMENT ====================

    if (pathname === '/api/v1/queue/enter' && method === 'POST') {
      const { sessionId, clinicId } = body;

      if (!sessionId || !clinicId) {
        return res.status(400).json(formatError('Missing required fields: sessionId, clinicId', 'MISSING_FIELDS'));
      }

      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      // Verify session
      const sessionData = await KV_ADMIN.get(`session:${sessionId}`);
      if (!sessionData) {
        return res.status(401).json(formatError('Invalid session', 'INVALID_SESSION'));
      }

      // Get queue
      const queueKey = `queue:${clinicId}`;
      const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: 0, lastUpdated: null };

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

      // Add patient
      const position = queue.patients.length + 1;
      queue.patients.push({
        sessionId,
        personalId: sessionData.personalId,
        position,
        enteredAt: new Date().toISOString(),
      });

      queue.lastUpdated = new Date().toISOString();

      await KV_QUEUES.put(queueKey, queue);

      // Emit event
      await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
        type: 'PATIENT_ENTERED',
        clinicId,
        sessionId,
        position,
        timestamp: new Date().toISOString(),
      }, { expirationTtl: 3600 });

      return res.status(200).json(formatSuccess({
        position,
        queueLength: queue.patients.length,
        estimatedWait: position * 5,
      }, 'Successfully entered queue'));
    }

    if (pathname === '/api/v1/queue/status' && method === 'GET') {
      const { clinicId } = query;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing required parameter: clinicId', 'MISSING_CLINIC_ID'));
      }

      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      const queueKey = `queue:${clinicId}`;
      const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: 0, lastUpdated: null };

      return res.status(200).json(formatSuccess({
        clinicId,
        queueLength: queue.patients.length,
        currentNumber: queue.current,
        patients: queue.patients.map((p) => ({
          position: p.position,
          enteredAt: p.enteredAt,
        })),
        lastUpdated: queue.lastUpdated,
      }));
    }

    if (pathname === '/api/v1/queue/call' && method === 'POST') {
      const { clinicId } = body;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing required field: clinicId', 'MISSING_CLINIC_ID'));
      }

      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      const queueKey = `queue:${clinicId}`;
      const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: 0, lastUpdated: null };

      if (queue.patients.length === 0) {
        return res.status(200).json(formatSuccess({
          message: 'No patients in queue',
          queueEmpty: true,
        }));
      }

      // Call next patient
      const nextPatient = queue.patients.shift();
      queue.current = nextPatient.position;
      queue.lastUpdated = new Date().toISOString();

      await KV_QUEUES.put(queueKey, queue);

      // Emit event
      await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
        type: 'PATIENT_CALLED',
        clinicId,
        sessionId: nextPatient.sessionId,
        position: nextPatient.position,
        timestamp: new Date().toISOString(),
      }, { expirationTtl: 3600 });

      return res.status(200).json(formatSuccess({
        calledPatient: {
          sessionId: nextPatient.sessionId,
          position: nextPatient.position,
        },
        remainingInQueue: queue.patients.length,
        currentNumber: queue.current,
      }, 'Patient called successfully'));
    }

    if (pathname === '/api/v1/queue/done' && method === 'POST') {
      const { clinicId, patientId, pin } = body;

      if (!clinicId || !patientId || !pin) {
        return res.status(400).json(formatError('Missing required fields: clinicId, patientId, pin', 'MISSING_FIELDS'));
      }

      const nowIso = new Date().toISOString();
      let pinRecord = null;
      let pinMode = null;

      const { data: canonicalPin, error: canonicalPinError } = await supabase
        .from('pins')
        .select('id, clinic_id, pin, valid_until, used_at')
        .eq('clinic_id', clinicId)
        .eq('pin', pin)
        .maybeSingle();

      if (
        !canonicalPinError
        && canonicalPin
        && !canonicalPin.used_at
        && (!canonicalPin.valid_until || new Date(canonicalPin.valid_until) >= new Date())
      ) {
        pinRecord = canonicalPin;
        pinMode = 'canonical';
      }

      if (!pinRecord) {
        const { data: legacyPin, error: legacyPinError } = await supabase
          .from('pins')
          .select('id, clinic_code, pin, expires_at, used_count, max_uses, is_active')
          .eq('clinic_code', clinicId)
          .eq('pin', pin)
          .maybeSingle();

        const legacyValid = !legacyPinError
          && legacyPin
          && legacyPin.is_active !== false
          && Number(legacyPin.used_count || 0) < Number(legacyPin.max_uses || 1)
          && (!legacyPin.expires_at || new Date(legacyPin.expires_at) >= new Date());

        if (legacyValid) {
          pinRecord = legacyPin;
          pinMode = 'legacy';
        }
      }

      if (!pinRecord) {
        return res.status(401).json(formatError('Invalid PIN', 'INVALID_PIN'));
      }

      const { data: completedRows, error: queueError } = await supabase
        .from('queues')
        .update({
          status: 'completed',
          completed_at: nowIso,
          completed_by_pin: pin,
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'called', 'serving', 'in_service', 'in_progress'])
        .select('id, clinic_id, patient_id, status, completed_at');

      if (queueError) {
        return res.status(500).json(formatError('Failed to complete queue item', 'QUEUE_COMPLETE_FAILED'));
      }

      if (!completedRows || completedRows.length === 0) {
        return res.status(404).json(formatError('Active queue entry not found', 'QUEUE_ENTRY_NOT_FOUND'));
      }

      if (pinMode === 'canonical') {
        await supabase
          .from('pins')
          .update({ used_at: nowIso })
          .eq('id', pinRecord.id);
      } else {
        await supabase
          .from('pins')
          .update({
            used_count: Number(pinRecord.used_count || 0) + 1,
            last_used_at: nowIso,
          })
          .eq('id', pinRecord.id);
      }

      return res.status(200).json(formatSuccess({
        completed: true,
        clinicId,
        patientId,
        rows: completedRows,
      }, 'Queue item completed successfully'));
    }


    // ==================== PIN MANAGEMENT ====================

    if (pathname === '/api/v1/pin/generate' && method === 'POST') {
      const { clinicId } = body;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing required field: clinicId', 'MISSING_CLINIC_ID'));
      }

      const pin = generatePIN();
      const dateKey = new Date().toISOString().split('T')[0];

      const pinData = {
        pin,
        clinicId,
        dateKey,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      await KV_PINS.put(`pin:${clinicId}:${dateKey}:${pin}`, pinData, { expirationTtl: 300 });

      return res.status(200).json(formatSuccess({
        pin,
        dateKey,
        expiresAt: pinData.expiresAt,
      }));
    }

    if (pathname === '/api/v1/pin/verify' && method === 'POST') {
      const { pin, clinicId, dateKey } = body;

      if (!pin || !clinicId) {
        return res.status(400).json(formatError('Missing required fields: pin, clinicId', 'MISSING_FIELDS'));
      }

      const useDateKey = dateKey || new Date().toISOString().split('T')[0];
      const pinData = await KV_PINS.get(`pin:${clinicId}:${useDateKey}:${pin}`);

      if (!pinData) {
        return res.status(404).json(formatError('PIN not found', 'PIN_NOT_FOUND'));
      }

      if (new Date(pinData.expiresAt) < new Date()) {
        return res.status(401).json(formatError('PIN expired', 'PIN_EXPIRED'));
      }

      return res.status(200).json(formatSuccess({
        valid: true,
        clinicId: pinData.clinicId,
        dateKey: pinData.dateKey,
      }));
    }

    if (pathname === '/api/v1/pin/status' && method === 'GET') {
      const { clinicId, dateKey } = query;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing required parameter: clinicId', 'MISSING_CLINIC_ID'));
      }

      const useDateKey = dateKey || new Date().toISOString().split('T')[0];

      return res.status(200).json(formatSuccess({
        clinicId,
        dateKey: useDateKey,
        available: true,
      }));
    }

    // ==================== REPORTS ====================

    if (pathname === '/api/v1/reports/daily' && method === 'GET') {
      const report = await generateDailyReport();
      return res.status(200).json(formatSuccess({ report }));
    }

    if (pathname === '/api/v1/reports/weekly' && method === 'GET') {
      const report = await generateWeeklyReport();
      return res.status(200).json(formatSuccess({ report }));
    }

    if (pathname === '/api/v1/reports/monthly' && method === 'GET') {
      const report = await generateMonthlyReport();
      return res.status(200).json(formatSuccess({ report }));
    }

    if (pathname === '/api/v1/reports/annual' && method === 'GET') {
      const report = await generateAnnualReport();
      return res.status(200).json(formatSuccess({ report }));
    }

    // ==================== STATISTICS ====================

    if (pathname === '/api/v1/stats/dashboard' && method === 'GET') {
      // Get all queues
      const queuesData = await KV_QUEUES.list();

      let totalPatients = 0;
      let activeQueues = 0;

      // Type checking
      if (!queuesData || !Array.isArray(queuesData.keys)) {
        console.error('[stats/dashboard] Invalid queuesData format:', queuesData);
        return res.status(500).json(formatError('Internal server error', 'INVALID_DATA_FORMAT'));
      }

      for (const key of queuesData.keys) {
        const queue = await KV_QUEUES.get(key.name);
        if (queue && queue.patients) {
          totalPatients += queue.patients.length;
          if (queue.patients.length > 0) {
            activeQueues++;
          }
        }
      }

      return res.status(200).json(formatSuccess({
        stats: {
          totalPatients,
          activeQueues,
          completedToday: 0,
          averageWaitTime: totalPatients > 0 ? 5 : 0,
        },
      }));
    }

    if (pathname === '/api/v1/stats/queues' && method === 'GET') {
      const queuesData = await KV_QUEUES.list();
      const queues = [];

      // Type checking
      if (!queuesData || !Array.isArray(queuesData.keys)) {
        console.error('[stats/queues] Invalid queuesData format:', queuesData);
        return res.status(500).json(formatError('Internal server error', 'INVALID_DATA_FORMAT'));
      }

      for (const key of queuesData.keys) {
        const queue = await KV_QUEUES.get(key.name);
        if (queue) {
          queues.push({
            clinicId: key.name.replace('queue:', ''),
            length: queue.patients?.length || 0,
            current: queue.current || 0,
            lastUpdated: queue.lastUpdated,
          });
        }
      }

      return res.status(200).json(formatSuccess({ queues }));
    }

    // ==================== EVENTS (SSE) ====================

    if (pathname === '/api/v1/events/stream' && method === 'GET') {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);

      // Cleanup on close
      req.on('close', () => {
        clearInterval(heartbeat);
      });

      return; // Don't end response
    }

    // ==================== ADMIN ====================

    if (pathname === '/api/v1/admin/login' && method === 'POST') {
      const { username, password } = body;
      const userAgent = req.headers['user-agent'] || '';

      if (!username || !password) {
        await writeAuthAudit({
          username,
          success: false,
          ip: clientIP,
          userAgent,
          reason: 'missing_credentials',
        });
        return res.status(400).json(formatError('Missing username or password', 'MISSING_CREDENTIALS'));
      }

      try {
        // التحقق من المستخدم في Supabase
        const { data: admin, error } = await supabase
          .from('admins')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !admin) {
          await writeAuthAudit({
            username,
            success: false,
            ip: clientIP,
            userAgent,
            reason: 'username_not_found',
          });
          return res.status(401).json(formatError('Invalid credentials', 'INVALID_CREDENTIALS'));
        }

        // التحقق من كلمة المرور (plain text أو SHA-256)
        let isPasswordValid = false;

        if (admin.password_hash === password) {
          isPasswordValid = true;
        } else {
          // Try SHA-256
          const crypto = await import('crypto');
          const hash = crypto.createHash('sha256').update(password).digest('hex');
          if (admin.password_hash === hash) {
            isPasswordValid = true;
          }
        }

        if (!isPasswordValid) {
          await writeAuthAudit({
            username,
            success: false,
            ip: clientIP,
            userAgent,
            reason: 'invalid_password',
          });
          return res.status(401).json(formatError('Invalid credentials', 'INVALID_CREDENTIALS'));
        }

        // إنشاء session
        const sessionId = generateSessionId();
        const session = {
          id: sessionId,
          userId: admin.id,
          username: admin.username,
          role: admin.role,
          name: admin.name,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        };

        // حفظ session في Supabase
        await supabase.from('admin_sessions').insert(session);

        // حفظ في KV أيضاً للسرعة
        await KV_ADMIN.put(`session:${sessionId}`, session, { expirationTtl: 1800 });

        await writeAuthAudit({
          username: admin.username,
          success: true,
          ip: clientIP,
          userAgent,
          reason: 'login_success',
        });

        return res.status(200).json(formatSuccess({
          success: true,
          session: {
            id: sessionId,
            username: admin.username,
            role: admin.role,
            name: admin.name,
          },
        }, 'Login successful'));
      } catch (err) {
        console.error('[Admin Login Error]', err);
        await writeAuthAudit({
          username,
          success: false,
          ip: clientIP,
          userAgent,
          reason: 'server_error',
        });
        return res.status(500).json(formatError('Login failed', 'LOGIN_ERROR'));
      }
    }

    if (pathname === '/api/v1/admin/status' && method === 'GET') {
      const queuesData = await KV_QUEUES.list();
      const pinsData = await KV_PINS.list();
      const sessionsData = await KV_ADMIN.list();

      // Type checking
      if (!queuesData || !Array.isArray(queuesData.keys)
          || !pinsData || !Array.isArray(pinsData.keys)
          || !sessionsData || !Array.isArray(sessionsData.keys)) {
        console.error('[admin/status] Invalid data format');
        return res.status(500).json(formatError('Internal server error', 'INVALID_DATA_FORMAT'));
      }

      return res.status(200).json(formatSuccess({
        queues: queuesData.keys.length,
        pins: pinsData.keys.length,
        sessions: sessionsData.keys.length,
        timestamp: new Date().toISOString(),
      }));
    }

    // ==================== QUEUE POSITION ====================

    if (pathname === '/api/v1/queue/position' && method === 'POST') {
      const { clinicId, patientId, sessionId } = body;

      if (!clinicId) {
        return res.status(400).json(formatError('Missing clinicId', 'MISSING_FIELDS'));
      }

      try {
        // Get all waiting patients in this clinic
        const { data: queues, error } = await supabase
          .from('queues')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('status', 'waiting')
          .order('entered_at', { ascending: true });

        if (error) {
          return res.status(500).json(formatError('Failed to fetch queue', 'QUEUE_ERROR'));
        }

        // Find patient position
        let position = -1;
        let displayNumber = null;

        if (patientId) {
          position = queues.findIndex((q) => q.patient_id === patientId);
          if (position >= 0) {
            displayNumber = queues[position].display_number;
          }
        } else if (sessionId) {
          position = queues.findIndex((q) => q.session_id === sessionId);
          if (position >= 0) {
            displayNumber = queues[position].display_number;
          }
        }

        return res.status(200).json(formatSuccess({
          position: position >= 0 ? position : null,
          displayNumber,
          ahead: position >= 0 ? position : null,
          totalWaiting: queues.length,
          inQueue: position >= 0,
        }));
      } catch (err) {
        console.error('[Queue Position Error]', err);
        return res.status(500).json(formatError('Failed to get position', 'POSITION_ERROR'));
      }
    }

    // ==================== CLINIC ====================

    if (pathname === '/api/v1/clinic/exit' && method === 'POST') {
      const { sessionId, clinicId } = body;

      if (!sessionId || !clinicId) {
        return res.status(400).json(formatError('Missing required fields: sessionId, clinicId', 'MISSING_FIELDS'));
      }

      // Emit event
      await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
        type: 'PATIENT_EXIT',
        clinicId,
        sessionId,
        timestamp: new Date().toISOString(),
      }, { expirationTtl: 3600 });

      return res.status(200).json(formatSuccess({}, 'Patient exited clinic'));
    }

    // ==================== ADMIN: Export Secrets ====================

    if (pathname === '/api/v1/admin/export-secrets' && method === 'POST') {
      const adminAuth = await validateAdminSession(req);
      if (!adminAuth.ok) {
        logSecurityEvent('admin_export_denied', req, {
          reason: adminAuth.reason,
          hasExportTokenHeader: Boolean(req.headers['x-export-token']),
        });
        return res.status(403).json(formatError('Forbidden', 'ADMIN_AUTH_REQUIRED'));
      }

      const exportToken = req.headers['x-export-token'];
      const expectedToken = process.env.EXPORT_TOKEN;

      if (!expectedToken) {
        logSecurityEvent('admin_export_misconfigured', req, {
          reason: 'missing_export_token_configuration',
        });
        return res.status(503).json(formatError('Service misconfigured', 'EXPORT_TOKEN_MISSING'));
      }

      if (exportToken !== expectedToken) {
        logSecurityEvent('admin_export_denied', req, {
          reason: 'invalid_export_token',
          hasExportTokenHeader: Boolean(exportToken),
        });
        return res.status(401).json(formatError('Unauthorized', 'UNAUTHORIZED'));
      }

      // جمع المتغيرات البيئية
      const secrets = [
        { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
        { name: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY },
        { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
        { name: 'VITE_SUPABASE_URL', value: process.env.VITE_SUPABASE_URL },
        { name: 'VITE_SUPABASE_ANON_KEY', value: process.env.VITE_SUPABASE_ANON_KEY },
        { name: 'POSTGRES_HOST', value: process.env.POSTGRES_HOST },
        { name: 'POSTGRES_USER', value: process.env.POSTGRES_USER },
        { name: 'POSTGRES_DATABASE', value: process.env.POSTGRES_DATABASE },
        { name: 'API_ORIGIN', value: process.env.API_ORIGIN },
        { name: 'VITE_API_BASE_URL', value: process.env.VITE_API_BASE_URL },
        { name: 'FRONTEND_ORIGIN', value: process.env.FRONTEND_ORIGIN },
        { name: 'VERCEL_URL', value: process.env.VERCEL_URL },
        { name: 'VERCEL_ENV', value: process.env.VERCEL_ENV },
      ];

      const items = mapSecretsMetadata(secrets);

      return res.status(200).json(formatSuccess({
        count: items.filter((item) => item.present).length,
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'unknown',
        items,
      }, 'Secrets exported'));
    }

    // ==================== DEFAULT: 404 ====================

    return res.status(404).json(formatError('Endpoint not found', 'NOT_FOUND', {
      path: pathname,
      method,
    }));
  } catch (error) {
    return handleError(error, res, 500);
  }
}
