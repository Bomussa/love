// Patient Record - Get patient journey and statistics
// GET /api/v1/patient/record?patientId=12345678

import { jsonResponse } from '../../../_shared/utils.js';
import { getPatientRecord } from '../../../_shared/activity-logger.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    
    if (!patientId) {
      return jsonResponse({
        success: false,
        error: 'patientId is required'
      }, 400);
    }
    
    // Get patient permanent record
    const record = await getPatientRecord(env, patientId);
    
    if (!record) {
      return jsonResponse({
        success: false,
        error: 'Patient record not found'
      }, 404);
    }
    
    // Get patient current path
    const pathKey = `path:${patientId}`;
    const path = await env.KV_ADMIN.get(pathKey, 'json');
    
    // Get current queue positions
    const currentPositions = {};
    if (path && path.route) {
      for (const clinic of path.route) {
        const userKey = `queue:user:${clinic}:${patientId}`;
        const queueEntry = await env.KV_QUEUES.get(userKey, 'json');
        
        if (queueEntry) {
          currentPositions[clinic] = {
            number: queueEntry.number,
            status: queueEntry.status,
            entered_at: queueEntry.entered_at
          };
        }
      }
    }
    
    return jsonResponse({
      success: true,
      patientId: patientId,
      record: record,
      path: path,
      currentPositions: currentPositions,
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

