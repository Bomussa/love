const ADMIN_EF = 'https://rujwuruuosffcxazymit.supabase.co/functions/v1/admin-login';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => { resolve(data); });
    req.on('error', () => { resolve('{}'); });
  });
}

function readOrigin(req) {
  return req.headers.origin || req.headers.referer || '';
}

export default async function handler(req, res) {
  const origin = readOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const raw = await rawBody(req);
    const r = await fetch(ADMIN_EF, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw || '{}',
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
