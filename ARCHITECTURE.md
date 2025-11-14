# MMC-MMS Architecture (Vercel + Supabase)

## Overview
- Frontend: React + Vite (`love/`) deployed on Vercel (static hosting).
- Backend: Supabase Edge Functions (`love-api/`) behind rewrites.
- API surface: Frontend calls only `GET/POST /api/v1/*`.
- Realtime: Single SSE at `/api/v1/events/stream` → emits `queue_update`, `queue_call`, `heartbeat`, `notice`, `stats_update`.

## Request Flow
1) UI code builds URLs via `getApiBase()` → `${origin}/api/v1`.
2) In dev, Vite proxy forwards `/api` and `/api/v1/events/stream` to `$VITE_API_BASE` with `Cache-Control: no-cache`.
3) In prod, `vercel.json` rewrites `/api/v1/*` to Supabase functions (`api-router`, `events-stream`).

```
Browser → Vite (dev) / Vercel (prod) → /api/v1/* → Supabase Edge Functions → PostgREST/DB
```

## Key Files
- Proxy & rewrites
  - `vite.config.js`: dev proxy to `$VITE_API_BASE` (SSE no-cache)
  - `vercel.json`: production rewrites to Supabase Functions
- API base & REST client
  - `src/lib/api-base.js`: `getApiBase()`
  - `src/lib/api.js`: `request()` + idempotency + offline queue
  - `src/utils/idempotency.js`: stable key generation + sent registry
- Realtime
  - `src/core/event-bus.js`: singleton, owns the only `EventSource`, publishes app events

## Patterns
- Always build URLs via `getApiBase()`
- One SSE connection only (via `event-bus.js`), subscribe using `eventBus.on()`
- For `POST|PUT|PATCH|DELETE`, send `X-Idempotency-Key` from `idempotency.js`
- Offline writes: enqueue failed mutations in `localStorage` and auto-replay when online

## Environment
- Node engines: `>=18.17 <21` (recommend Node 20). See `.nvmrc`.
- Dev API override: set `VITE_API_BASE` in shell for Vite dev.

## Health & Tests
- Local/preview health: `scripts/test/vercel-health-check.js`
- API integration tests: `test-api-integration.js`, `final-integration-test.js`
- E2E SSE helpers: `scripts/e2e/sse.ts`

## SSE Events (examples)
- `queue_update`: `{ clinic, current, waiting, list }`
- `queue_call`: `{ clinic, next }`
- `heartbeat`: ISO timestamp string
- `notice`: `{ type, message }`
- `stats_update`: `{ queues, throughput, occupancy }`

---
This doc summarizes the current, working integration—adjust only when rewrites or function names change.