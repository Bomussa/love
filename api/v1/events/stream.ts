export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const API_ORIGIN = (process.env.API_ORIGIN || '').replace(/\/+$/,'');
  if (!API_ORIGIN) return new Response('API_ORIGIN not set', { status: 500 });

  const inUrl = new URL(req.url);
  const target = `${API_ORIGIN}/api/v1/events/stream${inUrl.search}`;

  const upstream = await fetch(target, {
    method: 'GET',
    headers: {
      'accept': 'text/event-stream',
      'authorization': req.headers.get('authorization') ?? ''
    },
    redirect: 'manual'
  });

  if (!upstream.ok) return new Response(`Upstream ${upstream.status}`, { status: 502 });

  const headers = new Headers(upstream.headers);
  const allow = (process.env.CORS_ALLOW_ORIGIN || '*');
  headers.set('access-control-allow-origin', allow.includes(',') ? '*' : allow);
  headers.set('cache-control', 'no-store');

  return new Response(upstream.body, { status: 200, headers });
}
