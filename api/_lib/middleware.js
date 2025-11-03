// api/_lib/middleware.js
// Middleware for Vercel/Node API routes: CORS, logging, OPTIONS handling, unified error contract.
async function middleware(req, res, next = ()=>{}) {
  const origin = process.env.FRONTEND_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  const now = new Date().toISOString();
  console.log(`[API] ${now} ${req.method} ${req.url} ip=${req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress)}`);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  req._core = req._core || {};
  req._core.startTime = Date.now();
  req._core.handleError = (err) => {
    console.error('[API ERROR]', err && err.stack ? err.stack : err);
    const code = (err && err.statusCode) ? err.statusCode : 500;
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: true, message: (err && err.message) ? err.message : 'Internal Server Error' }));
  };

  try {
    await next();
  } catch (err) {
    req._core.handleError(err);
  }
}

// Dual export (CJS/ESM) for maximum compatibility on Vercel
module.exports = middleware;
module.exports.default = middleware;
export default middleware;
