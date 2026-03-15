# Live Production QA Report — MMC-MMS

Date: 2026-03-15
Target: https://mmc-mms.com (and https://www.mmc-mms.com)
Method: Black-box live browser QA using Playwright against production UI.

## 1) Executive summary
- Production is reachable and renders the main UI in Arabic without a permanent spinner.
- `www.mmc-mms.com` redirects to `mmc-mms.com` and shows the same application.
- Core public/patient entry is partially working: login gate opens and moves to exam selection.
- Major live backend/API failures are present in normal browsing:
  - repeated `400` on multiple Supabase `HEAD`/`DELETE` calls,
  - repeated `404` on critical RPC endpoints (`verify_clinic_pin`, `update_operation_progress`, `start_patient_visit`).
- Admin login UI is reachable and validates field state; invalid credentials correctly return `401`.
- No valid admin credentials were provided in-session, so post-login admin pages/actions were not executable.

## 2) Tested flows
### A. Public access
- Opened `https://mmc-mms.com`.
- Opened `https://www.mmc-mms.com` and verified redirect/resulting content.
- Verified homepage rendering, language content, and visible layout stability.

### B. Navigation
- Tested visible top actions/buttons:
  - language toggle `English 🇺🇸`
  - `ℹ️ تعليمات الدخول`
  - `الإدارة`
  - theme buttons (all visible presets)
  - gender buttons (`👨 ذكر`, `👩 أنثى`)
  - `تأكيد ←`
- Tested direct routes:
  - `/login`, `/admin`, `/queue`, `/reviewer`, `/patient`, `/dashboard`, `/reports`, `/settings`.
- Tested back/forward/reload once after route traversal.

### C. Patient/Reviewer journey (unauthenticated -> entry flow)
- On home: filled personal/military number input.
- Checked confirm button state before/after gender selection.
- Submitted via `تأكيد ←` and verified transition to exam-type selection screen (`اختر نوع الفحص`).
- Clicked an exam card/button (`فحص التجنيد`) and observed behavior.

### D. Admin journey
- Opened admin entry modal from `الإدارة`.
- Verified required state behavior for admin submit button (`دخول ←` disabled until fields filled).
- Submitted invalid credentials and captured server `401` + in-UI error text.
- Authenticated admin pages/CRUD/search/filter/export could not be tested due to missing valid admin credentials.

### E. API/live behavior from browser
Captured live failures during normal UI usage:
- 400: `HEAD /rest/v1/clinics?select=count(*)`
- 400: `HEAD /rest/v1/pins?select=count(*)`
- 400: `HEAD /rest/v1/unified_queue?select=count(*)`
- 400: `HEAD /rest/v1/patients?select=count(*)`
- 400: `HEAD /rest/v1/roles?select=count(*)`
- 400: `DELETE /rest/v1/pins?valid_until=lt.<timestamp>`
- 404: `POST /rest/v1/rpc/verify_clinic_pin`
- 404: `POST /rest/v1/rpc/update_operation_progress`
- 404: `POST /rest/v1/rpc/start_patient_visit`
- 401 (expected with bad creds): `POST https://mmc-mms.com/api/v1/admin/login`

## 3) Passed items (verified by interaction)
1. **Homepage reachable and renders**
   - Action: Opened `https://mmc-mms.com`.
   - Result: Loaded with visible Arabic UI and interactive controls.
   - Evidence: `mobile_home.png`, `home_initial.png`.

2. **WWW domain parity/redirect**
   - Action: Opened `https://www.mmc-mms.com`.
   - Result: Redirected to `https://mmc-mms.com/` and displayed same app content.
   - Evidence: `www_mmc-mms_com.png`, `mmc-mms_com.png`.

3. **Instructions modal opens**
   - Action: Clicked `ℹ️ تعليمات الدخول`.
   - Result: Instructions overlay opened.
   - Evidence: `instructions_modal.png`.

4. **Patient gate proceeds to exam selection**
   - Action: Entered identifier and clicked `تأكيد ←`.
   - Result: Screen changed to exam selection with success text (`تم تسجيل الدخول بنجاح`).
   - Evidence: `after_confirm.png`, `confirm_without_gender.png`.

5. **Admin login validation state exists**
   - Action: Opened admin modal; checked submit state before/after input.
   - Result: `دخول ←` disabled before credentials, enabled after fields are filled.
   - Evidence: `admin_click_home.png`, `admin_wrong_submit.png`.

6. **Invalid admin login handling works**
   - Action: Submitted wrong credentials.
   - Result: UI error shown (`❌ اسم المستخدم أو كلمة المرور غير صحيحة`) and network `401`.
   - Evidence: `admin_wrong_submit.png`.

## 4) Failed items (verified)
1. **Critical RPC endpoints missing (404) during normal homepage/app load**
   - Page/URL: `https://mmc-mms.com/`
   - Exact action: Open app and wait for network/background initialization.
   - Expected: RPC endpoints should exist/respond successfully for operational flows.
   - Actual: `404` for:
     - `POST .../rpc/verify_clinic_pin`
     - `POST .../rpc/update_operation_progress`
     - `POST .../rpc/start_patient_visit`
   - Evidence: network capture + console errors in run logs and screenshots from same run context.
   - Suspected root cause (directly supported): backend database RPC functions/routes are absent or not exposed under current schema.
   - Severity: **Critical**.

2. **Repeated 400 responses for core Supabase table operations during basic usage**
   - Page/URL: `https://mmc-mms.com/` and route visits.
   - Exact action: Load app, navigate routes, open flows.
   - Expected: count/cleanup queries should succeed (2xx/3xx) or be intentionally skipped client-side.
   - Actual: repeated `400` on `HEAD` counts (`clinics`, `pins`, `unified_queue`, `patients`, `roles`) and `DELETE` on expired `pins`.
   - Evidence: captured network failures and console `Failed to load resource: ... 400`.
   - Suspected root cause (directly supported): live PostgREST query contract mismatch (table/view permissions, schema exposure, or malformed query expectations).
   - Severity: **High**.

3. **Patient flow step is partially working after exam button click**
   - Page/URL: `https://mmc-mms.com/` (post-confirm, exam selection screen).
   - Exact action: Clicked `فحص التجنيد` after successful entry.
   - Expected: move to next step/form/route for selected exam.
   - Actual: no observable transition; remains on exam selection screen.
   - Evidence: `after_exam_select.png` + captured page text remaining on same step.
   - Suspected root cause (directly supported): click handler progression likely blocked by failing backend dependencies (concurrent RPC/table 4xx/404 failures).
   - Severity: **High**.

4. **Route-level separation appears inaccessible or collapsed to same landing UI (unauthenticated)**
   - Page/URL: `/login`, `/admin`, `/queue`, `/reviewer`, `/patient`, `/dashboard`, `/reports`, `/settings`.
   - Exact action: Directly opened each route unauthenticated.
   - Expected: route-specific screens or clear auth gate/redirect rationale per route.
   - Actual: routes are reachable but mostly present the same landing/login shell, limiting route-specific functionality verification.
   - Evidence: route screenshots (`path_*.png`) and route-inspection output.
   - Suspected root cause (directly supported): route guard/fallback currently normalizes unauthenticated access to a single shell state.
   - Severity: **Medium**.

## 5) Console/network evidence summary
- Console repeatedly logs:
  - `Failed to load resource: the server responded with a status of 400 ()`
  - `Failed to load resource: the server responded with a status of 404 ()`
  - `Failed to load resource: the server responded with a status of 401 ()` (on invalid admin login test only)
- Network captured exact failing requests listed in section 2.E and section 4.

## 6) Severity classification
- **Critical**: Missing production RPC endpoints required by app runtime (`404` on key RPC methods).
- **High**: Repeated `400` on core data operations; patient progression appears blocked/partial.
- **Medium**: Route-specific pages not distinguishable/usable unauthenticated (possible intentional fallback, but functionally limits access and verification).
- **Low**: N/A (no low-impact-only issues recorded in this run).

## 7) Real completion percentage of live site (tested coverage)
- Public + entry UI tested deeply, with actual clicks/forms/network evidence: **~70% of visible unauthenticated surface**.
- Authenticated admin operational surface tested: **~10%** (login UI and invalid-credential handling only; no valid admin creds).
- Overall verified live completion for this session: **~62%**.

## 8) Exact next fixes required (mapped only to proven live breakages)
1. Restore/ship missing Supabase RPC endpoints used by production frontend:
   - `verify_clinic_pin`
   - `update_operation_progress`
   - `start_patient_visit`
2. Fix PostgREST failures causing repeated `400` on production count/cleanup operations:
   - `clinics`, `pins`, `unified_queue`, `patients`, `roles` count queries
   - expired `pins` cleanup delete call
3. Repair patient progression after exam-type selection so button click advances to next visible step.
4. Ensure unauthenticated route handling explicitly communicates access model (or route to distinct auth gates) for `/admin`, `/queue`, `/reviewer`, `/dashboard`, `/reports`, `/settings`.

## Evidence artifacts (screenshots)
- browser:/tmp/codex_browser_invocations/fde1db4b96bd5567/artifacts/artifacts/mmc-mms_com.png
- browser:/tmp/codex_browser_invocations/fde1db4b96bd5567/artifacts/artifacts/www_mmc-mms_com.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/home_initial.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_login.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_admin.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_queue.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_reviewer.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_patient.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_dashboard.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_reports.png
- browser:/tmp/codex_browser_invocations/e9fd886730e42fe8/artifacts/artifacts/path_settings.png
- browser:/tmp/codex_browser_invocations/0c921d29efcbb81b/artifacts/artifacts/mobile_home.png
- browser:/tmp/codex_browser_invocations/0c921d29efcbb81b/artifacts/artifacts/after_id_only.png
- browser:/tmp/codex_browser_invocations/0c921d29efcbb81b/artifacts/artifacts/after_gender.png
- browser:/tmp/codex_browser_invocations/0c921d29efcbb81b/artifacts/artifacts/after_confirm.png
- browser:/tmp/codex_browser_invocations/0c921d29efcbb81b/artifacts/artifacts/instructions_modal.png
- browser:/tmp/codex_browser_invocations/eb9fcc1830eb3cce/artifacts/artifacts/admin_click_home.png
- browser:/tmp/codex_browser_invocations/c4e3940dc10dcc2a/artifacts/artifacts/admin_wrong_submit.png
- browser:/tmp/codex_browser_invocations/1e9e456b90f00358/artifacts/artifacts/after_exam_select.png
- browser:/tmp/codex_browser_invocations/b4a0591f6ffdd829/artifacts/artifacts/confirm_without_gender.png
