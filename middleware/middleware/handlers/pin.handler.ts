/**
 * handlers/pin.handler.ts
 */
import { processEvent } from '../core/engine.js';

export const verifyPin = (be:any) => async (req:any, res:any) => {
  const payload = await req.json();
  const out = await processEvent('pin.verify', payload, be);
  return res.json(out);
};
