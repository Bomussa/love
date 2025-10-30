import { verifyPinHandler } from '../handlers/pin.handler.js';
export async function pinRoutes(url, req, res, body, ctx){
  if(req.method==='POST' && url.pathname==='/mw/pin/verify'){
    return await verifyPinHandler(ctx)(req, res, body), true;
  }
  return false;
}
