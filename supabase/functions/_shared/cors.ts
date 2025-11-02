/**
 * CORS utility for Supabase Edge Functions
 * 
 * Handles CORS headers consistently across all edge functions
 */

const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

export function corsHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

export function handleCorsRequest(request: Request): Response | null {
  const origin = request.headers.get('origin') || undefined;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  return null;
}
