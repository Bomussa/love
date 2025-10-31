// Vercel Serverless Function (Node.js, CommonJS)
// Proxy /api/v1/* → Supabase Edge Functions (slashes→dashes) with CORS
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlBase = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!urlBase || !key) return res.status(500).json({ error: 'Missing Supabase env' });

  const q = req.query || {};
  const path = q.path || [];
  const fn = Array.isArray(path) ? path.join('-') : String(path || '').replace(/\/g, '-').replace(///g, '-');
  const url = `${urlBase}/functions/v1/${fn}`;

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const init = { method: req.method, headers };

  const method = (req.method || 'GET').toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    let body = req.body;
    if (typeof body === 'undefined' || body === null) body = {};
    if (typeof body !== 'string') body = JSON.stringify(body);
    init.body = body;
  }

  try {
    const r = await fetch(url, init);
    const txt = await r.text();
    try { return res.status(r.status).json(JSON.parse(txt)); } catch { return res.status(r.status).send(txt); }
  } catch (e) {
    return res.status(502).json({ error: 'Proxy failed', message: e && e.message ? e.message : String(e) });
  }
};
