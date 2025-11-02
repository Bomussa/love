/**
 * Supabase Edge Function: /api/v1/healthz
 * 
 * Purpose: Health check endpoint for API monitoring
 * Returns basic health status and timestamp
 */

import { handleOptions, corsJsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    return optionsResponse;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    const origin = req.headers.get('origin');
    return corsJsonResponse(
      { error: 'Method Not Allowed', allowed: ['GET', 'OPTIONS'] },
      405,
      origin
    );
  }

  // Return health status
  const origin = req.headers.get('origin');
  return corsJsonResponse(
    {
      ok: true,
      service: 'mmc-mms-api',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    200,
    origin
  );
});
