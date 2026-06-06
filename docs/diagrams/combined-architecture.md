# Combined Architecture

```mermaid
flowchart LR
  BROWSER[Frontend React App] --> APIU[frontend/src/lib/api-unified.js]
  APIU --> VERCEL[vercel.json rewrite layer]
  VERCEL --> V1[love-api api/v1.js]
  V1 --> HANDLERS[love-api lib/api-handlers.js]
  HANDLERS --> HELPERS[lib/helpers-enhanced.js]
  HANDLERS --> SUPA[lib/supabase-enhanced.js]
  HANDLERS --> AUTH[lib/admin-auth.js]
  HANDLERS --> ROUTING[lib/routing.js]
  HANDLERS --> REPORTS[lib/reports.js]
  HANDLERS --> QUEUE[lib/queue.ts]
  HANDLERS --> DB[Supabase PostgreSQL]

  SUPA_CLIENT[frontend/src/lib/supabase-client.js] --> DB
  API_ROUTER[supabase/functions/api-router/index.ts] --> HANDLERS
  ADMIN_LOGIN[supabase/functions/admin-login/index.ts] --> AUTH
  PATIENT_LOGIN[supabase/functions/patient-login/index.ts] --> HANDLERS
  PIN_STATUS[supabase/functions/pin-status/index.ts] --> HANDLERS
  QUEUE_ENTER[supabase/functions/queue-enter/index.ts] --> QUEUE
  QUEUE_CALL[supabase/functions/queue-call/index.ts] --> QUEUE
  QUEUE_STATUS[supabase/functions/queue-status/index.ts] --> QUEUE
```

## Verified runtime path
- Frontend routes and client workflow calls originate in `frontend/src/App.jsx` and `frontend/src/lib/api-unified.js`.
- Backend canonical HTTP entry is `love-api/api/v1.js`, which delegates to `love-api/lib/api-handlers.js`.
- Queue Edge Functions are compatibility wrappers over the canonical queue domain.
