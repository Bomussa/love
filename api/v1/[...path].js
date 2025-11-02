module.exports = async (req, res) => {
  try {
    const base = process.env.API_BASE_URL;
    if (!base) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'API_BASE_URL not configured' }));
      return;
    }

    const parts = req.query.path || [];
    const subpath = Array.isArray(parts) ? parts.join('/') : parts;
    const search = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetUrl = `${base.replace(/\/+/g, '')}/${subpath}${search}`;

    const method = req.method || 'GET';
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'host' || key.toLowerCase() === 'content-length') continue;
      headers[key] = value;
    }

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('access-control-allow-origin', headers.origin || '*');
      res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('access-control-allow-headers', headers['access-control-request-headers'] || 'authorization,content-type');
      res.end();
      return;
    }

    const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
    let body;
    if (hasBody) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const resp = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? body : undefined,
    });

    res.statusCode = resp.status;
    resp.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'transfer-encoding') return;
      if (k.toLowerCase() === 'content-length') return;
      res.setHeader(k, v);
    });

    const arrayBuffer = await resp.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Proxy error', detail: String((err && err.message) || err) }));
  }
};