import { run } from '../core/engine.js';
export const issueQueueHandler = (ctx) => async (req, res, body) => {
  const out = await run('queue.issue', body, ctx);
  res.json(out);
};
