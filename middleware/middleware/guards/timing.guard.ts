/**
 * guards/timing.guard.ts
 * ترتيب الأحداث (منطقي لا زمني).
 */
export function ensureOrder(kind: string, payload: any) {
  // مثال: لا يمكن إصدار queue قبل pin.verify لانتقال العيادة
  // (المنطق التفصيلي يضبط لاحقًا حسب المسار).
  return true;
}
