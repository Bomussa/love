/**
 * routes/queue.routes.ts
 */
import { clinicEnter } from '../handlers/log.handler.js';
import { issueQueue } from '../handlers/queue.handler.js';

export function mountQueueRoutes(app:any, be:any) {
  app.post('/mw/clinic/enter', clinicEnter(be));
  app.post('/mw/queue/issue', issueQueue(be));
}
