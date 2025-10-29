/**
 * handlers/session.handler.ts
 */
import { processEvent } from '../core/engine.js';

export const startSession = (be:any) => async (req:any, res:any) => {
  const payload = await req.json();
  const out = await processEvent('session.start', payload, be);
  return res.json(out);
};
