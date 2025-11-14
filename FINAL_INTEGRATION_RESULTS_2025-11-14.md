# Final Integration Results — 2025‑11‑14

Scope: Vercel FE + Supabase Edge (api-router, events-stream) + SSE + Queue/PIN/Stats flows on https://www.mmc-mms.com

Summary
- Status: Pending test run (this file updates after scripts complete)
- Target: Pass rate ≥ 98%

Checks
- Health & KV: /api/v1/status
- SSE: /api/v1/events/stream (heartbeats, notices)
- Queue Flow: login → enter → position → call → done → stats
- PIN: /pin/status (masked), /admin/pin/status (reveals)

Notes
- Public pin/status does NOT expose pin numbers (security)
- Aliases added for clinics (EYE→eyes, DER→derma, XR→xray, LAB→lab, etc.)

Results
- Will be appended here after running `node final-integration-test.js` and `node test-5-patients.js`.
