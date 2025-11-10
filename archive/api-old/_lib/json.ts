/**
 * JSON response helpers with CORS support
 */

export interface CORSOptions {
  origin?: string;
  methods?: string;
  headers?: string;
  maxAge?: number;
}

export function getCORSHeaders(options?: CORSOptions): Record<string, string> {
  const origin = options?.origin || process.env.FRONTEND_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': options?.methods || 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': options?.headers || 'Content-Type, Authorization',
    'Access-Control-Max-Age': String(options?.maxAge || 86400),
  };
}

export function json(data: any, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  
  // Add CORS headers
  const corsHeaders = getCORSHeaders();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function safeJson(data: any, status = 200): Response {
  return json(data, { status });
}

export function error(message: string, status = 500): Response {
  return json({
    success: false,
    error: message,
  }, { status });
}

export function success(data: any): Response {
  return json({
    success: true,
    ...data,
  });
}

export function handleCORSPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(),
  });
}
