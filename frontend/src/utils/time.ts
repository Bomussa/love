import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';

import CONST from "../../config/constants.json" assert { type: "json" };
export const tz = CONST.TIMEZONE as string;
const pivot = CONST.SERVICE_DAY_PIVOT as string;

export function nowISO() {
  return new Date().toISOString();
}

export function localDateKeyAsiaQatar(d = new Date()) {
  const z = utcToZonedTime(d, tz);
  const [h, m] = pivot.split(':').map(Number);
  const pivotDate = new Date(z);
  pivotDate.setHours(h, m, 0, 0);
  // قبل 05:00 → ننسب لليوم السابق
  if (z.getTime() < pivotDate.getTime()) {
    const y = new Date(z);
    y.setDate(y.getDate() - 1);
    return format(y, 'yyyy-MM-dd', { timeZone: tz });
  }
  return format(z, 'yyyy-MM-dd', { timeZone: tz });
}
