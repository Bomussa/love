// Shared CORS + JSON response helpers for Supabase Edge Functions (Deno)
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Content-Type': 'application/json; charset=utf-8',
};

type ResponseEnvelope = {
  success: boolean;
  error: string | null;
  data: unknown;
};

function normalizeEnvelope(body: unknown, defaultSuccess: boolean): ResponseEnvelope {
  if (body && typeof body === 'object') {
    const candidate = body as Record<string, unknown>;
    if ('success' in candidate || 'error' in candidate || 'data' in candidate) {
      return {
        success: typeof candidate.success === 'boolean' ? candidate.success : defaultSuccess,
        error: typeof candidate.error === 'string' ? candidate.error : null,
        data: 'data' in candidate ? candidate.data : null,
      };
    }
  }

  return {
    success: defaultSuccess,
    error: defaultSuccess ? null : typeof body === 'string' ? body : 'Unknown error',
    data: defaultSuccess ? body : null,
  };
}

export function isOptions(req: Request) {
  return req.method === 'OPTIONS';
}

export function handleOptions(req: Request): Response | null {
  if (!isOptions(req)) return null;
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function corsJsonResponse(body: unknown, status = 200, _origin?: string | null): Response {
  const envelope = normalizeEnvelope(body, status < 400);
  return new Response(JSON.stringify(envelope, null, 2), {
    status,
    headers: corsHeaders,
  });
}

export function corsErrorResponse(
  message: string,
  status = 400,
  _origin?: string | null,
  data: unknown = null,
): Response {
  return corsJsonResponse({ success: false, error: message, data }, status);
}

export function ok(body: unknown, _extraHeaders: Record<string, string> = {}) {
  return corsJsonResponse({ success: true, error: null, data: body }, 200);
}

export function badRequest(message: string, details?: unknown) {
  return corsErrorResponse(message, 400, null, details ?? null);
}
