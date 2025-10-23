import { startSessionHandler } from '../handlers/session.handler.js';
export async function sessionRoutes(url, req, res, body, ctx){
  if(req.method==='POST' && url.pathname==='/mw/session/start'){
    return await startSessionHandler(ctx)(req, res, body), true;
  }
  if(req.method==='POST' && url.pathname==='/mw/clinic/enter'){
    const { clinicEnterHandler } = await import('../handlers/log.handler.js');
    return await clinicEnterHandler(ctx)(req, res, body), true;
  }
  return false;
}
