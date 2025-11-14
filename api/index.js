/**
 * Main API Router for Vercel Serverless Functions
 * Routes all /api/* requests to appropriate handlers
 * Enhanced with complete endpoints and proper error handling
 */
console.log('API Handler loaded');
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

async function callNextPatientForClinic(clinicId) {
  const lockKey = `lock:queue:${clinicId}`;
  const lockId = Math.random().toString(36).substring(2);

  try {
    const existingLock = await KV_LOCKS.get(lockKey);
    if (existingLock && (Date.now() - new Date(existingLock.createdAt).getTime() < 10000)) {
      console.log(`Queue for clinic ${clinicId} is locked. Skipping.`);
      return { status: 'locked', clinicId };
    }
    await KV_LOCKS.put(lockKey, { owner: lockId, createdAt: new Date().toISOString() }, { expirationTtl: 10 });

    const queueKey = `queue:${clinicId}`;
    const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: null, lastUpdated: null };

    if (queue.current) {
        console.log(`Clinic ${clinicId} is already serving patient #${queue.current.position}. Skipping.`);
        return { status: 'busy', clinicId, patient: queue.current.position };
    }

    if (queue.patients.length === 0) {
      console.log(`No patients in queue for clinic ${clinicId}.`);
      return { status: 'empty', clinicId };
    }

    const nextPatient = queue.patients.shift();
    queue.current = nextPatient;
    queue.lastUpdated = new Date().toISOString();
    await KV_QUEUES.put(queueKey, queue);

    await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
      type: 'PATIENT_CALLED',
      clinicId,
      sessionId: nextPatient.sessionId,
      position: nextPatient.position,
      timestamp: new Date().toISOString()
    }, { expirationTtl: 3600 });

    console.log(`Successfully called patient #${nextPatient.position} for clinic ${clinicId}.`);
    return {
      status: 'called',
      clinicId,
      calledPatient: { sessionId: nextPatient.sessionId, position: nextPatient.position },
      remainingInQueue: queue.patients.length
    };

  } catch(error) {
    console.error(`Error processing queue for clinic ${clinicId}:`, error);
    return { status: 'error', clinicId, error: error.message };
  } finally {
    const finalLock = await KV_LOCKS.get(lockKey);
    if (finalLock && finalLock.owner === lockId) {
      await KV_LOCKS.delete(lockKey);
    }
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

    // ==================== SESSION MANAGEMENT ====================

    if (pathname === '/api/v1/session/start' && method === 'POST') {
        const sessionId = generateSessionId();
        const sessionData = {
            sessionId,
            personalId: null,
            gender: null,
            isAnonymous: true,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            ip: clientIP
        };

        await KV_ADMIN.put(`session:${sessionId}`, sessionData, { expirationTtl: 86400 });

        return res.status(200).json(formatSuccess({
            sessionId,
            expiresAt: sessionData.expiresAt
        }, 'Anonymous session started'));
    }

    // ==================== PATIENT MANAGEMENT ====================
    
    if (pathname === '/api/v1/patient/login' && method === 'POST') {
      const { sessionId, personalId, gender } = body;
      
      if (!sessionId || !personalId || !gender) {
        return res.status(400).json(formatError('Missing required fields: sessionId, personalId, gender', 'MISSING_FIELDS'));
      }
      
      if (!validatePersonalId(personalId)) {
        return res.status(400).json(formatError('Invalid personal ID format', 'INVALID_PERSONAL_ID'));
      }
      
      if (!validateGender(gender)) {
        return res.status(400).json(formatError('Invalid gender', 'INVALID_GENDER'));
      }
      
      const today = new Date().toISOString().split('T')[0];
      const registrationKey = `registration:${today}:${personalId}`;

      const existingRegistration = await KV_ADMIN.get(registrationKey);
      if (existingRegistration) {
          const existingSession = await KV_ADMIN.get(`session:${existingRegistration.sessionId}`);
          return res.status(200).json(formatSuccess({
              ...existingSession,
              isExisting: true
          }, 'Patient already registered today. Returning existing session.'));
      }

      const sessionData = await KV_ADMIN.get(`session:${sessionId}`);
      if (!sessionData) {
          return res.status(404).json(formatError('Session not found', 'SESSION_NOT_FOUND'));
      }

      const normalizedGender = normalizeGender(gender);
      
      const updatedSessionData = {
          ...sessionData,
          personalId,
          gender: normalizedGender,
          isAnonymous: false,
          updatedAt: new Date().toISOString()
      };

      await KV_ADMIN.put(`session:${sessionId}`, updatedSessionData, { expirationTtl: 86400 });
      await KV_ADMIN.put(registrationKey, { sessionId, expiresAt: updatedSessionData.expiresAt }, { expirationTtl: 86400 });

      return res.status(200).json(formatSuccess({
        ...updatedSessionData,
        isExisting: false
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

    // ==================== PATHWAY MANAGEMENT ====================

    if (pathname === '/api/v1/pathway/create' && method === 'POST') {
        const { personalId, examType, gender } = body;
        if (!personalId || !examType || !gender) {
            return res.status(400).json(formatError('Missing required fields: personalId, examType, gender', 'MISSING_FIELDS'));
        }

        try {
            const { data, error } = await supabase.rpc('create_patient_pathway', {
                p_personal_id: personalId,
                p_exam_type: examType,
                p_gender: gender
            });

            if (error) throw error;

            return res.status(200).json(formatSuccess(data, 'Pathway created successfully'));
        } catch (error) {
            console.error('Error creating pathway:', error);
            return handleError(error, res, 500, 'Failed to create pathway');
        }
    }

    // ==================== QUEUE MANAGEMENT ====================
    
    if (pathname === '/api/v1/queue/enter' && method === 'POST') {
      const { sessionId, clinicId, pin } = body;
      
      if (!sessionId || !clinicId) {
        return res.status(400).json(formatError('Missing required fields: sessionId, clinicId', 'MISSING_FIELDS'));
      }
      
      if (!validateClinicId(clinicId)) {
        return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
      }

      // Check if this clinic requires a PIN
      const { data: clinic, error: clinicError } = await supabase.from('clinics').select('requires_pin').eq('id', clinicId).single();
      if(clinicError || !clinic) {
        return res.status(404).json(formatError('Clinic not found', 'CLINIC_NOT_FOUND'));
      }

      if(clinic.requires_pin) {
        if(!pin) {
          return res.status(400).json(formatError('PIN is required for this clinic', 'PIN_REQUIRED'));
        }

        const dateKey = new Date().toISOString().split('T')[0];
        const key = `pin:${clinicId}:${dateKey}:${pin}`;
        const pinData = await KV_PINS.get(key);

        if (!pinData) {
          return res.status(401).json(formatError('PIN not found or invalid', 'PIN_NOT_FOUND'));
        }
        if (new Date(pinData.expiresAt) < new Date()) {
          return res.status(401).json(formatError('PIN expired', 'PIN_EXPIRED'));
        }
      }
      
      const sessionData = await KV_ADMIN.get(`session:${sessionId}`);
      if (!sessionData) {
        return res.status(401).json(formatError('Invalid session', 'INVALID_SESSION'));
      }
      
      const queueKey = `queue:${clinicId}`;
      const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: null, lastUpdated: null };
      
      const existingIndex = queue.patients.findIndex(p => p.sessionId === sessionId);
      if (existingIndex !== -1) {
        return res.status(200).json(formatSuccess({
          position: existingIndex + 1,
          queueLength: queue.patients.length,
          estimatedWait: (existingIndex + 1) * 5,
          alreadyInQueue: true
        }));
      }
      
      const lastPosition = queue.patients.length > 0 ? queue.patients[queue.patients.length - 1].position : (queue.current ? queue.current.position : 0);
      const position = lastPosition + 1;

      queue.patients.push({
        sessionId,
        personalId: sessionData.personalId,
        position,
        enteredAt: new Date().toISOString()
      });
      
      queue.lastUpdated = new Date().toISOString();
      await KV_QUEUES.put(queueKey, queue);
      
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
        estimatedWait: queue.patients.length * 5
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
      const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: null, lastUpdated: null };
      
      return res.status(200).json(formatSuccess({
        clinicId,
        queueLength: queue.patients.length,
        currentNumber: queue.current ? queue.current.position : 0,
        currentlyServing: queue.current,
        patients: queue.patients.map(p => ({
          position: p.position,
          enteredAt: p.enteredAt,
          personalId: p.personalId
        })),
        lastUpdated: queue.lastUpdated
      }));
    }

    if (pathname === '/api/v1/queue/call' && (method === 'POST' || method === 'GET')) {
      const { clinicId } = (method === 'POST' ? body : query);

      // Case 1: A specific clinicId is provided (manual call)
      if (clinicId) {
        if (!validateClinicId(clinicId)) {
          return res.status(400).json(formatError('Invalid clinic ID', 'INVALID_CLINIC_ID'));
        }
        const result = await callNextPatientForClinic(clinicId);

        if (result.status === 'called') {
          return res.status(200).json(formatSuccess({
            ...result,
            message: `Patient called successfully for clinic ${clinicId}`
          }));
        } else if (result.status === 'locked' || result.status === 'busy') {
          return res.status(409).json(formatError(`Clinic ${clinicId} is busy`, 'CLINIC_BUSY'));
        } else {
           return res.status(200).json(formatSuccess({ ...result, message: `No new patient called for clinic ${clinicId}` }));
        }
      }

      // Case 2: No clinicId, triggered by cron (automated call for all clinics)
      console.log('Cron job triggered: processing all active queues.');
      const queueKeys = await KV_QUEUES.list();
      const results = [];

      for (const key of queueKeys.keys) {
        if (key.name.startsWith('queue:')) {
          const currentClinicId = key.name.replace('queue:', '');
          const result = await callNextPatientForClinic(currentClinicId);
          results.push(result);
        }
      }

      const calledCount = results.filter(r => r.status === 'called').length;
      return res.status(200).json(formatSuccess({
          summary: `Processed ${results.length} queues. Called ${calledCount} new patients.`,
          details: results
      }, 'Cron job executed successfully'));
    }

    if (pathname === '/api/v1/queue/done' && method === 'POST') {
      const { sessionId, clinicId } = body;
      
      if (!sessionId || !clinicId) {
        return res.status(400).json(formatError('Missing required fields: sessionId, clinicId', 'MISSING_FIELDS'));
      }
      
      const lockKey = `lock:queue:${clinicId}`;
      const lockId = Math.random().toString(36).substring(2);

      try {
        const existingLock = await KV_LOCKS.get(lockKey);
        if (existingLock && (Date.now() - new Date(existingLock.createdAt).getTime() < 10000)) {
            return res.status(409).json(formatError('Queue is busy, please try again', 'QUEUE_LOCKED'));
        }
        await KV_LOCKS.put(lockKey, { owner: lockId, createdAt: new Date().toISOString() }, { expirationTtl: 10 });

        const queueKey = `queue:${clinicId}`;
        const queue = await KV_QUEUES.get(queueKey) || { patients: [], current: null, lastUpdated: null };

        if (!queue.current || queue.current.sessionId !== sessionId) {
            return res.status(400).json(formatError('Patient is not currently being served or session ID is incorrect', 'PATIENT_NOT_SERVING'));
        }

        queue.current = null;
        queue.lastUpdated = new Date().toISOString();
        await KV_QUEUES.put(queueKey, queue);

        await KV_EVENTS.put(`event:${clinicId}:${Date.now()}`, {
            type: 'PATIENT_DONE',
            clinicId,
            sessionId,
            timestamp: new Date().toISOString()
        }, { expirationTtl: 3600 });

        return res.status(200).json(formatSuccess({ clinicId, cleared: true }, 'Patient marked as done'));

      } finally {
        const finalLock = await KV_LOCKS.get(lockKey);
        if (finalLock && finalLock.owner === lockId) {
            await KV_LOCKS.delete(lockKey);
        }
      }
    }

    // ==================== PIN MANAGEMENT ====================
    
    if (pathname === '/api/v1/pin/generate' && method === 'POST') {
      const { clinicId } = body;
      
      if (!clinicId) {
        return res.status(400).json(formatError('Missing required field: clinicId', 'MISSING_CLINIC_ID'));
      }
      
      const pin = generatePIN();
      const dateKey = new Date().toISOString().split('T')[0];
      const key = `pin:${clinicId}:${dateKey}:${pin}`;
      
      const pinData = {
        pin,
        clinicId,
        dateKey,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };

      await KV_PINS.put(key, pinData, { expirationTtl: 300 });

      console.log(`Generated PIN ${pin} for clinic ${clinicId} with key ${key}`);

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
      const key = `pin:${clinicId}:${useDateKey}:${pin}`;

      console.log(`Verifying PIN with key: ${key}`);

      const pinData = await KV_PINS.get(key);

      if (!pinData) {
        console.log(`PIN not found for key: ${key}`);
        return res.status(404).json(formatError('PIN not found or invalid', 'PIN_NOT_FOUND'));
      }

      console.log(`Found PIN data:`, pinData);

      if (new Date(pinData.expiresAt) < new Date()) {
        console.log(`PIN expired for key: ${key}`);
        return res.status(401).json(formatError('PIN expired', 'PIN_EXPIRED'));
      }

      return res.status(200).json(formatSuccess({
        valid: true,
        clinicId: pinData.clinicId,
        dateKey: pinData.dateKey
      }));
    }

    if (pathname === '/api/v1/pin/status' && method === 'GET') {
      const { dateKey } = query;
      const useDateKey = dateKey || new Date().toISOString().split('T')[0];
      const prefix = `pin:`;

      try {
        const pinsData = await KV_PINS.list(prefix);
        const activePins = {};

        for (const key of pinsData.keys) {
          const pinData = await KV_PINS.get(key.name);
          if (pinData && pinData.dateKey === useDateKey && new Date(pinData.expiresAt) > new Date()) {
            activePins[pinData.clinicId] = pinData.pin;
          }
        }

        return res.status(200).json(formatSuccess({
          date: useDateKey,
          pins: activePins
        }));
      } catch (error) {
        return handleError(error, res, 500);
      }
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
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

      let lastEventCheck = Date.now();

      const eventInterval = setInterval(async () => {
        try {
          const eventKeys = await KV_EVENTS.list();
          const newEvents = [];

          for (const key of eventKeys.keys) {
            const eventTimestamp = parseInt(key.name.split(':').pop(), 10);
            if (eventTimestamp > lastEventCheck) {
              const eventData = await KV_EVENTS.get(key.name);
              if (eventData) {
                newEvents.push(eventData);
              }
            }
          }

          if (newEvents.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'EVENTS', events: newEvents })}\n\n`);
          }

          lastEventCheck = Date.now();
        } catch (error) {
            console.error('Error fetching events for SSE stream:', error);
        }
      }, 2000);

      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);
      
      req.on('close', () => {
        clearInterval(eventInterval);
        clearInterval(heartbeat);
      });
      
      return;
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
