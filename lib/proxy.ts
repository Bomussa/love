import type { VercelRequest, VercelResponse } from '@vercel/node';

function filterHeaders(h: VercelRequest['headers']) {
  const blocked = new Set(['host','connection','content-length']);
  const out: Record<string,string> = {};
  for (const [k,v] of Object.entries(h as any)) {
    if (!blocked.has(k.toLowerCase()) && typeof v === 'string') out[k] = v;
  }
  return out;
}

export async function forward(req: VercelRequest, res: VercelResponse, path: string) {
  const origin = process.env.API_ORIGIN;
  if (!origin) {
    res.status(500).json({ error: 'API_ORIGIN is not set' });
    return;
  }
  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const target = origin.replace(/\/+$/,'') + path + (url.search || '');

  const headers = filterHeaders(req.headers);
  const method = req.method || 'GET';
  const body = (method === 'GET' || method === 'HEAD') ? undefined :
    (typeof req.body === 'string' || Buffer.isBuffer(req.body)) ? req.body : JSON.stringify(req.body);

  const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });
  res.status(upstream.status);
  upstream.headers.forEach((v,k) => res.setHeader(k, v));
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
