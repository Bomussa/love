// Robust Vercel proxy: forwards headers, query, and body; preserves status
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key  = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return res.status(500).json({ error: 'Missing Supabase env' });

  const p = req.query?.path || [];
  const fn = Array.isArray(p) ? p.join('-') : String(p||'').replace(/\/g,'-').replace(///g,'-');

  const url = new URL(`${base}/functions/v1/${fn}`);
  // pass-thru query params from original request (excluding the catch-all param)
  Object.entries(req.query||{}).forEach(([k,v])=>{ if(k!=='path'){ if(Array.isArray(v)){ v.forEach(x=>url.searchParams.append(k,String(x))); } else { url.searchParams.set(k,String(v)); } } });

  // copy headers (limited allow-list)
  const fwd = new Headers({ 'Authorization': `Bearer ${key}` });
  if (req.headers['content-type']) fwd.set('Content-Type', req.headers['content-type']);
  if (req.headers['x-request-id']) fwd.set('x-request-id', req.headers['x-request-id']);

  const method = (req.method||'GET').toUpperCase();
  let body;
  if (method==='POST' || method==='PUT' || method==='PATCH') {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  }

  try {
    const r = await fetch(url.toString(), { method, headers: fwd, body });
    // mirror response headers minimally
    res.setHeader('Content-Type', r.headers.get('content-type')||'application/json');
    const buf = await r.arrayBuffer();
    res.status(r.status).send(Buffer.from(buf));
  } catch(e){
    res.status(502).json({ error:'Proxy failed', message: e?.message||String(e) });
  }
};
