/**
 * routes/session.routes.ts
 */
import { startSession } from '../handlers/session.handler.js';

export function mountSessionRoutes(app:any, be:any) {
  app.post('/mw/session/start', startSession(be));
}
