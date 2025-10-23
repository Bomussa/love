/**
 * routes/notification.routes.ts
 */
import { notifyInfo } from '../handlers/notification.handler.js';

export function mountNotificationRoutes(app:any, be:any) {
  app.post('/mw/notify/info', notifyInfo(be));
}
