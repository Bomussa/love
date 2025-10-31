/**
 * Vercel Serverless Function - API Proxy (fast path)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlBase = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!urlBase || !key) return res.status(500).json({ error: 'Missing Supabase env' });

  const { path = [] } = req.query;
  const fn = Array.isArray(path) ? path.join('-') : String(path).replace(///g, '-');
  const url = `${urlBase}/functions/v1/${fn}`;

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const init = { method: req.method, headers };
  if (['POST','PUT','PATCH'].includes(req.method)) init.body = JSON.stringify(req.body ?? {});

  try {
    const r = await fetch(url, init);
    const text = await r.text();
    try { return res.status(r.status).json(JSON.parse(text)); } catch { return res.status(r.status).send(text); }
  } catch (e) {
    return res.status(502).json({ error: 'Proxy failed', message: e?.message });
  }
}
