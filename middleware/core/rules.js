/**
 * قواعد عامة (تُقرأ يوميًا من الـBackend إن لزم) — لا تخزن هنا.
 */
export const RULES = Object.freeze({
  sessionHours: 24,
  queueRevalidateMs: 5000,
  retryDelays: [5000, 10000]
});
