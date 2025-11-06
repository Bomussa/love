// Admin: Set call interval for auto-calling patients

import { jsonResponse, corsResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';

export default async function handler(req, res) {
  try {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { clinic, interval_minutes } = body;
    
    // Validate required fields
    const validationError = validateRequiredFields(body, ['clinic', 'interval_minutes']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_QUEUES, 'KV_QUEUES');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    const kv = env.KV_QUEUES;
    
    // Save interval setting
    const intervalKey = `queue:interval:${clinic}`;
    await kv.put(intervalKey, JSON.stringify({
      interval_minutes: interval_minutes,
      updated_at: new Date().toISOString()
    }), {
      expirationTtl: 86400 * 30 // 30 days
    });
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      interval_minutes: interval_minutes,
      message: `Call interval set to ${interval_minutes} minutes`
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
    console.error('Error in api/v1/admin/set-call-interval.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
