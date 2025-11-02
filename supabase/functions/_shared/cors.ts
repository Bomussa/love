/**
 * CORS Utility for Supabase Edge Functions
 * 
 * Provides consistent CORS handling across all Edge Functions
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Create CORS headers for response
 */
export function getCorsHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return headers;
}

/**
 * Handle OPTIONS preflight requests
 * Returns Response if request is OPTIONS, null otherwise
 */
export function handleCorsPrelight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '';
    const headers = {
      ...getCorsHeaders(origin),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      'Access-Control-Max-Age': '86400',
    };
    
    return new Response(null, { status: 204, headers });
  }
  
  return null;
}

/**
 * Create Response with CORS headers
 */
export function corsResponse(
  body: string | null,
  options: { status?: number; headers?: Record<string, string>; origin?: string } = {}
): Response {
  const { status = 200, headers = {}, origin } = options;
  
  const corsHeaders = getCorsHeaders(origin);
  const allHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    ...headers,
  };
  
  return new Response(body, { status, headers: allHeaders });
}
