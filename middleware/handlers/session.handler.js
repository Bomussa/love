import { run } from '../core/engine.js';
export const startSessionHandler = (ctx) => async (req, res, body) => {
  const out = await run('session.start', body, ctx);
  res.json(out);
};
