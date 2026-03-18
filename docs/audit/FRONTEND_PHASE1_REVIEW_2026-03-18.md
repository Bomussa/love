# Frontend Phase 1 Review — 2026-03-18

## Scope reviewed
- Uploaded package and attached reports
- Frontend repo structure from the provided archive
- Live-claim artifacts included in the attached docs
- Key integration surfaces between frontend `love` and backend/API contracts

## Verdict
The attached remediation package is **not safe to accept as-is**.
It contains useful ideas, but several claims are not supported by the actual repository snapshot, and there are contract mismatches that can reintroduce production failures.

## Evidence-based findings

### 1) The attached reports describe files that do not exist in the provided code snapshot
**Claim in attached docs**
- `corrected-frontend/src/tests/...`
- `corrected-backend/tests/...`
- `140+ tests`

**Observed in uploaded archive**
- No `corrected-frontend/` directory
- No `corrected-backend/` directory
- Frontend tests present in snapshot are under root `tests/` and existing repo files, not the described generated tree

**Impact**
- The package cannot be accepted as proof that the claimed corrected code was actually produced.
- Test counts and coverage numbers in the documents are therefore **unverified** from the uploaded snapshot.

### 2) Frontend and backend patient login contracts are inconsistent in the uploaded snapshot
**Frontend direct API client uses**
- `patientLogin(patientId, gender)`

**Backend handler excerpt in uploaded snapshot expects**
- `personalId` and `gender`

**Impact**
- Any frontend path using `/api/v1/patient/login` against that handler will fail with `MISSING_FIELDS` or equivalent contract mismatch.
- This is a root-cause level issue because it breaks first-step login flow.

### 3) Frontend main app currently imports `api-unified`, not the older `lib/api.js`
**Observed**
- `frontend/src/App.jsx` imports `./lib/api-unified`

**Impact**
- Some attached findings target `lib/api.js`, but that is not the primary runtime path for the current frontend entry flow.
- Fixes proposed only against `lib/api.js` are insufficient for current production behavior.

### 4) Frontend fallback queue insertion is still vulnerable to race conditions
**Observed in `frontend/src/lib/api-unified.js`**
- RPC path is attempted first: `enter_unified_queue_safe`
- Fallback path manually reads last `display_number`, then inserts next number

**Impact**
- If the RPC fails and fallback path is used concurrently, duplicate queue numbers remain possible.
- This directly threatens queue correctness.

### 5) Direct frontend writes to Supabase remain a critical architectural risk surface
**Observed in `frontend/src/lib/api-unified.js`**
- patient creation via `.from('patients').insert(...)`
- queue completion / queue writes / pin-related reads and writes done from frontend

**Impact**
- Runtime correctness depends heavily on RLS and exact schema state.
- Any policy drift can break the user flow or expose write surfaces unintentionally.
- This is especially risky for production admin and queue logic.

### 6) Attached report claims some endpoints are missing, while the uploaded backend snapshot includes multiple related implementations
**Observed**
- Attached docs claim missing `/api/v1/patient/login` and `/api/v1/pin/verify`
- Uploaded backend snapshot includes logic and/or function references for patient login, pin verify, queue enter, and related functions

**Impact**
- The report mixes repository states and cannot be treated as a reliable single-source execution record.
- Any automatic acceptance would be unsafe.

### 7) Security claims in the docs are partially contradicted by the snapshot
**Observed in uploaded snapshot**
- wildcard CORS still appears in multiple files
- `Math.random()` still appears in helper and test-support flows related to PIN/IDs/locks

**Impact**
- The statement “all security issues fixed” is not supported by the code snapshot that was attached.

## Required execution plan for Codex / implementer

### Phase 1 — frontend only (safe, minimal, production-first)
1. **Freeze runtime contract map**
   - Confirm which frontend paths hit `api-unified` vs proxy/API handlers vs direct Supabase.
   - Mark `lib/api.js` as non-runtime for the main patient/admin flows if confirmed.

2. **Unify patient login contract**
   - Standardize request body naming between frontend and backend handlers.
   - Accept a single canonical field name and add backward-compatible adapter only if already needed in production.

3. **Eliminate non-atomic queue fallback for production path**
   - Keep `enter_unified_queue_safe` as the only write path for queue entry in production flows.
   - If RPC is unavailable, fail safely with explicit error instead of manual next-number allocation.

4. **Reduce frontend write surface**
   - Move sensitive queue/PIN/admin mutations behind canonical API/RPC boundaries.
   - Keep frontend as orchestration/UI only where possible.

5. **Remove misleading dead code and stale fallback paths**
   - Audit and isolate unused `lib/api.js` runtime paths.
   - Remove or clearly mark mock-only code paths that can confuse deploy verification.

6. **Add targeted tests for current runtime path**
   - patient login contract compatibility
   - queue entry atomicity expectations
   - pin verification contract
   - admin login request path used by current frontend

## Merge gate
Do **not** merge any “full fix” PR unless all of the following are attached:
- exact changed-file list
- proof that runtime path is `api-unified` aware
- proof that patient login contract is unified
- proof that queue fallback no longer allocates numbers client-side after RPC failure
- passing frontend tests for current runtime path

## Final decision
- **Reject the attached remediation package as final**
- **Accept only as a partial idea set / draft analysis**
- **Execute a new frontend-only corrective PR based on current runtime code, not on the attached narrative claims**
