// api/v1/[...rest].js
// Catch‑all proxy for /api/v1/* -> UPSTREAM_API_BASE, while letting specific handlers override.
const middleware = require('../_lib/middleware');
const { proxyRequest } = require('../_lib/proxy');

async function handler(req, res) {
  await middleware(req, res, async () => {
    const upstream = process.env.UPSTREAM_API_BASE || process.env.UPSTREAM_API || process.env.UPSTREAM;
    if (!upstream) {
      res.statusCode = 500;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({ error: true, message: 'UPSTREAM_API_BASE is not configured' }));
      return;
    }
    await proxyRequest(req, res, upstream);
  });
}

module.exports = handler;
module.exports.default = handler;
export default handler;
