export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  const x = req.query.x ?? null;
  res.status(200).json({ ok: true, service: 'ping', x, time: new Date().toISOString() });
}
