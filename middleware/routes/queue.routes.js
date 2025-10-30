import { issueQueueHandler } from '../handlers/queue.handler.js';
export async function queueRoutes(url, req, res, body, ctx){
  if(req.method==='POST' && url.pathname==='/mw/queue/issue'){
    return await issueQueueHandler(ctx)(req, res, body), true;
  }
  return false;
}
