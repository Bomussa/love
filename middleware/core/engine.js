/**
 * المحرك الذكي المركزي
 */
import { validate } from './validation-engine.js';
import { orchestrate } from './orchestration.js';
import { autoRepair } from './auto-repair.js';
import { logWarn, logError } from '../utils/logger.js';

export async function run(kind, payload, ctx) {
  try {
    await validate(kind, payload, ctx);
    const result = await orchestrate(kind, payload, ctx);
    return { ok: true, result };
  } catch (err) {
    logWarn('engine.catch', { kind, err: err?.message });
    const repaired = await autoRepair(kind, payload, ctx, err);
    if (repaired?.ok) return { ok: true, result: repaired.result };
    logError('engine.fail', { kind, error: err?.message });
    throw err;
  }
}
