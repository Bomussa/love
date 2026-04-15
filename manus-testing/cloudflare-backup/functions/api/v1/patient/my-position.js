// Patient My Position - Get waiting count from database
 * MIGRATED TO SUPABASE
// GET /api/v1/patient/my-position?patientId=12345678&clinic=lab

import { jsonResponse } from '../../../_shared/utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    const clinic = url.searchParams.get('clinic');
    
    if (!patientId || !clinic) {
      return jsonResponse({
        success: false,
        error: 'patientId and clinic are required'
      }, 400);
    }
    
    // Get user entry
    const userKey = `queue:user:${clinic}:${patientId}`;
    const userEntry = await env.KV_QUEUES.get(userKey, 'json');
    
    if (!userEntry) {
      return jsonResponse({
        success: false,
        error: 'لست في طابور هذه العيادة',
        message: 'Not in queue for this clinic'
      }, 404);
    }
    
    if (userEntry.status === 'DONE') {
      return jsonResponse({
        success: false,
        error: 'لقد أنهيت هذه العيادة بالفعل',
        message: 'Already completed this clinic'
      }, 400);
    }
    
    // Get clinic counters
    const counterKey = `counter:${clinic}`;
    const counters = await env.KV_QUEUES.get(counterKey, 'json') || {
      clinic: clinic,
      entered: 0,
      exited: 0
    };
    
    // Calculate waiting count from database
    const waitingCount = counters.entered - counters.exited;
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      patientId: patientId,
      
      // Sequential number (never changes)
      your_number: userEntry.number,
      
      // Waiting count from database (dynamic)
      waiting_count: waitingCount,
      
      // Database counters
      counters: {
        entered: counters.entered,
        exited: counters.exited,
        waiting: waitingCount
      },
      
      // Entry info
      entered_at: userEntry.entered_at,
      status: userEntry.status,
      
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

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

