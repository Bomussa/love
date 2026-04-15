/**
 * PIN Reset - Daily at 00:00 (CRON trigger)
 * POST /api/v1/pin/:clinic/reset
 * 
 * Initializes new daily PIN structure
 * Does NOT delete previous day's data
 */

import { jsonResponse, corsResponse, checkKVAvailability } from '../../../_shared/utils.js';

function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

function initializeDailyPins(date, timezone = 'Asia/Qatar') {
  const available = [];
  const reserve = [];
  
  for (let i = 1; i <= 20; i++) {
    available.push(String(i).padStart(2, '0'));
  }
  
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

export async function onRequest(context) {
  const { request, env, params } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const clinic = params.clinic;
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_PINS, 'KV_PINS');
    if (kvError) return jsonResponse(kvError, 500);
    
    const today = getQatarDate();
    
    // If clinic specified, reset only that clinic
    if (clinic && clinic !== 'all') {
      const pinKey = `pins:${clinic}:${today}`;
      const pinData = initializeDailyPins(today, env.TIMEZONE || 'Asia/Qatar');
      
      await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
        expirationTtl: 86400
      });
      
      return jsonResponse({
        success: true,
        clinic,
        date: today,
        reset_at: pinData.reset_at,
        message: 'PIN reset successful'
      });
    }
    
    // Reset all clinics
    const clinicsConfig = await env.KV_ADMIN?.get('clinics:config', { type: 'json' });
    
    if (!clinicsConfig || !clinicsConfig.clinics) {
      return jsonResponse({
        success: false,
        error: 'Clinics configuration not found'
      }, 500);
    }
    
    const resetResults = [];
    
    for (const clinicObj of clinicsConfig.clinics) {
      const pinKey = `pins:${clinicObj.name}:${today}`;
      const pinData = initializeDailyPins(today, env.TIMEZONE || 'Asia/Qatar');
      
      await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
        expirationTtl: 86400
      });
      
      resetResults.push({
        clinic: clinicObj.name,
        reset_at: pinData.reset_at
      });
    }
    
    return jsonResponse({
      success: true,
      date: today,
      clinics_reset: resetResults.length,
      results: resetResults,
      message: 'All PINs reset successfully'
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

