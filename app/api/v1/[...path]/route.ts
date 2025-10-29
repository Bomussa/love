// app/api/v1/[...path]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORIGINS = (process.env.FRONTEND_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean);
const UPSTREAM = process.env.UPSTREAM_API_BASE!; // مثال: https://api.mmc-mms.com/api/v1

function cors(req: Request) {
  const origin = req.headers.get('origin');
  const h = new Headers();
  if (!ORIGINS.length || (origin && ORIGINS.includes(origin))) h.set('Access-Control-Allow-Origin', origin || '*');
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Credentials', 'true');
  h.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  h.set('Access-Control-Allow-Headers', req.headers.get('access-control-request-headers') || 'content-type,authorization');
  return h;
}

async function proxy(req: Request, ctx: { params: { path?: string[] } }) {
  const segs = (ctx.params.path ?? []).join('/');
  const url = `${UPSTREAM.replace(/\/$/, '')}/${segs}${new URL(req.url).search}`;
  const init: RequestInit = {
    method: req.method,
    headers: new Headers(req.headers),
    redirect: 'manual'
  };
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) init.body = await req.arrayBuffer();
  const r = await fetch(url, init);
  const headers = new Headers(r.headers);
  cors(req).forEach((v,k)=>headers.set(k,v));
  return new Response(r.body, { status: r.status, headers });
}

export function OPTIONS(req: Request) { return new Response(null, { status: 204, headers: cors(req) }); }
export function GET(req: Request, ctx: any) { return proxy(req, ctx); }
export function HEAD(req: Request, ctx: any) { return proxy(req, ctx); }
export function POST(req: Request, ctx: any) { return proxy(req, ctx); }
export function PUT(req: Request, ctx: any) { return proxy(req, ctx); }
export function PATCH(req: Request, ctx: any) { return proxy(req, ctx); }
export function DELETE(req: Request, ctx: any) { return proxy(req, ctx); }
