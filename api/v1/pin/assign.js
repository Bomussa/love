/**
 * PIN Assignment - Daily Variable PINs System
 * POST /api/v1/pin/:clinic/assign
 * 
 * Implements:
 * - 20 basic PINs (01-20)
 * - 10 reserve PINs (21-30)
 * - Atomic locks via KV_LOCKS
 * - Idempotency-Key support (60s)
 */

import { jsonResponse, corsResponse, checkKVAvailability } from '../../../_shared/utils.js';

// Get current date in Asia/Qatar timezone
function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

// Initialize daily PIN structure
function initializeDailyPins(date, timezone = 'Asia/Qatar') {
  const available = [];
  const reserve = [];
  
  // Generate 01-20 (basic)
  for (let i = 1; i <= 20; i++) {
    available.push(String(i).padStart(2, '0'));
  }
  
  // Generate 21-30 (reserve)
  for (let i = 21; i <= 30; i++) {
    reserve.push(String(i).padStart(2, '0'));
  }
  
  return {
    available,
    reserve,
    taken: [],
    issued: 0,
    reserve_mode: false,
    reset_at: new Date().toISOString(),
    tz: timezone
  };
}

// Acquire atomic lock
async function acquireLock(kv, lockKey, ttl = 3) {
  const lockValue = `lock_${Date.now()}_${Math.random()}`;
  const existing = await kv.get(lockKey);
  
  if (existing) {
    return null; // Lock already held
  }
  
  await kv.put(lockKey, lockValue, { expirationTtl: ttl });
  
  // Verify we got the lock
  const verify = await kv.get(lockKey);
  if (verify === lockValue) {
    return lockValue;
  }
  
  return null;
}

// Release lock
async function releaseLock(kv, lockKey, lockValue) {
  const current = await kv.get(lockKey);
  if (current === lockValue) {
    await kv.delete(lockKey);
  }
}

export default async function handler(req, res) {
  try {
  const { request, env, params } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const clinic = params.clinic;
    
    if (!clinic) {
      return jsonResponse({ 
        success: false, 
        error: 'Clinic name required' 
      }, 400);
    }
    
    // Check KV availability
    const kvPinsError = checkKVAvailability(env.KV_PINS, 'KV_PINS');
    if (kvPinsError) return jsonResponse(kvPinsError, 500);
    
    const kvLocksError = checkKVAvailability(env.KV_LOCKS, 'KV_LOCKS');
    if (kvLocksError) return jsonResponse(kvLocksError, 500);
    
    const kvEventsError = checkKVAvailability(env.KV_EVENTS, 'KV_EVENTS');
    if (kvEventsError) return jsonResponse(kvEventsError, 500);
    
    // Check for Idempotency-Key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const idempKey = `idempotency:pin:${clinic}:${idempotencyKey}`;
      const cached = await env.KV_LOCKS.get(idempKey, { type: 'json' });
      if (cached) {
        return jsonResponse(cached);
      }
    }
    
    const today = getQatarDate();
    const pinKey = `pins:${clinic}:${today}`;
    const lockKey = `pin:${clinic}:${today}`;
    
    // Acquire atomic lock (3s TTL)
    const lockValue = await acquireLock(env.KV_LOCKS, lockKey, 3);
    if (!lockValue) {
      return jsonResponse({
        success: false,
        error: 'Lock acquisition failed',
        message: 'System busy, please retry'
      }, 503);
    }
    
    try {
      // Get or initialize PIN structure
      let pinData = await env.KV_PINS.get(pinKey, { type: 'json' });
      
      if (!pinData) {
        pinData = initializeDailyPins(today, env.TIMEZONE || 'Asia/Qatar');
      }
      
      let assignedPin = null;
      
      // Try to assign from available
      if (pinData.available.length > 0) {
        assignedPin = pinData.available.shift();
        pinData.taken.push(assignedPin);
        pinData.issued++;
      }
      // Try reserve if available exhausted
      else if (pinData.reserve.length > 0) {
        assignedPin = pinData.reserve.shift();
        pinData.taken.push(assignedPin);
        pinData.issued++;
        pinData.reserve_mode = true;
      }
      else {
        // No PINs left
        await releaseLock(env.KV_LOCKS, lockKey, lockValue);
        return jsonResponse({
          success: false,
          error: 'No PINs available',
          message: 'All PINs exhausted for today',
          clinic,
          date: today
        }, 503);
      }
      
      // Save updated PIN data
      await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
        expirationTtl: 86400
      });
      
      // Log event
      const eventKey = `event:pin:${clinic}:${assignedPin}:${Date.now()}`;
      await env.KV_EVENTS.put(eventKey, JSON.stringify({
        type: 'PIN_ASSIGNED',
        clinic,
        pin: assignedPin,
        date: today,
        timestamp: new Date().toISOString(),
        reserve_mode: pinData.reserve_mode
      }), {
        expirationTtl: 604800 // 7 days
      });
      
      const response = {
        success: true,
        clinic,
        pin: assignedPin,
        date: today,
        issued: pinData.issued,
        available_left: pinData.available.length,
        reserve_left: pinData.reserve.length,
        reserve_mode: pinData.reserve_mode,
        timestamp: new Date().toISOString()
      };
      
      // Cache idempotency response
      if (idempotencyKey) {
        const idempKey = `idempotency:pin:${clinic}:${idempotencyKey}`;
        await env.KV_LOCKS.put(idempKey, JSON.stringify(response), {
          expirationTtl: 60
        });
      }
      
      return jsonResponse(response);
      
    } finally {
      // Always release lock
      await releaseLock(env.KV_LOCKS, lockKey, lockValue);
    }
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

export async function onRequestOptions() {
  return corsResponse(['POST', 'OPTIONS']);
}


  } catch (error) {
    console.error('Error in api/v1/pin/assign.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
