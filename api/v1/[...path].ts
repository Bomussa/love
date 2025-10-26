/**
 * Vercel Edge Function - API Proxy for /api/v1/*
 * Forwards all requests to UPSTREAM_API_BASE with SSE and CORS support
 */

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const incomingURL = new URL(req.url);
  // Extract path after /api/v1/
  const subpath = incomingURL.pathname.replace(/^\/api\/v1\/?/, '');
  const qs = incomingURL.search || '';
  
  // Get upstream API base from environment
  const upstreamBase = (process.env.UPSTREAM_API_BASE || process.env.VITE_API_BASE || '').replace(/\/$/, '');
  
  if (!upstreamBase) {
    return withCORS(
      new Response(
        JSON.stringify({ success: false, error: 'UPSTREAM_API_BASE not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ),
      req
    );
  }
  
  const target = `${upstreamBase}/${subpath}${qs}`;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return withCORS(new Response(null, { status: 204 }), req);
  }

  // Prepare headers for upstream request (exclude hop-by-hop headers)
  // Note: This proxy forwards requests as-is. Authentication and authorization
  // should be handled by the upstream backend API, not at the proxy level.
  const hopByHop = new Set([
    'connection', 'keep-alive', 'proxy-connection', 
    'transfer-encoding', 'upgrade', 'http2-settings', 'te', 'trailers'
  ]);
  
  const incomingHeaders = new Headers(req.headers);
  const outgoingHeaders = new Headers();
  
  incomingHeaders.forEach((v, k) => {
    if (!hopByHop.has(k.toLowerCase())) {
      outgoingHeaders.set(k, v);
    }
  });
  
  if (!outgoingHeaders.has('content-type')) {
    outgoingHeaders.set('content-type', 'application/json');
  }

  // Prepare upstream request
  const init: RequestInit = {
    method: req.method,
    headers: outgoingHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined
  };

  try {
    const upstreamResp = await fetch(target, init);
    const respHeaders = new Headers(upstreamResp.headers);
    
    // Handle SSE streams
    const accept = incomingHeaders.get('accept') || '';
    if (accept.includes('text/event-stream')) {
      respHeaders.set('Content-Type', 'text/event-stream');
      respHeaders.set('Cache-Control', 'no-cache');
      respHeaders.set('Connection', 'keep-alive');
      respHeaders.set('X-Accel-Buffering', 'no');
    }
    
    const proxied = new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: respHeaders
    });
    
    return withCORS(proxied, req);
    
  } catch (err: any) {
    return withCORS(
      new Response(
        JSON.stringify({ success: false, error: String(err?.message || err) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      ),
      req
    );
  }
}

function withCORS(resp: Response, req: Request): Response {
  const origin = (req.headers.get('origin') || '').toString();
  // Only use configured FRONTEND_ORIGIN or the request origin if it exists
  // Never default to '*' for security reasons
  const allowOrigin = process.env.FRONTEND_ORIGIN || (origin || null);
  
  const h = new Headers(resp.headers);
  
  if (allowOrigin) {
    h.set('Access-Control-Allow-Origin', allowOrigin);
    h.set('Vary', 'Origin');
  }
  
  h.set('Access-Control-Allow-Credentials', 'true');
  h.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  
  return new Response(resp.body, {
    status: resp.status,
    headers: h
  });
}
