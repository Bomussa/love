import { pinRoutes } from './pin.routes.js';
import { sessionRoutes } from './session.routes.js';
import { queueRoutes } from './queue.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { adminRoutes } from './admin.routes.js';

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
    });
  });
}

function json(res, status, data){
  res.statusCode = status;
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(data));
}

export async function router(req, res){
  const url = new URL(req.url, 'http://localhost');
  const ctx = { headers: req.headers, ip: req.socket.remoteAddress };

  const resWrap = { json: (obj)=> json(res, 200, obj) };
  const body = await parseBody(req);

  // mount
  if (await pinRoutes(url, req, resWrap, body, ctx)) return;
  if (await sessionRoutes(url, req, resWrap, body, ctx)) return;
  if (await queueRoutes(url, req, resWrap, body, ctx)) return;
  if (await notificationRoutes(url, req, resWrap, body, ctx)) return;
  if (await adminRoutes(url, req, resWrap, body, ctx)) return;

  json(res, 404, { ok:false, error:'NOT_FOUND' });
}
