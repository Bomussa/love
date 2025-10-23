/**
 * services/backend.service.ts
 * قناة موّحدة لكل استدعاءات الـBackend.
 * ملاحظة: استخدم BE_BASE_URL من config.
 */
import { getConfig } from './config.js';
const { BE_BASE_URL } = getConfig();

async function http(path: string, opts: any = {}) {
  const url = BE_BASE_URL.replace(/\/$/, '') + path;
  const res = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers||{}) } });
  if (!res.ok) throw new Error('BE_RESP_ERR');
  return res.status === 204 ? null : await res.json();
}

// جلسات
export const beSessionCheck = (payload:any) => http('/sessions/check', { method:'POST', body: JSON.stringify(payload) });
export const beLogEntry    = (sid:string, cid:string) => http('/log/entry', { method:'POST', body: JSON.stringify({ sessionId: sid, clinicId: cid }) });
export const beLogExit     = (sid:string, cid:string) => http('/log/exit',  { method:'POST', body: JSON.stringify({ sessionId: sid, clinicId: cid }) });

// PIN
export const bePinsVerify  = (sid:string, cid:string, pin:string) => http('/pins/verify', { method:'POST', body: JSON.stringify({ sessionId:sid, clinicId:cid, pin }) });

// Queue
export const beQueueIssue  = (cid:string) => http('/queue/issue', { method:'POST', body: JSON.stringify({ clinicId: cid }) });
export const beOccupancy   = (cid:string) => http(`/clinic/occupancy?clinicId=${encodeURIComponent(cid)}`);

// Checks
export const beCheckSessionDup = (deviceId:string, ip:string) => http('/sessions/check-dup', { method:'POST', body: JSON.stringify({ deviceId, ip }) });
export const beCheckQueueDup   = (cid:string) => http('/queue/check-dup', { method:'POST', body: JSON.stringify({ clinicId: cid }) });

// Auto repair
export const beRebuildRecord = (kind:string, payload:any) => http('/fix/rebuild', { method:'POST', body: JSON.stringify({ kind, payload }) });

// إدارة
export const beGetTodayPins = () => http('/pins/daily');
