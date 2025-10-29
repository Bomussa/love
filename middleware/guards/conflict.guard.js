// يمنع التعارض (جلسة مكررة / PIN خاطئ / رقم دور مكرر) — Placeholders حسب بيئتك
export async function ensureNoDupSession(payload){
  // تحقق عبر backend أو cache توقيع الجهاز/IP خلال 24h
  return true;
}
export async function ensureNoDupQueue(clinicId){
  return true;
}
