module.exports = async (req, res) => {
  try {
    const allowOrigin = process.env.FRONTEND_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

    res.setHeader('Content-Type', 'application/json');
    const base = (process.env.UPSTREAM_API_BASE || process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(//$/, '');

    if (!base) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, stub: true, base: null }));
    }

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(`${base}/queue/health`, { headers: { 'accept': 'application/json' }, signal: controller.signal });
    clearTimeout(to);

    const ct = r.headers.get('content-type') || '';
    let upstream = null;
    try { upstream = ct.includes('json') ? await r.json() : await r.text(); } catch (_) {}

    res.statusCode = r.ok ? 200 : (r.status || 200);
    return res.end(JSON.stringify({ ok: r.ok, via: 'proxy', status: r.status, upstream }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, via: 'proxy', error: 'HANDLER_ERROR', message: String(e && e.message ? e.message : e) }));
  }
};
