/**
 * handlers/queue.handler.ts
 */
import { processEvent } from '../core/engine.js';

export const issueQueue = (be:any) => async (req:any, res:any) => {
  const payload = await req.json();
  const out = await processEvent('queue.issue', payload, be);
  return res.json(out);
};
