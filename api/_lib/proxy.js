// api/_lib/proxy.js
// Proxy helper: forward request to UPSTREAM_API_BASE preserving path, query, method and headers.
// Uses global fetch (Node 18+ / Vercel). No dependency on 'node-fetch'.
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyRequest(req, res, upstreamBase) {
  const origUrl = req.url || '/';
  const upstreamUrl = upstreamBase.replace(/\/$/, '') + origUrl;
  const method = req.method || 'GET';

  const headers = Object.assign({}, req.headers || {});
  delete headers.host;

  if (process.env.UPSTREAM_API_KEY) headers['authorization'] = `Bearer ${process.env.UPSTREAM_API_KEY}`;

  const opts = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    opts.body = (req.body && (typeof req.body === 'string' || Buffer.isBuffer(req.body))) ? req.body : await getRawBody(req);
  }

  const upstreamRes = await fetch(upstreamUrl, opts);
  res.statusCode = upstreamRes.status;

  for (const [k, v] of upstreamRes.headers) {
    if (k.toLowerCase() === 'transfer-encoding') continue;
    res.setHeader(k, v);
  }
  const ab = await upstreamRes.arrayBuffer();
  res.end(Buffer.from(ab));
}

module.exports = { proxyRequest };
export { proxyRequest };
export default { proxyRequest };
