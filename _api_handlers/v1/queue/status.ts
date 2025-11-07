import type { VercelRequest, VercelResponse } from '@vercel/node';
import cors from '../../_lib/cors.js';
import { forward } from '../../_lib/proxy.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (await cors(req, res)) return;
  await forward(req, res, '/api/v1/queue/status');
};
