module.exports = async (req, res) => {
  const allowOrigin = process.env.FRONTEND_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  res.setHeader('Content-Type', 'application/json');
  const base = (process.env.UPSTREAM_API_BASE || process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(//$/, '');

  if (base) {
    try {
      const r = await fetch(`${base}/queue/health`, { headers: { 'Content-Type': 'application/json' } });
      const data = await r.json().catch(() => ({}));
      res.statusCode = r.status || 200;
      return res.end(JSON.stringify({ ok: r.ok, via: 'proxy', upstream: data }));
    } catch (e) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ ok: false, via: 'proxy', error: 'UPSTREAM_UNREACHABLE', message: String(e) }));
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, stub: true, note: 'Set UPSTREAM_API_BASE or VITE_API_BASE_URL to enable live upstream check' }));
};
