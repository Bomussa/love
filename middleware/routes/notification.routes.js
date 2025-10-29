import { notifyHandler } from '../handlers/notification.handler.js';
export async function notificationRoutes(url, req, res, body, ctx){
  if(req.method==='POST' && url.pathname==='/mw/notify/info'){
    return await notifyHandler(ctx)(req, res, body), true;
  }
  return false;
}
