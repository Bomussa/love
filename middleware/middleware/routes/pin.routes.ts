/**
 * routes/pin.routes.ts
 */
import { verifyPin } from '../handlers/pin.handler.js';

export function mountPinRoutes(app:any, be:any) {
  app.post('/mw/pin/verify', verifyPin(be));
}
