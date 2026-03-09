/**
 * Supabase Edge Function: /api/v1/healthz
 */

import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

Deno.serve((req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'GET') {
    return corsErrorResponse('Method Not Allowed', 405, req.headers.get('origin'), {
      allowed: ['GET', 'OPTIONS'],
    });
  }

  return corsJsonResponse({
    data: {
      ok: true,
      service: 'mmc-mms-api',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});
