/**
 * Main API Router for Vercel Serverless Functions
 * Routes all /api/* requests to appropriate handlers
 * Enhanced with complete endpoints and proper error handling
 */

import { initializeKVStores } from '../lib/supabase-enhanced.js';

// Initialize Supabase-backed KV stores
const { KV_ADMIN, KV_PINS, KV_QUEUES, KV_EVENTS, KV_LOCKS, KV_CACHE, supabase } = initializeKVStores(process.env);
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
} from '../lib/helpers-enhanced.js';
import { optimizeRoute, createOptimizedRoute } from '../lib/routing.js';
import { 
  generateDailyReport, 
  generateWeeklyReport, 
  generateMonthlyReport, 
  generateAnnualReport 
} from '../lib/reports.js';

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
      resetAt: new Date(rateLimit.resetAt).toISOString()
    }));
  }

  // Parse URL and method
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const query = Object.fromEntries(url.searchParams);

  // Log request
  logRequest(req, { pathname, method });

  // Parse body for POST/PUT requests
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await parseBody(req);
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
          cache: true
        }
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
        ip: clientIP
      };

      await KV_ADMIN.put(`session:${sessionId}`, sessionData, { expirationTtl: 86400 });

      return res.status(200).json(formatSuccess({
        sessionId,
        expiresAt: sessionData.expiresAt
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
        expiresAt: sessionData.expiresAt
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
      const existingIndex = queue.patients.findIndex(p => p.sessionId === sessionId);
      if (existingIndex !== -1) {
        return res.status(200).json(formatSuccess({
          position: existingIndex + 1,
          queueLength: queue.patients.length,
          estimatedWait: (existingIndex + 1) * 5,
          alreadyInQueue: true
        }));
      }
      
      // Add patient
      const position = queue.patients.length + 1;
      queue.patients.push({
        sessionId,
        personalId: sessionData.personalId,
        position,
        enteredAt: new Date().toISOString()
      });
      
      queue.lastUpdated = new Date().toISOString();
      
      await KV_QUEUES.put(queueKey, queue);
      
      // Emit event
      await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
        type: 'PATIENT_ENTERED',
        clinicId,
        sessionId,
        position,
        timestamp: new Date().toISOString()
      }, { expirationTtl: 3600 });
      
      return res.status(200).json(formatSuccess({
        position,
        queueLength: queue.patients.length,
        estimatedWait: position * 5
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
        patients: queue.patients.map(p => ({
          position: p.position,
          enteredAt: p.enteredAt
        })),
        lastUpdated: queue.lastUpdated
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
          queueEmpty: true
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
        timestamp: new Date().toISOString()
      }, { expirationTtl: 3600 });
      
      return res.status(200).json(formatSuccess({
        calledPatient: {
          sessionId: nextPatient.sessionId,
          position: nextPatient.position
        },
        remainingInQueue: queue.patients.length,
        currentNumber: queue.current
      }, 'Patient called successfully'));
    }

    if (pathname === '/api/v1/queue/done' && method === 'POST') {
      const { sessionId, clinicId } = body;
      
      if (!sessionId || !clinicId) {
        return res.status(400).json(formatError('Missing required fields: sessionId, clinicId', 'MISSING_FIELDS'));
      }
      
      // Emit event
      await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
        type: 'PATIENT_DONE',
        clinicId,
        sessionId,
        timestamp: new Date().toISOString()
      }, { expirationTtl: 3600 });
      
      return res.status(200).json(formatSuccess({}, 'Patient marked as done'));
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
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };

      await KV_PINS.put(`pin:${clinicId}:${dateKey}:${pin}`, pinData, { expirationTtl: 300 });

      return res.status(200).json(formatSuccess({
        pin,
        dateKey,
        expiresAt: pinData.expiresAt
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
        dateKey: pinData.dateKey
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
        available: true
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
          averageWaitTime: totalPatients > 0 ? 5 : 0
        }
      }));
    }

    if (pathname === '/api/v1/stats/queues' && method === 'GET') {
      const queuesData = await KV_QUEUES.list();
      const queues = [];
      
      for (const key of queuesData.keys) {
        const queue = await KV_QUEUES.get(key.name);
        if (queue) {
          queues.push({
            clinicId: key.name.replace('queue:', ''),
            length: queue.patients?.length || 0,
            current: queue.current || 0,
            lastUpdated: queue.lastUpdated
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
      
      if (!username || !password) {
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
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        };
        
        // حفظ session في Supabase
        await supabase.from('admin_sessions').insert(session);
        
        // حفظ في KV أيضاً للسرعة
        await KV_ADMIN.put(`session:${sessionId}`, session, { expirationTtl: 1800 });
        
        return res.status(200).json(formatSuccess({
          success: true,
          session: {
            id: sessionId,
            username: admin.username,
            role: admin.role,
            name: admin.name
          }
        }, 'Login successful'));
      } catch (err) {
        console.error('[Admin Login Error]', err);
        return res.status(500).json(formatError('Login failed', 'LOGIN_ERROR'));
      }
    }
    
    if (pathname === '/api/v1/admin/status' && method === 'GET') {
      const queuesData = await KV_QUEUES.list();
      const pinsData = await KV_PINS.list();
      const sessionsData = await KV_ADMIN.list();
      
      return res.status(200).json(formatSuccess({
        queues: queuesData.keys.length,
        pins: pinsData.keys.length,
        sessions: sessionsData.keys.length,
        timestamp: new Date().toISOString()
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
          .order('created_at', { ascending: true });
        
        if (error) {
          return res.status(500).json(formatError('Failed to fetch queue', 'QUEUE_ERROR'));
        }
        
        // Find patient position
        let position = -1;
        let displayNumber = null;
        
        if (patientId) {
          position = queues.findIndex(q => q.patient_id === patientId);
          if (position >= 0) {
            displayNumber = queues[position].display_number;
          }
        } else if (sessionId) {
          position = queues.findIndex(q => q.session_id === sessionId);
          if (position >= 0) {
            displayNumber = queues[position].display_number;
          }
        }
        
        return res.status(200).json(formatSuccess({
          position: position >= 0 ? position : null,
          displayNumber,
          ahead: position >= 0 ? position : null,
          totalWaiting: queues.length,
          inQueue: position >= 0
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
        timestamp: new Date().toISOString()
      }, { expirationTtl: 3600 });
      
      return res.status(200).json(formatSuccess({}, 'Patient exited clinic'));
    }

    // ==================== ADMIN: Export Secrets ====================
    
    if (pathname === '/api/v1/admin/export-secrets' && method === 'POST') {
      const exportToken = req.headers['x-export-token'];
      const expectedToken = process.env.EXPORT_TOKEN || 'default-export-token-change-me';
      
      if (exportToken !== expectedToken) {
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
        { name: 'VERCEL_ENV', value: process.env.VERCEL_ENV }
      ];
      
      const items = secrets
        .filter(s => s.value)
        .map(s => ({
          name: s.name,
          length: s.value.length,
          preview: s.value.substring(0, 20) + '...'
        }));
      
      return res.status(200).json(formatSuccess({
        count: items.length,
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'unknown',
        items: items
      }, 'Secrets exported'));
    }
    
    // ==================== DEFAULT: 404 ====================
    
    return res.status(404).json(formatError('Endpoint not found', 'NOT_FOUND', {
      path: pathname,
      method
    }));

  } catch (error) {
    return handleError(error, res, 500);
  }
}

