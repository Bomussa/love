/**
 * core/engine.ts
 * المحرك الذكي: يدير استقبال الأحداث، التحقق، الحراسة، التصحيح، والتنسيق.
 * ملاحظة: لا تخزين هنا إطلاقًا.
 */
import { validateFlow } from './validation.js';
import { preventConflict } from '../guards/conflict.guard.js';
import { ensureOrder } from '../guards/timing.guard.js';
import { patchIfNeeded } from './auto-repair.js';
import { orchestrate } from './orchestration.js';
import { logInfo, logWarn, logError } from '../utils/logger.js';

export async function processEvent(kind: string, payload: any, be: any) {
  try {
    ensureOrder(kind, payload);          // ترتيب منطقي فقط
    await preventConflict(kind, payload, be); // منع ازدواج/تعارض
    await validateFlow(kind, payload, be);    // تحقق من قاعدة البيانات عبر الـBackend
    const result = await orchestrate(kind, payload, be); // تنفيذ الحدث
    return { ok: true, result };
  } catch (err:any) {
    logWarn('processEvent.catch', { kind, err: err.message });
    const fixed = await patchIfNeeded(kind, payload, be, err);
    if (fixed?.ok) return { ok: true, result: fixed.result };
    logError('processEvent.failed', { kind, error: err.stack });
    throw err;
  }
}
