/**
 * قناة الاتصال الوحيدة مع الـBackend
 */
const BE_BASE_URL = (process.env.BE_BASE_URL || 'http://localhost:8787/api/v1').replace(/\/$/,'');

async function http(path, opts={}){
  const res = await fetch(BE_BASE_URL + path, { ...opts, headers: { 'content-type':'application/json', ...(opts.headers||{}) } });
  if(!res.ok) throw new Error('BACKEND_TIMEOUT');
  return res.status === 204 ? null : await res.json();
}

export const be = {
  // PIN
  verifyPin: (sessionId, clinicId, pin) => http('/pins/verify', { method:'POST', body: JSON.stringify({ sessionId, clinicId, pin }) }),
  // Session
  clinicIsOpen: (clinicId) => http(`/clinic/is-open?clinicId=${encodeURIComponent(clinicId)}`),
  // Logs
  logEntry: (sid, cid) => http('/log/entry', { method:'POST', body: JSON.stringify({ sessionId:sid, clinicId:cid }) }),
  logExit:  (sid, cid) => http('/log/exit',  { method:'POST', body: JSON.stringify({ sessionId:sid, clinicId:cid }) }),
  // Queue
  issueQueue: (cid) => http('/queue/issue', { method:'POST', body: JSON.stringify({ clinicId: cid }) }),
  occupancy:  (cid) => http(`/clinic/occupancy?clinicId=${encodeURIComponent(cid)}`),
  // Repair
  rebuild: (kind, payload) => http('/fix/rebuild', { method:'POST', body: JSON.stringify({ kind, payload }) })
};
