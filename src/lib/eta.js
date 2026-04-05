export function computeEtaMinutes(ahead = 0, avgPerPatient = 2) {
  const normalizedAhead = Number.isFinite(Number(ahead)) ? Number(ahead) : 0;
  const normalizedAvg = Number.isFinite(Number(avgPerPatient)) ? Number(avgPerPatient) : 2;
  return Math.max(0, Math.ceil(normalizedAhead * normalizedAvg));
}
