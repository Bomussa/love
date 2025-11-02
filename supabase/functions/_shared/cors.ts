export function allow(req: Request): string {
  const reqOrigin = req.headers.get('Origin') ?? '';
  const cfg = (typeof Deno !== 'undefined' && Deno.env?.get) ? Deno.env.get('FRONTEND_ORIGIN') : undefined;
  const allowed = cfg || 'https://mmc-mms.com';
  return reqOrigin && reqOrigin === allowed ? reqOrigin : allowed;
}
export function corsHeaders(origin: string): Headers {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', origin);
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  h.set('Access-Control-Max-Age', '600');
  h.set('Cache-Control', 'no-store');
  return h;
}
function withJson(h: Headers) { const x = new Headers(h); x.set('Content-Type','application/json; charset=utf-8'); return x; }
export function preflight(req: Request) {
  if (req.method === 'OPTIONS') {
    const origin = allow(req);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  return null;
}
export function ok(data: unknown, req: Request, status = 200) {
  const origin = allow(req);
  return new Response(JSON.stringify(data), { status, headers: withJson(corsHeaders(origin)) });
}
export function err(message: string, req: Request, status = 400, code?: string) {
  const origin = allow(req);
  return new Response(JSON.stringify({ ok: false, error: message, code }), { status, headers: withJson(corsHeaders(origin)) });
}
