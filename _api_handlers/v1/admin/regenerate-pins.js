// Admin Regenerate PINs - Force regenerate daily PINs
// POST /api/v1/admin/regenerate-pins
// Body: { adminKey }

import { jsonResponse, corsResponse } from '../../../_shared/utils.js';

const CLINICS = [
  'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 
  'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
  'derma', 'bones'
];

function generatePin() {
  const pin = Math.floor(Math.random() * 99) + 1;
  return String(pin).padStart(2, '0');
}

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
  
  // Verify all PINs are unique
  const pinValues = Object.values(pins);
  const uniquePins = new Set(pinValues);
  
  if (pinValues.length !== uniquePins.size) {
    throw new Error('Duplicate PINs detected - regenerating');
  }
  
  return pins;
}

function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  try {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { adminKey } = body;
    
    // Verify admin key
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
      return jsonResponse({
        success: false,
        error: 'Unauthorized - Invalid admin key'
      }, 401);
    }
    
    const kv = env.KV_PINS;
    if (!kv) {
      return jsonResponse({ 
        success: false, 
        error: 'KV_PINS not available' 
      }, 500);
    }
    
    const today = getQatarDate();
    const key = `pins:daily:${today}`;
    
    // Get old PINs
    const oldPins = await kv.get(key, 'json');
    
    // Generate new PINs
    const newPins = generateDailyPins();
    
    // Calculate expiration (next day at 05:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(5, 0, 0, 0);
    const expirationTtl = Math.floor((tomorrow - new Date()) / 1000);
    
    // Save new PINs
    await kv.put(key, JSON.stringify(newPins), {
      expirationTtl: Math.max(expirationTtl, 3600)
    });
    
    // Log regeneration event
    const event = {
      type: 'PINS_REGENERATED',
      date: today,
      timestamp: new Date().toISOString(),
      old_pins: oldPins,
      new_pins: newPins,
      regenerated_by: 'admin'
    };
    
    await env.KV_EVENTS.put(
      `event:pins:regenerate:${Date.now()}`,
      JSON.stringify(event),
      { expirationTtl: 86400 * 7 } // Keep for 7 days
    );
    
    return jsonResponse({
      success: true,
      message: 'PINs regenerated successfully',
      date: today,
      old_pins: oldPins,
      new_pins: newPins,
      clinics_updated: CLINICS.length,
      timestamp: new Date().toISOString()
    });
    
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
    console.error('Error in api/v1/admin/regenerate-pins.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
