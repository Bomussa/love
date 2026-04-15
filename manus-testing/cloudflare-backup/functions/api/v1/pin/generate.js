// Generate new daily PINs manually (Admin only)
 * MIGRATED TO SUPABASE
// POST /api/v1/pin/generate
// Body: { adminCode }

import { jsonResponse, corsResponse, checkKVAvailability } from '../../../_shared/utils.js';

const CLINICS = [
  'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 
  'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
  'derma', 'bones'
];

// Generate random 2-digit PIN (01-20 range)
function generatePin() {
  const pin = Math.floor(Math.random() * 20) + 1;
  return String(pin).padStart(2, '0');
}

// Generate unique PINs for all clinics
function generateDailyPins() {
  const pins = {};
  const used = new Set();
  
  for (const clinic of CLINICS) {
    let pin;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      pin = generatePin();
      attempts++;
      
      if (attempts > maxAttempts) {
        throw new Error('Failed to generate unique PIN after maximum attempts');
      }
    } while (used.has(pin));
    
    used.add(pin);
    pins[clinic] = pin;
  }
  
  return pins;
}

// Get current date in Asia/Qatar timezone
function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_PINS, 'KV_PINS');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    const kv = env.KV_PINS;
    const today = getQatarDate();
    const key = `pins:daily:${today}`;
    
    // Generate new PINs
    const pins = generateDailyPins();
    
    // Calculate expiration (next day at 05:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(5, 0, 0, 0);
    const expirationTtl = Math.floor((tomorrow - new Date()) / 1000);
    
    // Save to KV
    await kv.put(key, JSON.stringify(pins), {
      expirationTtl: Math.max(expirationTtl, 3600)
    });
    
    // Transform pins to include metadata
    const pinsWithMetadata = {};
    for (const [clinic, pin] of Object.entries(pins)) {
      pinsWithMetadata[clinic] = {
        pin: pin,
        clinic: clinic,
        active: true,
        generatedAt: new Date().toISOString()
      };
    }
    
    return jsonResponse({
      success: true,
      date: today,
      reset_time: "05:00",
      timezone: "Asia/Qatar",
      pins: pinsWithMetadata,
      message: 'PINs generated successfully'
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return corsResponse(['POST', 'OPTIONS']);
}

