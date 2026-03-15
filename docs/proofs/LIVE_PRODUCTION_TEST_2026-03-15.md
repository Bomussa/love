# Live Production Test Report — 2026-03-15

## Scope
- Domain behavior and canonical redirect:
  - `https://mmc-mms.com`
  - `https://www.mmc-mms.com`
- Public Supabase edge functions on project `rujwuruuosffcxazymit`
- High concurrency queue-entry test: 200 simultaneous users
- Dynamic route smoke (browser): `/`, `/admin`, `/patient`, `/display`

## Executed checks

### 1) Domain canonicalization
- `mmc-mms.com` returned HTTP 200.
- `www.mmc-mms.com` returned HTTP 308 redirect to `https://mmc-mms.com/`.
- Final HTML hashes for both domains were identical.

### 2) Supabase edge endpoints availability
Results:
- ✅ `healthz` => 200 with JSON `ok: true`
- ✅ `api-v1-status` => 200 with JSON `ok: true`
- ✅ `queue-status` => 200 (when `clinic_id` provided)
- ⚠️ `queue-engine` => 404 NOT_FOUND
- ⚠️ `pin-verify` => 404 NOT_FOUND
- ⚠️ `reports-daily` => 404 NOT_FOUND
- ⚠️ `stats-dashboard` => 200 but currently returns endpoint placeholder message only

### 3) Queue entry load test (200 concurrent)
Tool used: `tools/concurrency-test.js` after hardening the runner to use `curl` internally and controlled concurrency.

Run config:
- `CONCURRENT_USERS=200`
- `MAX_PARALLEL=40`
- `QUEUE_FUNCTION=queue-enter`
- `TEST_CLINIC_ID=lab`

Observed result:
- ❌ Success: `0/200`
- ❌ Fail: `200/200`
- ❌ Failure reason (all requests):
  - `Could not find the function public.get_next_queue_number(p_clinic_id, p_exam_type, p_patient_id) in the schema cache`

Conclusion:
- Production backend is currently failing queue entry due to missing/incorrect Postgres function signature in DB schema cache.
- With current backend state, no real queue numbers are generated for these 200 requests.

### 4) Dynamic route smoke test in browser
Playwright check loaded:
- `/`
- `/admin`
- `/patient`
- `/display`

All returned HTTP 200 and loaded the app shell successfully.

Artifact screenshot:
- `browser:/tmp/codex_browser_invocations/ef1c45615b80060c/artifacts/artifacts/mmc-routes.png`

## Fixes applied in repository (this branch)

### tools/concurrency-test.js
- Added support for selecting target function via `QUEUE_FUNCTION` (default `queue-enter`).
- Replaced Node `fetch` transport with `curl` execution for reliability in CI/container environments.
- Added bounded parallelism (`MAX_PARALLEL`) and retry support.
- Normalized response parsing for both `number` / `position` pin fields.
- Added clearer per-HTTP-code failure summary and first-5 error samples.

## Required backend remediation (production)
1. Repair DB function chain used by queue entry:
   - Ensure `public.get_next_queue_number(...)` exists with signature expected by `enter_queue_safe` (or update function calls to current signature).
2. Re-run migration integrity check against production schema and refresh PostgREST schema cache.
3. Re-run 200-user concurrency test and verify:
   - success rate >= 98%
   - duplicate numbers = 0
   - no request-level failures.
