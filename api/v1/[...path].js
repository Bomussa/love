// proxy v3 — minimal and safe
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key  = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return res.status(500).json({ error: 'Missing Supabase env' });
  const p = req.query?.path || [];
  const fn = Array.isArray(p) ? p.join('-') : String(p||'').replace(/\//g,'-');
  const url = `${base}/functions/v1/${fn}`;
  const headers = { Authorization: `Bearer ${key}` };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  const init = { method: req.method, headers };
  if (['POST','PUT','PATCH'].includes(req.method)) init.body = typeof req.body==='string'?req.body:JSON.stringify(req.body??{});
  try {
    const r = await fetch(url, init);
    const buf = await r.arrayBuffer();
    res.setHeader('Content-Type', r.headers.get('content-type')||'application/json');
    res.status(r.status).send(Buffer.from(buf));
  } catch (e){ res.status(502).json({ error:'Proxy failed', message: e?.message||String(e) }); }
};
