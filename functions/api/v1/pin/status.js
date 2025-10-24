// Get daily PINs for all clinics
// PINs are static per clinic and change daily at 05:00 Asia/Qatar

import { jsonResponse } from '../../../_shared/utils.js';

const CLINICS = [
  'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 
  'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
  'derma', 'bones'
];

// Generate random 2-digit PIN (01-99 range)
function generatePin() {
  const pin = Math.floor(Math.random() * 99) + 1;
  return String(pin).padStart(2, '0');
}

// Generate unique PINs for all clinics with guaranteed uniqueness
function generateDailyPins() {
  const pins = {};
  const used = new Set();
  
  for (const clinic of CLINICS) {
    let pin;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    do {
      pin = generatePin();
      attempts++;
      
      // If we've tried too many times, throw error
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

// Get current date in Asia/Qatar timezone
function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

export async function onRequest(context) {
  const { env } = context;
  
  try {
    const kv = env.KV_PINS;
    if (!kv) {
      return jsonResponse({ 
        success: false, 
        error: 'KV_PINS not available' 
      }, 500);
    }
    
    const today = getQatarDate();
    const key = `pins:daily:${today}`;
    
    // Try to get existing PINs
    let pins = await kv.get(key, 'json');
    
    // If no PINs exist, generate them
    if (!pins) {
      pins = generateDailyPins();
      
      // Calculate expiration (next day at 05:00)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(5, 0, 0, 0);
      const expirationTtl = Math.floor((tomorrow - new Date()) / 1000);
      
      await kv.put(key, JSON.stringify(pins), {
        expirationTtl: Math.max(expirationTtl, 3600)
      });
    }
    
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
      pins: pinsWithMetadata
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

