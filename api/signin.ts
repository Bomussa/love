import { handlePreflight, sendJson, setCors } from './_lib/cors';
const UPSTREAM = (process.env.UPSTREAM_API_BASE || 'https://rujwuruuosffcazymit.supabase.co/functions/v1').replace(/\/$/, '');
const TARGET = `${UPSTREAM}/signin`;
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Authorization': req.headers['authorization'] || '',
        'X-Forwarded-For': (req.headers['x-forwarded-for'] || '') as string
      },
      body: raw,
      signal: controller.signal
    }).catch((err) => { if (err.name === 'AbortError') throw new Error('upstream_timeout'); throw err; });
    clearTimeout(t);
    const text = await r.text();
    setCors(res);
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(text);
  } catch (e: any) {
    return sendJson(res, 502, { ok: false, error: 'bad_upstream', detail: e?.message || 'proxy_error' });
  }
}
function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c.toString()));
    req.on('end', () => resolve(data || '{}'));
    req.on('error', reject);
  });
}
