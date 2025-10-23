/**
 * index.ts
 * نقطة التشغيل — استخدم أي خادم HTTP (Express/Fastify/Hono). هنا نضع Stub بسيط.
 */
import http from 'node:http';
import { getConfig } from './middleware/services/config.js';
import { mountSessionRoutes } from './middleware/routes/session.routes.js';
import { mountPinRoutes } from './middleware/routes/pin.routes.js';
import { mountQueueRoutes } from './middleware/routes/queue.routes.js';
import { mountNotificationRoutes } from './middleware/routes/notification.routes.js';
import { mountAdminRoutes } from './middleware/routes/admin.routes.js';

// Stub app: واجهة onRequest شبيهة بـ Express
function createApp() {
  const routes:any[] = [];
  const app = {
    post: (path:string, handler:any) => routes.push({ method:'POST', path, handler }),
    get:  (path:string, handler:any) => routes.push({ method:'GET',  path, handler }),
    routes
  };
  return app;
}

// Backend client placeholder
const BE = {};

const { MW_PORT } = getConfig();
const app = createApp();

// Mount routes
mountSessionRoutes(app, BE);
mountPinRoutes(app, BE);
mountQueueRoutes(app, BE);
mountNotificationRoutes(app, BE);
mountAdminRoutes(app, BE);

// Very simple router (for demo)
const server = http.createServer(async (req, res) => {
  const chunks:any[] = [];
  req.on('data', (c)=>chunks.push(c));
  await new Promise(r=>req.on('end', r));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  const url = req.url || '/';
  const route = app.routes.find(r => r.method === req.method && r.path === url);
  const apiRes = {
    json:(obj:any)=>{ res.setHeader('content-type','application/json'); res.end(JSON.stringify(obj)); }
  };
  if (!route) { res.statusCode=404; return res.end('Not Found'); }
  const reqWrap = { json: async ()=>body, headers: req.headers };
  try { await route.handler(reqWrap, apiRes); }
  catch(e:any){ res.statusCode=500; res.end(JSON.stringify({ ok:false, error:e?.message||'ERR' })); }
});

server.listen(Number(MW_PORT), ()=>{
  console.log(`Middleware V2 running on :${MW_PORT}`);
});
