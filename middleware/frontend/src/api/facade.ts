/**
 * frontend/src/api/facade.ts
 * واجهة موحّدة للنداء نحو الطبقة الوسطية.
 */
export const MW = {
  startSession: (payload:any) => fetch('/mw/session/start', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()),
  clinicEnter:  (payload:any) => fetch('/mw/clinic/enter',   { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()),
  verifyPIN:    (payload:any) => fetch('/mw/pin/verify',     { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()),
  issueQueue:   (payload:any) => fetch('/mw/queue/issue',    { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()),
  adminPins:    () => fetch('/mw/admin/pins/today').then(r=>r.json()),
  adminLive:    () => new EventSource('/mw/admin/live')
};
