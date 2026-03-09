const PRIMARY_ORIGIN = 'https://mmc-mms.com';

const ALLOWED_ORIGINS = new Set([
  PRIMARY_ORIGIN,
  'https://www.mmc-mms.com',
  'https://love-snowy-three.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]);

function isAllowedOrigin(origin?: string) {
  return !!origin && ALLOWED_ORIGINS.has(origin);
}

export function withCors(handler) {
  return async (req, res) => {
    const origin = req.headers.origin;

    if (origin && !isAllowedOrigin(origin)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', PRIMARY_ORIGIN);
      res.setHeader('Vary', 'Origin');
      res.end(JSON.stringify({ success: false, error: 'Origin not allowed', data: null }));
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin || PRIMARY_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    return handler(req, res);
  };
}
