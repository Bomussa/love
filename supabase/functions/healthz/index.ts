/**
 * Supabase Edge Function: healthz
 * 
 * Purpose: Health check endpoint for monitoring and smoke tests
 * Returns 200 OK with basic status information
 */

import { handleCorsPrelight, corsResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  const origin = req.headers.get('origin') || undefined;

  // Only allow GET requests
  if (req.method !== 'GET') {
    return corsResponse(
      JSON.stringify({ 
        error: 'Method Not Allowed',
        allowed: ['GET', 'OPTIONS'] 
      }),
      { status: 405, origin }
    );
  }

  try {
    const healthData = {
      ok: true,
      status: 'healthy',
      service: 'supabase-edge-functions',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };

    return corsResponse(
      JSON.stringify(healthData),
      { status: 200, origin }
    );
  } catch (error) {
    console.error('Health check error:', error);
    
    return corsResponse(
      JSON.stringify({ 
        ok: false,
        status: 'error',
        error: 'Health check failed' 
      }),
      { status: 500, origin }
    );
  }
});
