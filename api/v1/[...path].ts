/**
 * Vercel Edge Function - Catch-all API Router for MMC-MMS
 * Routes all /api/v1/* requests to appropriate handlers
 * Compatible with Cloudflare Workers API surface
 */

import { createStorageAdapter, type StorageAdapter } from '../../_lib/kv';
import { json, error, success, handleCORSPreflight, getCORSHeaders } from '../../_lib/json';
import { SSEStream, createSSEResponse } from '../../_lib/sse';

// Edge Runtime configuration
export const config = {
  runtime: 'edge',
};

// Initialize storage adapter
let storage: StorageAdapter;

function getStorage(): StorageAdapter {
  if (!storage) {
    storage = createStorageAdapter();
  }
  return storage;
}

// ==========================================
// Helper Functions
// ==========================================

function generateUniqueNumber(): number {
  const now = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return parseInt(`${now}${random}`);
}

function generatePIN(): string {
  return String(Math.floor(Math.random() * 90) + 10).padStart(2, '0');
}

function validateClinic(clinic: string): boolean {
  const validClinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
  return validClinics.includes(clinic);
}

async function emitQueueEvent(kv: StorageAdapter, clinic: string, user: string, type: string, position: number): Promise<void> {
  try {
    const event = {
      type,
      clinic,
      user,
      position,
      timestamp: new Date().toISOString()
    };
    const eventKey = `event:${clinic}:${user}:${Date.now()}`;
    await kv.setJSON(eventKey, event, { expirationTtl: 3600 });
  } catch (error) {
    console.error('Failed to emit event:', error);
  }
}

// ==========================================
// Distributed Lock Implementation
// ==========================================

async function acquireLock(kv: StorageAdapter, resource: string, timeout = 5000): Promise<string> {
  const lockKey = `lock:${resource}`;
  const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = Date.now() + timeout;
  
  const existingLock = await kv.getJSON<{ id: string; expiresAt: number }>(lockKey);
  
  if (existingLock && Date.now() < existingLock.expiresAt) {
    throw new Error('Resource is locked');
  }
  
  await kv.setJSON(lockKey, { id: lockId, expiresAt }, {
    expirationTtl: Math.max(60, Math.ceil(timeout / 1000))
  });
  
  return lockId;
}

async function releaseLock(kv: StorageAdapter, resource: string, lockId: string): Promise<boolean> {
  const lockKey = `lock:${resource}`;
  const existingLock = await kv.getJSON<{ id: string }>(lockKey);
  
  if (existingLock && existingLock.id === lockId) {
    await kv.delete(lockKey);
    return true;
  }
  
  return false;
}

async function withLock<T>(kv: StorageAdapter, resource: string, fn: () => Promise<T>): Promise<T> {
  const lockId = await acquireLock(kv, resource);
  
  try {
    return await fn();
  } finally {
    await releaseLock(kv, resource, lockId);
  }
}

// ==========================================
// API Handlers
// ==========================================

async function handleHealth(): Promise<Response> {
  const kv = getStorage();
  return success({
    status: 'healthy',
    mode: 'online',
    backend: 'up',
    timestamp: new Date().toISOString(),
    kv: {
      available: !!kv,
      type: kv.constructor.name
    }
  });
}

async function handlePatientLogin(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { patientId, gender } = body;

    if (!patientId || !gender) {
      return error('Missing required fields: patientId and gender', 400);
    }

    if (!/^\d{2,12}$/.test(patientId)) {
      return error('Invalid patientId format. Must be 2-12 digits.', 400);
    }

    if (!['male', 'female'].includes(gender)) {
      return error('Invalid gender. Must be "male" or "female".', 400);
    }

    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const patientData = {
      id: sessionId,
      patientId,
      gender,
      loginTime: new Date().toISOString(),
      status: 'logged_in'
    };

    const kv = getStorage();
    await kv.setJSON(`patient:${sessionId}`, patientData, { expirationTtl: 86400 });

    return success({
      data: patientData,
      message: 'Login successful'
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleQueueEnter(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { clinic, user, isAutoEntry } = body;

    if (!clinic || !user) {
      return error('Missing clinic or user', 400);
    }

    if (!validateClinic(clinic)) {
      return error('Invalid clinic', 400);
    }

    const kv = getStorage();

    return await withLock(kv, `queue:${clinic}`, async () => {
      const queueKey = `queue:list:${clinic}`;
      const queueData = await kv.getJSON<any[]>(queueKey) || [];

      const existingEntry = queueData.find(e => e.user === user);
      if (existingEntry) {
        const position = queueData.indexOf(existingEntry) + 1;
        return success({
          clinic,
          user,
          number: existingEntry.number,
          status: 'ALREADY_IN_QUEUE',
          ahead: position - 1,
          display_number: position,
          position,
          message: 'You are already in the queue'
        });
      }

      const uniqueNumber = generateUniqueNumber();

      const entry = {
        number: uniqueNumber,
        user,
        status: isAutoEntry ? 'IN_PROGRESS' : 'WAITING',
        enteredAt: new Date().toISOString()
      };

      queueData.push(entry);

      await kv.setJSON(queueKey, queueData, { expirationTtl: 86400 });
      await kv.setJSON(`queue:user:${clinic}:${user}`, entry, { expirationTtl: 86400 });

      const ahead = queueData.length - 1;
      const position = queueData.length;

      await emitQueueEvent(kv, clinic, user, 'ENTERED', position);

      return success({
        clinic,
        user,
        number: uniqueNumber,
        status: 'WAITING',
        ahead,
        display_number: position,
        position
      });
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleQueueStatus(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const clinic = url.searchParams.get('clinic');
    
    if (!clinic) {
      return error('Missing clinic parameter', 400);
    }

    const kv = getStorage();
    const queueKey = `queue:list:${clinic}`;
    const queueData = await kv.getJSON<any[]>(queueKey) || [];

    const statusKey = `queue:status:${clinic}`;
    const status = await kv.getJSON<any>(statusKey) || { current: null, served: [] };

    return success({
      clinic,
      list: queueData,
      current_serving: status.current,
      total_waiting: queueData.length,
      current: status.current,
      waiting: queueData.length
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleQueueDone(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { clinic, user, pin, clinicId, patientId, ticket } = body;

    const clinicName = clinic || clinicId;
    const userId = user || patientId;
    const pinCode = pin || ticket;

    if (!clinicName || !userId) {
      return error('Missing clinic or user', 400);
    }

    const kv = getStorage();

    if (pinCode) {
      const pinKey = `pin:${clinicName}`;
      const storedPin = await kv.get(pinKey);
      if (storedPin && storedPin !== String(pinCode)) {
        return error('Invalid PIN', 403);
      }
    }

    const queueKey = `queue:list:${clinicName}`;
    const queueData = await kv.getJSON<any[]>(queueKey) || [];

    const index = queueData.findIndex(e => e.user === userId);
    if (index !== -1) {
      const entry = queueData.splice(index, 1)[0];
      entry.status = 'SERVED';
      entry.servedAt = new Date().toISOString();

      await kv.setJSON(queueKey, queueData, { expirationTtl: 86400 });

      const statusKey = `queue:status:${clinicName}`;
      const status = {
        current: queueData.length > 0 ? queueData[0].number : null,
        served: [entry]
      };
      await kv.setJSON(statusKey, status, { expirationTtl: 86400 });
    }

    return success({
      message: 'Queue completed'
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleCallNext(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { clinic } = body;

    if (!clinic) {
      return error('Missing clinic', 400);
    }

    const kv = getStorage();
    const queueKey = `queue:list:${clinic}`;
    const queueData = await kv.getJSON<any[]>(queueKey) || [];

    if (queueData.length === 0) {
      return error('No patients in queue', 404);
    }

    const statusKey = `queue:status:${clinic}`;
    const status = {
      current: queueData[0].number,
      served: []
    };
    await kv.setJSON(statusKey, status, { expirationTtl: 86400 });

    return success({
      next_patient: queueData[0]
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handlePinStatus(): Promise<Response> {
  try {
    const clinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
    const pins: Record<string, any> = {};
    const kv = getStorage();

    for (const clinic of clinics) {
      const pinKey = `pin:${clinic}`;
      let pin = await kv.get(pinKey);
      
      if (!pin) {
        pin = generatePIN();
        await kv.set(pinKey, pin, { expirationTtl: 86400 });
      }

      pins[clinic] = {
        pin,
        clinic,
        active: true,
        generatedAt: new Date().toISOString()
      };
    }

    return success({ pins });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handlePinGenerate(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { clinic } = body;

    if (!clinic) {
      return error('Missing clinic', 400);
    }

    const pin = generatePIN();
    const pinKey = `pin:${clinic}`;
    
    const kv = getStorage();
    await kv.set(pinKey, pin, { expirationTtl: 86400 });

    return success({
      clinic,
      pin,
      generatedAt: new Date().toISOString()
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handlePathChoose(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { gender } = body;

    let path: string[] = [];
    
    if (gender === 'male') {
      path = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
    } else {
      path = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'dental', 'psychiatry', 'derma'];
    }

    return success({ path });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleAdminStatus(): Promise<Response> {
  try {
    const clinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
    const queues: Record<string, any> = {};
    let totalWaiting = 0;
    let totalServed = 0;

    const kv = getStorage();

    for (const clinic of clinics) {
      const queueKey = `queue:list:${clinic}`;
      const queueData = await kv.getJSON<any[]>(queueKey) || [];
      
      const pinKey = `pin:${clinic}`;
      const pin = await kv.get(pinKey);
      
      const statusKey = `queue:status:${clinic}`;
      const status = await kv.getJSON<any>(statusKey) || { current: null, served: [] };
      
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

    return success({
      stats: {
        total_waiting: totalWaiting,
        total_served: totalServed,
        active_clinics: clinics.length
      },
      queues
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleReportDaily(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const dateStr = url.searchParams.get('date');
    const date = dateStr ? new Date(dateStr) : new Date();

    return success({
      report: {
        date: date.toISOString().split('T')[0],
        type: 'daily',
        clinics: {},
        summary: {
          total_patients: 0,
          total_served: 0,
          total_waiting: 0
        }
      }
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleReportWeekly(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const weekStr = url.searchParams.get('week');
    const week = weekStr ? new Date(weekStr) : new Date();

    return success({
      report: {
        week: week.toISOString().split('T')[0],
        type: 'weekly',
        clinics: {},
        summary: {
          total_patients: 0,
          total_served: 0,
          total_waiting: 0
        }
      }
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleReportMonthly(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1));

    return success({
      report: {
        year,
        month,
        type: 'monthly',
        clinics: {},
        summary: {
          total_patients: 0,
          total_served: 0,
          total_waiting: 0
        }
      }
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleReportAnnual(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));

    return success({
      report: {
        year,
        type: 'annual',
        clinics: {},
        summary: {
          total_patients: 0,
          total_served: 0,
          total_waiting: 0
        }
      }
    });

  } catch (err: any) {
    return error(err.message || 'Internal server error', 500);
  }
}

async function handleSSE(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  const clinic = url.searchParams.get('clinic');

  if (!user && !clinic) {
    return error('user or clinic parameter required', 400);
  }

  const stream = new SSEStream({ heartbeatInterval: 15000 });
  
  // Send initial connection message
  stream.send({
    type: 'CONNECTED',
    user,
    clinic,
    timestamp: new Date().toISOString()
  });

  // Get CORS headers
  const corsHeaders = getCORSHeaders();

  return createSSEResponse(stream.getStream(), corsHeaders);
}

// ==========================================
// Main Request Handler
// ==========================================

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleCORSPreflight();
  }

  // Route handlers
  try {
    // Health and status endpoints
    if (path === '/api/v1/status' || path === '/api/v1/health/status') {
      return await handleHealth();
    }

    if (path === '/api/v1/admin/status') {
      return await handleAdminStatus();
    }

    // Patient endpoints
    if (path === '/api/v1/patient/login' && method === 'POST') {
      return await handlePatientLogin(req);
    }

    // Queue endpoints
    if (path === '/api/v1/queue/enter' && method === 'POST') {
      return await handleQueueEnter(req);
    }

    if (path === '/api/v1/queue/status') {
      return await handleQueueStatus(req);
    }

    if (path === '/api/v1/queue/done' && method === 'POST') {
      return await handleQueueDone(req);
    }

    if (path === '/api/v1/queue/call' && method === 'POST') {
      return await handleCallNext(req);
    }

    // PIN endpoints
    if (path === '/api/v1/pin/status') {
      return await handlePinStatus();
    }

    if (path === '/api/v1/pin/generate' && method === 'POST') {
      return await handlePinGenerate(req);
    }

    // Path endpoints
    if (path === '/api/v1/path/choose' && method === 'POST') {
      return await handlePathChoose(req);
    }

    // Report endpoints
    if (path === '/api/v1/reports/daily') {
      return await handleReportDaily(req);
    }

    if (path === '/api/v1/reports/weekly') {
      return await handleReportWeekly(req);
    }

    if (path === '/api/v1/reports/monthly') {
      return await handleReportMonthly(req);
    }

    if (path === '/api/v1/reports/annual') {
      return await handleReportAnnual(req);
    }

    // SSE endpoint
    if (path === '/api/v1/events/stream') {
      return await handleSSE(req);
    }

    // 404 for unknown routes
    return error('Not Found', 404);

  } catch (err: any) {
    console.error('Handler error:', err);
    return error(err.message || 'Internal Server Error', 500);
  }
}
