# Live Production Verification — 2026-03-15

## 1) Domain and canonical checks
- mmc final URL (with -L): https://mmc-mms.com/
- www final URL (with -L): https://mmc-mms.com/
- mmc HTML SHA256: 4930106ab03945150f36ae96c3c73331305aa512bf7e594eb714fb9e201af9a5
- www HTML SHA256: 4930106ab03945150f36ae96c3c73331305aa512bf7e594eb714fb9e201af9a5
- canonical content parity: PASS

## 2) Route smoke checks (production)
- / => 200
- /admin => 200
- /patient => 200
- /display => 200

## 3) Supabase Functions checks
- healthz => HTTP 200 | body: {   "ok": true,   "service": "mmc-mms-api",   "timestamp": "2026-03-15T12:14:28.237Z",   "version": "1.0.0" }
- api-v1-status => HTTP 200 | body: {   "ok": true,   "ts": "2026-03-15T12:14:28.512Z" }
- queue-status => HTTP 200 | body: {"success":true,"data":{"clinic_id":"lab","queueLength":0,"totalInQueue":0,"currentServing":null,"next3":[]}}
- queue-engine => HTTP 404 | body: {"code":"NOT_FOUND","message":"Requested function was not found"}
- pin-verify => HTTP 404 | body: {"code":"NOT_FOUND","message":"Requested function was not found"}
- reports-daily => HTTP 404 | body: {"code":"NOT_FOUND","message":"Requested function was not found"}
- stats-dashboard => HTTP 200 | body: {"success":true,"message":"stats-dashboard endpoint"}
