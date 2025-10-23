/**
 * index.js — نقطة التشغيل الأساسية
 * سيرفر HTTP بسيط (من دون إطار) لتنفيذ المسارات. قابل للاستبدال بـ Fastify/Express لاحقًا.
 */
import http from 'node:http';
import { router } from './routes/router.js';
import { logInfo, logError } from './utils/logger.js';

const args = new URLSearchParams(process.argv.slice(2).join('&'));
const PORT = Number(args.get('port') || process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (e) {
    logError('unhandled', { error: e?.message });
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok:false, error:'INTERNAL' }));
  }
});

server.listen(PORT, () => logInfo('middleware.v2.1.up', { port: PORT }));
