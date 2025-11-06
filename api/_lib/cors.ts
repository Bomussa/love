import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOW = (process.env.CORS_ALLOW_ORIGIN || '*')
  .split(',').map(s => s.trim()).filter(Boolean);

export default async function cors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '';
  if (ALLOW.includes('*') || ALLOW.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}
