/**
 * Shared CORS utilities for Supabase Edge Functions
 * 
 * Provides consistent CORS handling across all edge functions
 * with strict origin validation and secure defaults.
 */

// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Create CORS headers for a response
 */
export function getCorsHeaders(origin?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  };

  // Only set Allow-Origin if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handle OPTIONS preflight request
 * Returns Response if OPTIONS, null otherwise
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 */
export function corsJsonResponse(
  data: unknown,
  status = 200,
  origin?: string | null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function corsErrorResponse(
  message: string,
  status = 400,
  origin?: string | null
): Response {
  return corsJsonResponse({ error: message }, status, origin);
}
