export const config = { runtime: 'edge' };

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const origin = req.headers.get('Origin') || '*';
  const base = (process.env.UPSTREAM_API_BASE || '').replace(//$/, ''); // ends without /
  const subPath = url.pathname.replace(/^/api/v1/?/, '');              // strip /api/v1/
  const target = `${base}/${subPath}${url.search}`;

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors(origin) });
  }

  // Proxy
  const hopByHop = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade','host','content-length']);
  const fwdHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (!hopByHop.has(k.toLowerCase())) fwdHeaders.set(k, v);
  }

  const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : await req.arrayBuffer();
  const resp = await fetch(target, { method: req.method, headers: fwdHeaders, body, redirect: 'manual' });

  const outHeaders = new Headers(cors(origin));
  for (const [k, v] of resp.headers.entries()) {
    if (!['content-encoding','content-length','transfer-encoding','connection'].includes(k.toLowerCase())) {
      outHeaders.set(k, v);
    }
  }

  return new Response(resp.body, { status: resp.status, headers: outHeaders });
}
