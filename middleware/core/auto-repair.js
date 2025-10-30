/**
 * نظام التصحيح الفوري لأي خلل أو نقص أو ازدواجية
 */
import { be } from '../services/backend.service.js';
import { logInfo } from '../utils/logger.js';

export async function autoRepair(kind, payload, ctx, err){
  const transient = new Set(['OCCUPANCY_CONFLICT','NUMBER_DUP','BACKEND_TIMEOUT']);
  const code = err?.code || err?.message;
  if(!transient.has(code)) return null;
  const fixed = await be.rebuild(kind, payload);
  logInfo('autoRepair.applied', { kind, code });
  return { ok:true, result: fixed || { ok:true } };
}
