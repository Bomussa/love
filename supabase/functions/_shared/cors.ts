// Shared CORS + JSON response helpers for Supabase Edge Functions (Deno)
const STATIC_ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'https://www.mmc-mms.com',
  // Staging environments
  'https://staging.mmc-mms.com',
  'https://www.staging.mmc-mms.com',
] as const;

const VERCEL_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i;

const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Content-Type': 'application/json; charset=utf-8',
};

function getEnvAllowedOrigins(): string[] {
  const raw = Deno.env.get('CORS_ALLOWLIST') ?? '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const ALLOWED_ORIGINS = new Set<string>([...STATIC_ALLOWED_ORIGINS, ...getEnvAllowedOrigins()]);

export const corsHeaders: Record<string, string> = {
  ...BASE_CORS_HEADERS,
  'Access-Control-Allow-Origin': 'https://mmc-mms.com',
  Vary: 'Origin',
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

function extractOrigin(req: Request | null | undefined): string | null {
  const origin = req?.headers.get('Origin');
  return origin && origin.trim() ? origin : null;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_ORIGIN.test(origin);
}

export function getCorsHeaders(req?: Request | null, extraHeaders: Record<string, string> = {}): Record<string, string> {
  const origin = extractOrigin(req);
  const allowOrigin = isAllowedOrigin(origin) ? origin! : 'https://mmc-mms.com';

  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
    ...extraHeaders,
  };
}

export function isOptions(req: Request) {
  return req.method === 'OPTIONS';
}

export function handleOptions(req: Request): Response | null {
  if (!isOptions(req)) return null;
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}

export function corsJsonResponse(body: unknown, status = 200, req?: Request | null): Response {
  const envelope = normalizeEnvelope(body, status < 400);
  return new Response(JSON.stringify(envelope, null, 2), {
    status,
    headers: getCorsHeaders(req),
  });
}

export function corsErrorResponse(
  message: string,
  status = 400,
  req?: Request | null,
  data: unknown = null,
): Response {
  return corsJsonResponse({ success: false, error: message, data }, status, req);
}

export function ok(body: unknown, _extraHeaders: Record<string, string> = {}, req?: Request | null) {
  return corsJsonResponse({ success: true, error: null, data: body }, 200, req);
}

export function badRequest(message: string, details?: unknown, req?: Request | null) {
  return corsErrorResponse(message, 400, req, details ?? null);
}
