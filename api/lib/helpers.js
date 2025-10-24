/**
 * Helper Functions - وظائف مساعدة مشتركة
 */

// CORS Headers
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// JSON Response Helper
export function jsonResponse(res, data, status = 200) {
  res.status(status).json(data);
}

// Generate Unique Number
export function generateUniqueNumber() {
  const now = new Date();
  const timestamp = now.getTime();
  const random = Math.floor(Math.random() * 10000);
  return parseInt(`${timestamp}${random}`);
}

// Generate PIN
export function generatePIN() {
  return String(Math.floor(Math.random() * 90) + 10).padStart(2, '0');
}

// Validate Patient ID
export function validatePatientId(patientId) {
  return /^\d{2,12}$/.test(patientId);
}

// Validate Gender
export function validateGender(gender) {
  return ['male', 'female'].includes(gender);
}

// Validate Clinic
export function validateClinic(clinic) {
  const validClinics = [
    'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes',
    'internal', 'ent', 'surgery', 'dental', 'psychiatry',
    'derma', 'bones'
  ];
  return validClinics.includes(clinic);
}

// Get all valid clinics
export function getValidClinics() {
  return [
    'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes',
    'internal', 'ent', 'surgery', 'dental', 'psychiatry',
    'derma', 'bones'
  ];
}

// Emit Queue Event
export async function emitQueueEvent(env, clinic, user, type, position) {
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

// Rate Limiting
const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 100  // max requests per window
};

export async function checkRateLimit(env, clientId) {
  const key = `ratelimit:${clientId}`;
  const current = await env.KV_CACHE.get(key, { type: 'json' }) || {
    count: 0,
    resetAt: Date.now() + RATE_LIMIT.windowMs
  };
  
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

// Distributed Lock
export async function acquireLock(env, resource, timeout = 5000) {
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

export async function releaseLock(env, resource, lockId) {
  const lockKey = `lock:${resource}`;
  const existingLock = await env.KV_LOCKS.get(lockKey, { type: 'json' });
  
  if (existingLock && existingLock.id === lockId) {
    await env.KV_LOCKS.delete(lockKey);
    return true;
  }
  
  return false;
}

export async function withLock(env, resource, fn) {
  const lockId = await acquireLock(env, resource);
  
  try {
    return await fn();
  } finally {
    await releaseLock(env, resource, lockId);
  }
}

// Get Client IP
export function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

