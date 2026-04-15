/**
 * MMC-MMS API Worker
 * Full Backend API with KV Storage
 */

import { generateDailyReport, generateWeeklyReport, generateMonthlyReport, generateAnnualReport } from './reports.js';

// ==========================================
// CORS Headers
// ==========================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// ==========================================
// Rate Limiting
// ==========================================
const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 100  // max requests per window
};

async function checkRateLimit(env, clientId) {
  const key = `ratelimit:${clientId}`;
  const current = await env.KV_CACHE.get(key, { type: 'json' }) || { count: 0, resetAt: Date.now() + RATE_LIMIT.windowMs };
  
  if (Date.now() > current.resetAt) {
    current.count = 0;
    current.resetAt = Date.now() + RATE_LIMIT.windowMs;
  }
  
  if (current.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, resetAt: current.resetAt };
  }
  
  current.count++;
  await env.KV_CACHE.put(key, JSON.stringify(current), {
    expirationTtl: Math.ceil(RATE_LIMIT.windowMs / 1000)
  });
  
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - current.count };
}

// ==========================================
// Distributed Lock
// ==========================================
async function acquireLock(env, resource, timeout = 5000) {
  const lockKey = `lock:${resource}`;
  const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = Date.now() + timeout;
  
  const existingLock = await env.KV_LOCKS.get(lockKey, { type: 'json' });
  
  if (existingLock && Date.now() < existingLock.expiresAt) {
    throw new Error('Resource is locked');
  }
  
  await env.KV_LOCKS.put(lockKey, JSON.stringify({
    id: lockId,
    expiresAt
  }), {
    expirationTtl: Math.max(60, Math.ceil(timeout / 1000))
  });
  
  return lockId;
}

async function releaseLock(env, resource, lockId) {
  const lockKey = `lock:${resource}`;
  const existingLock = await env.KV_LOCKS.get(lockKey, { type: 'json' });
  
  if (existingLock && existingLock.id === lockId) {
    await env.KV_LOCKS.delete(lockKey);
    return true;
  }
  
  return false;
}

async function withLock(env, resource, fn) {
  const lockId = await acquireLock(env, resource);
  
  try {
    return await fn();
  } finally {
    await releaseLock(env, resource, lockId);
  }
}

// ==========================================
// Helper Functions
// ==========================================
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function generateUniqueNumber() {
  const now = new Date();
  const timestamp = now.getTime();
  const random = Math.floor(Math.random() * 10000);
  return parseInt(`${timestamp}${random}`);
}

function generatePIN() {
  return String(Math.floor(Math.random() * 90) + 10).padStart(2, '0');
}

function validatePatientId(patientId) {
  return /^\d{2,12}$/.test(patientId);
}

function validateGender(gender) {
  return ['male', 'female'].includes(gender);
}

function validateClinic(clinic) {
  const validClinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
  return validClinics.includes(clinic);
}

async function emitQueueEvent(env, clinic, user, type, position) {
  try {
    const event = {
      type,
      clinic,
      user,
      position,
      timestamp: new Date().toISOString()
    };
    const eventKey = `event:${clinic}:${user}:${Date.now()}`;
    await env.KV_EVENTS.put(eventKey, JSON.stringify(event), {
      expirationTtl: 3600
    });
  } catch (error) {
    console.error('Failed to emit event:', error);
  }
}

// ==========================================
// API Handlers
// ==========================================

// Health Check
async function handleHealth(env) {
  return jsonResponse({
    success: true,
    status: 'healthy',
    mode: 'online',
    backend: 'up',
    timestamp: new Date().toISOString(),
    kv: {
      admin: !!env.KV_ADMIN,
      pins: !!env.KV_PINS,
      queues: !!env.KV_QUEUES,
      events: !!env.KV_EVENTS,
      locks: !!env.KV_LOCKS,
      cache: !!env.KV_CACHE
    }
  });
}

// Patient Login
async function handlePatientLogin(request, env) {
  try {
    const body = await request.json();
    const { patientId, gender } = body;

    // Validate
    if (!patientId || !gender) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields: patientId and gender'
      }, 400);
    }

    if (!/^\d{2,12}$/.test(patientId)) {
      return jsonResponse({
        success: false,
        error: 'Invalid patientId format. Must be 2-12 digits.'
      }, 400);
    }

    if (!['male', 'female'].includes(gender)) {
      return jsonResponse({
        success: false,
        error: 'Invalid gender. Must be "male" or "female".'
      }, 400);
    }

    // Create session
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const patientData = {
      id: sessionId,
      patientId: patientId,
      gender: gender,
      loginTime: new Date().toISOString(),
      status: 'logged_in'
    };

    // Store in KV
    await env.KV_CACHE.put(
      `patient:${sessionId}`,
      JSON.stringify(patientData),
      { expirationTtl: 86400 }
    );

    return jsonResponse({
      success: true,
      data: patientData,
      message: 'Login successful'
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
}

// Queue Enter (with distributed lock)
async function handleQueueEnter(request, env) {
  try {
    const body = await request.json();
    const { clinic, user, isAutoEntry } = body;

    if (!clinic || !user) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic or user'
      }, 400);
    }

    if (!validateClinic(clinic)) {
      return jsonResponse({
        success: false,
        error: 'Invalid clinic'
      }, 400);
    }

    // Use distributed lock to prevent race conditions
    return await withLock(env, `queue:${clinic}`, async () => {
      // Get current queue
      const queueKey = `queue:list:${clinic}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

      // Check if user already in queue
      const existingEntry = queueData.find(e => e.user === user);
      if (existingEntry) {
        const position = queueData.indexOf(existingEntry) + 1;
        return jsonResponse({
          success: true,
          clinic: clinic,
          user: user,
          number: existingEntry.number,
          status: 'ALREADY_IN_QUEUE',
          ahead: position - 1,
          display_number: position,
          position: position,
          message: 'You are already in the queue'
        });
      }

      // Generate unique number
      const uniqueNumber = generateUniqueNumber();

      // Add to queue
      const entry = {
        number: uniqueNumber,
        user: user,
        status: isAutoEntry ? 'IN_PROGRESS' : 'WAITING',
        enteredAt: new Date().toISOString()
      };

      queueData.push(entry);

      // Save queue
      await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
        expirationTtl: 86400
      });

      // Save user entry
      await env.KV_QUEUES.put(
        `queue:user:${clinic}:${user}`,
        JSON.stringify(entry),
        { expirationTtl: 86400 }
      );

      // Calculate ahead and position
      const ahead = queueData.length - 1;
      const position = queueData.length;

      // Emit event for real-time updates
      await emitQueueEvent(env, clinic, user, 'ENTERED', position);

      return jsonResponse({
        success: true,
        clinic: clinic,
        user: user,
        number: uniqueNumber,
        status: 'WAITING',
        ahead: ahead,
        display_number: position,
        position: position
      });
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Queue Status
async function handleQueueStatus(url, env) {
  try {
    const clinic = url.searchParams.get('clinic');
    
    if (!clinic) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic parameter'
      }, 400);
    }

    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    const statusKey = `queue:status:${clinic}`;
    const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || { current: null, served: [] };

    return jsonResponse({
      success: true,
      clinic: clinic,
      list: queueData,
      current_serving: status.current,
      total_waiting: queueData.length,
      current: status.current,
      waiting: queueData.length
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Queue Done
async function handleQueueDone(request, env) {
  try {
    const body = await request.json();
    const { clinic, user, pin, clinicId, patientId, ticket } = body;

    // Support both formats
    const clinicName = clinic || clinicId;
    const userId = user || patientId;
    const pinCode = pin || ticket;

    if (!clinicName || !userId) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic or user'
      }, 400);
    }

    // Verify PIN if provided
    if (pinCode) {
      const pinKey = `pin:${clinicName}`;
      const storedPin = await env.KV_PINS.get(pinKey);
      if (storedPin && storedPin !== String(pinCode)) {
        return jsonResponse({
          success: false,
          error: 'Invalid PIN'
        }, 403);
      }
    }

    // Get queue
    const queueKey = `queue:list:${clinicName}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    // Remove from queue
    const index = queueData.findIndex(e => e.user === userId);
    if (index !== -1) {
      const entry = queueData.splice(index, 1)[0];
      entry.status = 'SERVED';
      entry.servedAt = new Date().toISOString();

      // Update queue
      await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
        expirationTtl: 86400
      });

      // Update status
      const statusKey = `queue:status:${clinicName}`;
      const status = {
        current: queueData.length > 0 ? queueData[0].number : null,
        served: [entry]
      };
      await env.KV_QUEUES.put(statusKey, JSON.stringify(status), {
        expirationTtl: 86400
      });
    }

    return jsonResponse({
      success: true,
      message: 'Queue completed'
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Call Next Patient
async function handleCallNext(request, env) {
  try {
    const body = await request.json();
    const { clinic } = body;

    if (!clinic) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic'
      }, 400);
    }

    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    if (queueData.length === 0) {
      return jsonResponse({
        success: false,
        error: 'No patients in queue'
      }, 404);
    }

    const statusKey = `queue:status:${clinic}`;
    const status = {
      current: queueData[0].number,
      served: []
    };
    await env.KV_QUEUES.put(statusKey, JSON.stringify(status), {
      expirationTtl: 86400
    });

    return jsonResponse({
      success: true,
      next_patient: queueData[0]
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Clinic Exit with PIN
async function handleClinicExit(request, env) {
  try {
    const body = await request.json();
    const { patientId, clinicId, pin } = body;

    if (!patientId || !clinicId || !pin) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // Verify PIN
    const pinKey = `pin:${clinicId}`;
    const storedPin = await env.KV_PINS.get(pinKey);

    if (!storedPin || storedPin !== pin) {
      return jsonResponse({
        success: false,
        error: 'Invalid PIN'
      }, 403);
    }

    // Get patient route
    const routeKey = `route:${patientId}`;
    const routeData = await env.KV_QUEUES.get(routeKey, { type: 'json' });

    if (!routeData) {
      return jsonResponse({
        success: false,
        error: 'Patient route not found'
      }, 404);
    }

    // Update station status
    const stationIndex = routeData.stations.findIndex(s => s.id === clinicId);
    if (stationIndex === -1) {
      return jsonResponse({
        success: false,
        error: 'Clinic not found in route'
      }, 404);
    }

    const station = routeData.stations[stationIndex];
    station.status = 'completed';
    station.exitTime = new Date().toISOString();

    // Unlock next station
    if (stationIndex + 1 < routeData.stations.length) {
      routeData.stations[stationIndex + 1].status = 'ready';
    }

    // Save updated route
    await env.KV_QUEUES.put(routeKey, JSON.stringify(routeData), {
      expirationTtl: 86400
    });

    // Remove from queue
    const queueKey = `queue:list:${clinicId}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
    const updatedQueue = queueData.filter(e => e.user !== patientId);
    await env.KV_QUEUES.put(queueKey, JSON.stringify(updatedQueue), {
      expirationTtl: 86400
    });

    return jsonResponse({
      success: true,
      message: 'Clinic exit successful',
      route: routeData
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// PIN Status
async function handlePinStatus(env) {
  try {
    const clinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
    const pins = {};

    for (const clinic of clinics) {
      const pinKey = `pin:${clinic}`;
      let pin = await env.KV_PINS.get(pinKey);
      
      if (!pin) {
        // Generate new PIN
        pin = generatePIN();
        await env.KV_PINS.put(pinKey, pin, {
          expirationTtl: 86400 // 24 hours
        });
      }

      pins[clinic] = {
        pin: pin,
        clinic: clinic,
        active: true,
        generatedAt: new Date().toISOString()
      };
    }

    return jsonResponse({
      success: true,
      pins: pins
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Generate PIN
async function handlePinGenerate(request, env) {
  try {
    const body = await request.json();
    const { clinic } = body;

    if (!clinic) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic'
      }, 400);
    }

    const pin = generatePIN();
    const pinKey = `pin:${clinic}`;
    
    await env.KV_PINS.put(pinKey, pin, {
      expirationTtl: 86400
    });

    return jsonResponse({
      success: true,
      clinic: clinic,
      pin: pin,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Route Create - حفظ مسار المراجع
async function handleRouteCreate(request, env) {
  try {
    const body = await request.json();
    const { patientId, examType, gender, stations } = body;

    if (!patientId || !stations || !Array.isArray(stations)) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    const routeData = {
      patientId,
      examType,
      gender,
      stations: stations.map((s, idx) => ({
        id: s.id,
        name: s.name,
        nameAr: s.nameAr,
        floor: s.floor,
        status: idx === 0 ? 'ready' : 'locked',
        entryTime: idx === 0 ? new Date().toISOString() : null,
        exitTime: null
      })),
      createdAt: new Date().toISOString()
    };

    const routeKey = `route:${patientId}`;
    await env.KV_QUEUES.put(routeKey, JSON.stringify(routeData), {
      expirationTtl: 86400 // 24 hours
    });

    return jsonResponse({
      success: true,
      route: routeData
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Route Get - جلب مسار المراجع المحفوظ
async function handleRouteGet(request, env) {
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');

    if (!patientId) {
      return jsonResponse({
        success: false,
        error: 'Missing patientId parameter'
      }, 400);
    }

    const routeKey = `route:${patientId}`;
    const routeData = await env.KV_QUEUES.get(routeKey, { type: 'json' });

    if (!routeData) {
      return jsonResponse({
        success: false,
        error: 'Route not found'
      }, 404);
    }

    return jsonResponse({
      success: true,
      route: routeData
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Path Choose
async function handlePathChoose(request, env) {
  try {
    const body = await request.json();
    const { gender } = body;

    let path = [];
    
    if (gender === 'male') {
      path = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
    } else {
      path = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'dental', 'psychiatry', 'derma'];
    }

    return jsonResponse({
      success: true,
      path: path
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Admin Status
async function handleAdminStatus(env) {
  try {
    const clinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
    const queues = {};
    let totalWaiting = 0;
    let totalServed = 0;

    for (const clinic of clinics) {
      const queueKey = `queue:list:${clinic}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
      
      // Get PIN for this clinic
      const pinKey = `pin:${clinic}`;
      const pin = await env.KV_PINS.get(pinKey);
      
      // Get current serving
      const statusKey = `queue:status:${clinic}`;
      const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || { current: null, served: [] };
      
      queues[clinic] = {
        list: queueData,
        current: status.current,
        served: status.served || [],
        pin: pin || null,
        waiting: queueData.length
      };

      totalWaiting += queueData.length;
      totalServed += (status.served || []).length;
    }

    return jsonResponse({
      success: true,
      stats: {
        total_waiting: totalWaiting,
        total_served: totalServed,
        active_clinics: clinics.length
      },
      queues: queues
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// ==========================================
// SSE Handler for Real-time Notifications
// ==========================================
async function handleSSE(url, env, ctx) {
  const user = url.searchParams.get('user');
  const clinic = url.searchParams.get('clinic');

  if (!user && !clinic) {
    return jsonResponse({ error: 'user or clinic parameter required' }, 400);
  }

  // Create SSE stream
  let controller;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
      // Send initial connection message
      const msg = `data: ${JSON.stringify({
        type: 'CONNECTED',
        user,
        clinic,
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(msg));
    },
    cancel() {
      // Cleanup when connection closes
    }
  });

  // Set up polling to check queue status and send notifications
  if (user) {
    ctx.waitUntil((async () => {
      try {
        // Poll every 5 seconds
        for (let i = 0; i < 120; i++) { // 10 minutes max
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Get user's current queue status from KV
          const userKey = `user:${user}:queue`;
          const userData = await env.KV_QUEUES.get(userKey, { type: 'json' });
          
          if (userData && userData.clinic) {
            const queueKey = `queue:${userData.clinic}`;
            const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' });
            
            if (queueData) {
              const current = queueData.current || 0;
              const userNumber = userData.number || 0;
              const position = userNumber - current;
              
              // Send notification at position 3, 2, 1
              if (position === 3 || position === 2 || position === 1) {
                const notification = {
                  type: 'queue_update',
                  position,
                  clinic: userData.clinic,
                  userNumber,
                  current,
                  message: position === 1 ? 'دورك الآن!' : position === 2 ? 'أنت الثاني - كن جاهزاً' : 'أنت الثالث - استعد',
                  messageEn: position === 1 ? 'Your turn now!' : position === 2 ? 'You are second - be ready' : 'You are third - get ready',
                  timestamp: new Date().toISOString()
                };
                
                const msg = `event: queue_update\ndata: ${JSON.stringify(notification)}\n\n`;
                try {
                  controller.enqueue(new TextEncoder().encode(msg));
                } catch (e) {
                  break; // Connection closed
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('SSE polling error:', e);
      }
    })());
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...CORS_HEADERS
    }
  });
}

// ==========================================
// Main Request Handler
// ==========================================
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  // Route handlers
  if (path === '/api/v1/health/status' || path === '/api/v1/status') {
    return handleHealth(env);
  }

  if (path === '/api/v1/patient/login' && request.method === 'POST') {
    return handlePatientLogin(request, env);
  }

  if (path === '/api/v1/queue/enter' && request.method === 'POST') {
    return handleQueueEnter(request, env);
  }

  if (path === '/api/v1/queue/status') {
    return handleQueueStatus(url, env);
  }

  if (path === '/api/v1/queue/done' && request.method === 'POST') {
    return handleQueueDone(request, env);
  }

  if (path === '/api/v1/queue/call' && request.method === 'POST') {
    return handleCallNext(request, env);
  }

  if (path === '/api/v1/pin/status') {
    return handlePinStatus(env);
  }

  if (path === '/api/v1/pin/generate' && request.method === 'POST') {
    return handlePinGenerate(request, env);
  }

  if (path === '/api/v1/route/create' && request.method === 'POST') {
    return handleRouteCreate(request, env);
  }

  if (path === '/api/v1/route/get' && request.method === 'GET') {
    return handleRouteGet(request, env);
  }

  if (path === '/api/v1/path/choose' && request.method === 'POST') {
    return handlePathChoose(request, env);
  }

  if (path === '/api/v1/clinic/exit' && request.method === 'POST') {
    return handleClinicExit(request, env);
  }

  if (path === '/api/v1/admin/status') {
    return handleAdminStatus(env);
  }

  if (path === '/api/v1/stats/queues') {
    return handleAdminStatus(env);
  }

  if (path === '/api/v1/stats/dashboard') {
    return handleAdminStatus(env);
  }

  if (path === '/api/v1/events/stream') {
    return handleSSE(url, env, ctx);
  }

  // Reports endpoints
  if (path === '/api/v1/reports/daily') {
    const date = url.searchParams.get('date') ? new Date(url.searchParams.get('date')) : new Date();
    const report = await generateDailyReport(env, date);
    return jsonResponse({ success: true, report });
  }

  if (path === '/api/v1/reports/weekly') {
    const weekStart = url.searchParams.get('week') ? new Date(url.searchParams.get('week')) : new Date();
    const report = await generateWeeklyReport(env, weekStart);
    return jsonResponse({ success: true, report });
  }

  if (path === '/api/v1/reports/monthly') {
    const year = parseInt(url.searchParams.get('year')) || new Date().getFullYear();
    const month = parseInt(url.searchParams.get('month')) || new Date().getMonth() + 1;
    const report = await generateMonthlyReport(env, year, month);
    return jsonResponse({ success: true, report });
  }

  if (path === '/api/v1/reports/annual') {
    const year = parseInt(url.searchParams.get('year')) || new Date().getFullYear();
    const report = await generateAnnualReport(env, year);
    return jsonResponse({ success: true, report });
  }

  // 404 for unknown routes
  return jsonResponse({
    success: false,
    error: 'Not Found',
    path: path
  }, 404);
}

// ==========================================
// Worker Export
// ==========================================
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return jsonResponse({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      }, 500);
    }
  },

  // Cron handler for monitoring
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', new Date().toISOString());
    // Health check or cleanup tasks can go here
  }
};

