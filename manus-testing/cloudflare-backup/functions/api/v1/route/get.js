// Get saved patient route
// GET /api/v1/route/get?patientId=xxx

import { jsonResponse, corsResponse, checkKVAvailability } from '../../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    
    if (!patientId) {
      return jsonResponse({
        success: false,
        error: 'patientId parameter required'
      }, 400);
    }
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    const kv = env.KV_ADMIN;
    const routeKey = `route:${patientId}`;
    
    // Get route from KV
    const route = await kv.get(routeKey, 'json');
    
    if (!route) {
      return jsonResponse({
        success: false,
        error: 'Route not found',
        message: 'No route exists for this patient'
      }, 404);
    }
    
    return jsonResponse({
      success: true,
      route: route
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
  return corsResponse(['GET', 'OPTIONS']);
}

