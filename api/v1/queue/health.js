module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const base = process.env.UPSTREAM_API_BASE;
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
  res.end(JSON.stringify({ ok: true, stub: true, note: 'Set UPSTREAM_API_BASE to enable live upstream check' }));
};
