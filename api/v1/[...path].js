/**
 * Vercel Serverless Function - API Proxy (fast path)
 * Maps /api/v1/* → Supabase Edge Functions and converts slashes to dashes.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Missing Supabase env' });

  const { path = [] } = req.query;
  const fn = Array.isArray(path) ? path.join('-') : String(path).replace(///g, '-');
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
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
