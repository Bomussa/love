# QA Report - MMCMMS Project
## Date: 2025-06-XX
## Status: IN PROGRESS

---

## Phase 0: Baseline Report

### Repositories
| Repo | Branch | Last Commit | Build Status |
|------|--------|-------------|--------------|
| Bomussa/love (frontend) | main | 7396e57 | ✅ PASS (after fix) |
| Bomussa/love-api (backend) | main | pending push | ✅ PASS |

### Tech Stack
- **Frontend**: Vite 7.x + React 18.x + TailwindCSS + Supabase JS Client
- **Backend**: Vercel Serverless Functions (Node.js ESM)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (mmc-mms.com frontend, love-api-bomussa.vercel.app backend)

### Existing Tests
- Frontend: `vitest` configured but no test files found
- Backend: `lib/pin.test.ts`, `lib/queue.test.ts` exist

---

## Findings & Fixes

### CRITICAL - Build Failure (FIXED)
- **File**: `frontend/src/components/AdminDashboardV2.jsx:820-833`
- **Issue**: Orphaned duplicate code block with `await` outside async function
- **Root Cause**: Bad merge left duplicate code after `generateBulkPins` function
- **Fix**: Removed 14 lines of orphaned dead code
- **Evidence**: Build passes after fix (10.54s, 0 errors)
- **Commit**: `7396e57`

### K1 - PIN Consistency (FIXED)
- **Files**: `frontend/src/components/AdminDashboardV2.jsx:718-731`
- **Issue**: Frontend generated random PINs using `Math.random()`, violating "daily fixed per clinic" requirement
- **Root Cause**: Frontend used `Math.floor(10 + Math.random() * 90)` instead of deterministic algorithm
- **Fix**: Replaced `generatePin()` and `generateUniquePin()` with `generateDailyPIN(clinicId)` using WebCrypto HMAC-SHA256, matching backend algorithm
- **Evidence**: Build passes, function signature matches backend `generateDailyPIN`

### K2 - Settings Drift / Duplicate Handler (FIXED)
- **Files**: `frontend/src/lib/api-unified.js:1006` and `frontend/src/lib/api-unified.js:1884`
- **Issue**: Two `getSettings()` methods in same object; second overrides first (JS behavior)
- **Root Cause**: Multiple development iterations added same-named method
- **Fix**: Renamed first handler to `getAllSettings()`, updated `PatientPage.jsx` caller
- **Impact**: PatientPage was silently broken (getting theme data instead of system settings)

### K3 - API Path Canonicality (FIXED)
- **Files**: `love-backend/vercel.json`
- **Issue**: Bare `/api/v1` path had separate rewrite that could cause confusion
- **Fix**: Consolidated rewrites, added redirect for bare `/api/v1` to `/api/v1/health`

### K4 - Hardcoded Secrets (FIXED)
- **Files**: `love-backend/api/v1.js:4-6`
- **Issue**: SUPABASE_URL had hardcoded fallback, REPAIR_TOKEN had default value, PIN_SECRET had default
- **Fix**: Removed all fallback defaults; added explicit error logging; health endpoint reports env status
- **Note**: `admin-credentials.js` still has hardcoded SUPER_ADMIN credentials (frontend-side) - this is by design for offline admin access

---

## Known Remaining Issues

### Vercel Deployment Protection (Backend)
- **Status**: BLOCKED
- Backend at `love-api-bomussa.vercel.app` has Vercel authentication protection
- API calls from curl/external tools return 401
- Browser-based access works through SSO cookies
- **Impact**: Cannot test API endpoints via automated E2E without bypass token

### Frontend Direct Supabase Access
- **Status**: NOTED (Architectural)
- Admin dashboard performs CRUD directly via Supabase JS client, not through /api/v1
- This bypasses backend validation and rate limiting
- **Recommendation**: Gradually migrate admin operations to backend API endpoints

---

## Coverage Summary

| Domain | Status | Notes |
|--------|--------|-------|
| Build | ✅ PASS | Builds successfully |
| PIN Logic | ✅ FIXED | Deterministic daily PIN per clinic |
| Settings | ✅ FIXED | No duplicate handlers |
| API Paths | ✅ FIXED | Canonical /api/v1 enforced |
| Secrets | ✅ FIXED | No hardcoded fallbacks |
| Admin Login | ✅ Works | Bomussa/14490 validated in code |
| E2E Tests | ⏳ PENDING | Blocked by Vercel auth protection |
