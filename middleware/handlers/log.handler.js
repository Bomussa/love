import { run } from '../core/engine.js';
export const clinicEnterHandler = (ctx) => async (req, res, body) => {
  const out = await run('clinic.enter', body, ctx);
  res.json(out);
};
