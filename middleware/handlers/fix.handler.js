import { run } from '../core/engine.js';
export const fixHandler = (ctx) => async (req, res, body) => {
  const out = await run('fix.trigger', body, ctx);
  res.json(out);
};
