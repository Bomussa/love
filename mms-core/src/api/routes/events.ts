import { Router } from 'express';
import { onNotice } from '../../core/notifications/notificationService';

export const eventsRouter = Router();

eventsRouter.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);
  
  const off = onNotice((n) => {
    res.write(`event: notice\ndata: ${JSON.stringify(n)}\n\n`);
  });
  
  req.on('close', () => off());
});

