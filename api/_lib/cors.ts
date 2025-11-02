const ALLOWED = process.env.FRONTEND_ORIGIN || 'https://mmc-mms.com';
export function setCors(res: any, origin = ALLOWED) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Cache-Control', 'no-store');
}
export function handlePreflight(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}
export function sendJson(res: any, status: number, body: unknown) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
