import { run } from '../core/engine.js';
export const verifyPinHandler = (ctx) => async (req, res, body) => {
  const out = await run('pin.verify', body, ctx);
  res.json(out);
};
