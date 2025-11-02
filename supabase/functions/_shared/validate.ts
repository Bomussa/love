export function normalizeGender(g?: string) {
  const v = (g || '').trim().toLowerCase();
  if (['m','male','ذكر'].includes(v)) return 'male';
  if (['f','female','أنثى','انثى'].includes(v)) return 'female';
  return null;
}
export function validateId(id: unknown) {
  if (typeof id !== 'string' && typeof id !== 'number') return { ok:false, reason:'invalid_type' as const };
  const s = String(id).trim();
  if (!/^\d{5,20}$/.test(s)) return { ok:false, reason:'invalid_format' as const };
  return { ok:true, value:s };
}
