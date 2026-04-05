export function computeEtaMinutes(ahead = 0, avgPerPatient = 2) {
  const safeAhead = Number.isFinite(Number(ahead)) ? Math.max(0, Number(ahead)) : 0;
  const safeAvg = Number.isFinite(Number(avgPerPatient)) ? Math.max(1, Number(avgPerPatient)) : 2;
  return safeAhead * safeAvg;
}
