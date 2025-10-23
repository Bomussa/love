/**
 * handlers/log.handler.ts
 */
import { processEvent } from '../core/engine.js';

export const clinicEnter = (be:any) => async (req:any, res:any) => {
  const payload = await req.json();
  const out = await processEvent('clinic.enter', payload, be);
  return res.json(out);
};
