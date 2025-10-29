/**
 * core/auto-repair.ts
 * محاولة تصحيح فوري عند اصطدام أخطاء قابلة للإصلاح.
 */
import { beRebuildRecord } from '../services/backend.service.js';
import { logInfo } from '../utils/logger.js';

export async function patchIfNeeded(kind: string, payload: any, be: any, err: any) {
  const transient = ['OCCUPANCY_CONFLICT', 'NUMBER_DUP', 'BACKEND_TIMEOUT'];
  if (!transient.includes(err?.code || err?.message)) return null;
  const fixed = await beRebuildRecord(kind, payload); // endpoint تصحيح عام
  logInfo('auto-repair', { kind, fixed });
  return { ok: true, result: fixed };
}
