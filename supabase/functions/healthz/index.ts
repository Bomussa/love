/**
 * Supabase Edge Function: healthz
 * 
 * Health check endpoint for API monitoring
 * Returns basic service status
 */

import { corsHeaders, handleCorsRequest } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || undefined;

  // Handle CORS preflight
  const corsResponse = handleCorsRequest(req);
  if (corsResponse) {
    return corsResponse;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  }

  // Return health status
  const health = {
    ok: true,
    service: 'mmc-mms-api',
    timestamp: new Date().toISOString(),
    uptime: Deno.memoryUsage().heapUsed,
  };

  return new Response(
    JSON.stringify(health),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
});
