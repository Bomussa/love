# 06_DEPENDENCY_IMPACT_MAP
**Generated**: 2026-02-24

## Critical Dependencies

| Component | Depends On | Impact if Broken |
|-----------|-----------|-----------------|
| PatientPage.jsx | api-unified.js, notification-engine.js, supabase-client.js | Patient cannot join queue |
| notification-engine.js | supabase-client.js, operational_notifications table | Notifications fall back to hardcoded strings |
| AdminDashboardV2.jsx | All admin components, supabase-client.js | Admin panel unusable |
| PINManagement.jsx | pins table (Supabase) | PIN generation/display fails |
| queue-engine.js | event-bus.js, notification-engine.js | Queue state lost on page refresh |
| api-unified.js | love-api backend (Vercel) | Falls back to Supabase direct |

## Do-Not-Touch List (Stability Critical)
1. `frontend/src/lib/supabase-client.js` — Supabase connection config
2. `frontend/src/core/queue-engine.js` — Core queue logic
3. `vercel.json` — Deployment config (rewrites must stay as-is)
4. `frontend/tailwind.config.js` — Font config (Cairo unified)
5. `frontend/index.html` — Google Fonts import (Cairo wght@300..900)
6. Supabase RLS policies on `admins` table — Security critical
7. `queue_audit_trg` trigger — Audit trail integrity
8. `notifications_broadcast_trigger` — Realtime delivery

## Safe to Modify
- `frontend/src/components/` — UI components (with care)
- `docs/` — Documentation only
- `operational_notifications` table — Admin-controlled templates
- `direct_alerts` table — New feature data
