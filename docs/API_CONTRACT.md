# API Contract (Production Official Endpoints)

This contract is the single source of truth for production API endpoints consumed by the frontend.

## Runtime base

- Supabase Edge Functions base: `/functions/v1`

## Official endpoints

| Endpoint | Method(s) | Source |
|---|---|---|
| `/functions/v1/api-v1-status` | GET, OPTIONS | `supabase/functions/api-v1-status/index.ts` |
| `/functions/v1/functions-proxy` | GET, OPTIONS | `supabase/functions/functions-proxy/index.ts` |
| `/functions/v1/healthz` | GET, OPTIONS | `supabase/functions/healthz/index.ts` |
| `/functions/v1/login` | POST, OPTIONS | `supabase/functions/login/index.ts` |
| `/functions/v1/pin-generate` | POST, OPTIONS | `supabase/functions/pin-generate/index.ts` |
| `/functions/v1/pin-status` | GET, OPTIONS | `supabase/functions/pin-status/index.ts` |
| `/functions/v1/pin-verify` | POST, OPTIONS | `supabase/functions/pin-verify/index.ts` |
| `/functions/v1/queue-call` | POST, OPTIONS | `supabase/functions/queue-call/index.ts` |
| `/functions/v1/queue-engine` | POST, OPTIONS | `supabase/functions/queue-engine/index.ts` |
| `/functions/v1/queue-enter` | POST, OPTIONS | `supabase/functions/queue-enter/index.ts` |
| `/functions/v1/queue-status` | GET, OPTIONS | `supabase/functions/queue-status/index.ts` |
| `/functions/v1/reports-daily` | GET, OPTIONS | `supabase/functions/reports-daily/index.ts` |
| `/functions/v1/stats-dashboard` | GET, OPTIONS | `supabase/functions/stats-dashboard/index.ts` |

## Explicitly blocked legacy endpoints

- `/api/v1/qa/deep_run`
- `/api/v1/repair/execute`
- `/api/v1/events/stream`
- `/api/v1/queue/done`

## Enforcement

- Build-time validation script: `node scripts/contracts/check-api-contract.mjs`
- Contract data source for validator: `frontend/config/api-contract.json`
