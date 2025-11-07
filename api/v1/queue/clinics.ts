import type { VercelRequest, VercelResponse } from '@vercel/node';
import cors from '../../_lib/cors.js';
import { forward } from '../../_lib/proxy.js';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (await cors(req, res)) return;
  await forward(req, res, '/rest/v1/clinics?select=id,clinic_id,name_ar,name_en,is_open,current_number,daily_pin&order=clinic_id.asc');
};
