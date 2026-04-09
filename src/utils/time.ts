import { utcToZonedTime, format } from 'date-fns-tz';

// استيراد الإعدادات بشكل متوافق مع Vite
const tz = "Asia/Qatar";
const pivot = "05:00";

export function nowISO() {
  return new Date().toISOString();
}

/**
 * جلب مفتاح التاريخ المحلي بتوقيت قطر
 * يعتمد على نقطة التحول (Pivot) لليوم الخدمي
 */
export function localDateKeyAsiaQatar(d = new Date()) {
  const z = utcToZonedTime(d, tz);
  const [h, m] = pivot.split(':').map(Number);
  const pivotDate = new Date(z);
  pivotDate.setHours(h, m, 0, 0);
  
  // إذا كان الوقت الحالي قبل الساعة 5 صباحاً، نعتبره تابعاً لليوم السابق
  if (z.getTime() < pivotDate.getTime()) {
    const y = new Date(z);
    y.setDate(y.getDate() - 1);
    return format(y, 'yyyy-MM-dd', { timeZone: tz });
  }
  return format(z, 'yyyy-MM-dd', { timeZone: tz });
}
