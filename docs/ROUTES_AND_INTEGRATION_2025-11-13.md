# MMC‑MMS Frontend Structure & Routes (Vite + Vercel)

This document outlines the frontend integration with Supabase Edge, route rewrites, SSE wiring, and dev/prod configs as of 2025‑11‑13.

## Overview

- App: React + Vite under `love/`, deployed on Vercel.
- Backend: Supabase Edge Functions (`api-router`, `events-stream`).
- All calls go through `/api/v1/*`; in production Vercel rewrites route to Supabase. In dev, Vite proxy uses `VITE_API_BASE`.

## Key Files

- `love/vercel.json`: rewrites for `/api/v1/events/stream` and `/api/v1/:path*` to Supabase.
- `love/vite.config.js`: dev proxy rules, including SSE `Cache-Control: no-cache` passthrough.
- `love/src/core/event-bus.js`: single `EventSource` to `${getApiBase()}/events/stream`; emits `sse:connected`, `sse:error`, `queue:update`, etc.
- `love/src/lib/api-base.js`: `getApiBase()` builds base as `${window.location.origin}/api/v1`, with `VITE_API_BASE` support in dev.
- `love/src/lib/api*.js`: REST clients build URLs from `getApiBase()`.

## Rewrites (Production)

- `/api/v1/events/stream` → `https://<project-ref>.functions.supabase.co/events-stream`
- `/api/v1/:path*` → `https://<project-ref>.functions.supabase.co/api-router?path=:path*`

## Dev Proxy

- Set `VITE_API_BASE` to your local tunnel or staging function base.
- Start dev server:

```
cd love
$env:VITE_API_BASE="http://localhost:3000"
pnpm dev:vite
```

## SSE Integration

- Use the existing singleton `EventSource` only; do not open multiple connections.
- SSE endpoint: `${getApiBase()}/events/stream`.
- Existing bus dispatches domain events (queue updates, connectivity) consumed by views.

## Conventions

- Never hardcode origins; always build URLs from `getApiBase()`.
- Don’t add CORS workarounds; CORS is handled in Supabase functions.
- Node engines: `>=18.17 <21` (use Node 20).
- Do not modify UI restricted paths (guarded by CI): `src/styles/`, `src/components/ui/`, `public/`, `src/assets/`.

## Health & Tests

- Health check:

```
cd love
$env:DEPLOY_URL="http://localhost:5173"
node scripts/test/vercel-health-check.js
```

- API quick tests:

```
node love/test-api-integration.js
node love/final-integration-test.js
```

## Notes

- Keep `Cache-Control: no-cache` for SSE on proxies.
- Realtime events should drive UI without polling where feasible.
