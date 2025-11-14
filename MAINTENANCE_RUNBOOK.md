# Maintenance Runbook

## Daily
- Health check (preview/local):
  - `cd love; $env:DEPLOY_URL="http://localhost:5173"; node scripts/test/vercel-health-check.js`
- API smoke tests (production by default):
  - `cd love; node test-api-integration.js`

## After Deploy
- Verify rewrites & SSE:
  - `/api/v1/status` → 200
  - `/api/v1/events/stream` → event stream with `heartbeat`

## Troubleshooting
- Node version mismatch:
  - Use Node 20 (see `.nvmrc`), restart shell.
- API 404/500:
  - Confirm `VITE_API_BASE` in dev; check `vercel.json` in prod.
- SSE not receiving events:
  - Ensure dev proxy adds `Cache-Control: no-cache` (in `vite.config.js`).
  - Reload tab; only one global `EventSource` is created in `src/core/event-bus.js`.
- Idempotency conflicts:
  - Clear sent registry via DevTools: `localStorage.removeItem('mms.sentKeys')`.
- Offline queue stuck:
  - Clear queue: `localStorage.removeItem('mms.offlineQueue')`.

## Ops Utilities
- Replay requests using cookie session:
  - `COOKIE="session=..." node scripts/ops/replay-requests.cjs input.jsonl`

## References
- Proxy: `vite.config.js`
- Rewrites: `vercel.json`
- API Base: `src/lib/api-base.js`
- REST client & offline queue: `src/lib/api.js`
- Idempotency: `src/utils/idempotency.js`
- SSE bus: `src/core/event-bus.js`