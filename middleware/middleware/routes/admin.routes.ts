/**
 * routes/admin.routes.ts
 * للحصول على PINs اليومي وعرض الإحصاءات اللحظية.
 */
import { beGetTodayPins } from '../services/backend.service.js';

export function mountAdminRoutes(app:any, be:any) {
  app.get('/mw/admin/pins/today', async (req:any, res:any) => {
    const pins = await beGetTodayPins();
    res.json(pins);
  });
  app.get('/mw/admin/live', (req:any, res:any) => {
    // Stub: اربط SSE هنا
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`event: ready
data: ok

`);
  });
}
