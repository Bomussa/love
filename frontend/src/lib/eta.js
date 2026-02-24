/**
 * دالة موحدة لحساب الوقت المتوقع للانتظار (ETA)
 * @param {number} ahead - عدد الأشخاص المنتظرين قبلك
 * @param {number} intervalMin - الفترة الزمنية بين كل مراجع (بالدقائق)
 * @returns {number} الوقت المتوقع بالدقائق
 */
export function computeEtaMinutes(ahead, intervalMin = 2) {
  const a = Number.isFinite(ahead) ? Math.max(0, Math.floor(ahead)) : 0;
  const i = Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : 2;
  return a * i;
}

/**
 * تحويل الدقائق إلى صيغة mm:ss
 * @param {number} minutes - الدقائق
 * @returns {string} الوقت بصيغة mm:ss
 */
export function formatEtaTime(minutes) {
  const totalSeconds = Math.max(0, Math.floor(minutes * 60));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
