/**
 * Shared CORS utility for Supabase Edge Functions
 * 
 * Provides consistent CORS handling across all Supabase functions
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Creates CORS headers for the given origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  };

  // Only set Allow-Origin if the origin is in our allowlist
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handles OPTIONS preflight request
 * Returns a Response with CORS headers
 */
export function handleOptions(request: Request): Response {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Creates a JSON response with CORS headers
 */
export function corsJsonResponse(
  data: unknown,
  status: number,
  origin: string | null
): Response {
  const headers = getCorsHeaders(origin);
  headers['Content-Type'] = 'application/json';

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

/**
 * Creates an error response with CORS headers
 */
export function corsErrorResponse(
  error: string,
  message: string,
  status: number,
  origin: string | null
): Response {
  return corsJsonResponse({ error, message }, status, origin);
}
