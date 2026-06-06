# Maintenance Guide — `Bomussa/love`

This document is the operational map for the frontend repository. It is written so that a maintainer can find the failing layer, the responsible file, and the exact flow without reading the entire codebase first.

## 1) What this file covers

This guide covers the live frontend architecture, the current backend touch points, the important files, the main functions, and the maintenance order to use when something breaks.

The live frontend currently has three data-access layers:

- `frontend/src/lib/api-unified.js` and `frontend/src/lib/auth-service.js` — direct Supabase layer.
- `src/lib/api.js` — same-origin `/api/v1` compatibility layer.
- `src/lib/local-api.js` — legacy local fallback.

Only the first two should be treated as current operational paths. The local fallback is compatibility-only.

## 2) Fast triage order

When something fails, check in this order:

1. `frontend/src/components/LoginPage.jsx`
2. `frontend/src/App.jsx`
3. `frontend/src/lib/api-unified.js`
4. `src/lib/api.js`
5. `frontend/src/components/DoctorDashboard.jsx`
6. `frontend/src/lib/auth-service.js`
7. `src/lib/auth-service.js`
8. `src/lib/local-api.js` only if you are handling an old fallback path

This order matters because the UI layer often hides the real failure in one of the service wrappers.

## 3) File map by responsibility

| File | Responsibility | What to inspect first |
|---|---|---|
| `frontend/src/App.jsx` | Global app state, screen routing, login dispatch, exam selection dispatch | `handleLogin`, `handleDoctorLogin`, `handleExamSelect` |
| `frontend/src/components/LoginPage.jsx` | Patient and doctor login form control | submit handlers, validation, error display |
| `frontend/src/components/DoctorDashboard.jsx` | Doctor workbench, queue control, exam lifecycle | call-next, start exam, finish exam, route steps |
| `frontend/src/lib/api-unified.js` | Direct Supabase service layer | RPC names, queue writes, route writes, doctor login |
| `frontend/src/lib/auth-service.js` | Frontend auth wrapper | admin login, session storage, role mapping |
| `src/lib/api.js` | `/api/v1` compatibility contract | endpoint names, offline fallback, legacy shims |
| `src/lib/auth-service.js` | Alternate auth wrapper | fallback auth logic, permission logic, logout |
| `src/lib/local-api.js` | Legacy local simulation | only for compatibility debugging |
| `src/lib/dynamic-pathways.js` | Pathway generation | the branch that chooses clinic sequences |
| `src/lib/queueManager.js` and `src/lib/routingManager.js` | Queue/routing support | path state and queue transforms |
| `src/core/pin-engine.js` and `src/core/pinService.ts` | Legacy PIN-era logic | keep for history only, not as live frontend truth |
| `docs/` | Canonical documentation | only the current docs should be treated as authoritative |
| `archive/` | Historical material | never use as the source of truth for live behavior |

## 4) Current functions that matter most

### `frontend/src/lib/api-unified.js`

- `patientLogin(patientId, gender)`
  - Looks up or creates the patient in Supabase.
  - Keeps gender synchronized if the value changes.
- `enterQueue(clinicId, patientId, isAutoEnter, patientName, examType, gender, militaryId, personalId)`
  - Calls `supabase.rpc('enter_queue_safe', ...)`.
  - This is the canonical queue entry path.
- `getQueuePosition(clinicId, patientId)`
  - Reads `unified_queue` for today and calculates the number ahead.
- `queueDone(clinicId, patientId)`
  - Marks queue completion timestamps.
- `getSettings()`
  - Reads `system_settings`.
- `getRoute(patientId)` and `createRoute(patientId, examType, gender, stations)`
  - Reads and writes `patient_routes`.
- `getClinics()`
  - Reads active clinics only.
- `verifyPin(clinicId, _pin)`
  - PIN is removed in the live frontend path.
- `getQueueStatus(clinicId)`
  - Reads the current queue snapshot for the clinic.
- `callNextPatient(clinicId)`
  - Calls `supabase.rpc('call_next_patient', ...)`.
- `updateQueueStatus(clinicId, patientId, status)`
  - Updates the queue row with the correct timestamps.
- `createQueue(patientId, examType, gender, idempotencyKey)`
  - Prevents duplicate queue creation on the same day and attaches the dynamic pathway.
- `doctorLogin(username, password)`
  - Calls `supabase.rpc('doctor_login', ...)`.
- `adminLogin(username, password)`
  - Uses the doctors/admin identity path already present in the frontend code.

### `src/lib/api.js`

- `patientLogin(patientId, gender)`
- `createQueue(sessionId, examType, gender, idempotencyKey)`
- `getQueueStatus(queueIdOrClinicId, isClinic)`
- `getQueuePosition(clinicId, userId)`
- `getQueueCount(clinicId)`
- `callNextPatient(clinicId, doctorId)`
- `startExamination(queueId, doctorId)`
- `advancePatient(queueId, doctorClinicId, version)`
- `createRoute(patientId, examType, gender, stations)`
- `getRoute(patientId)`
- `getClinics()`
- `getQueues()` and `getQueueStats()`
- `adminLogin(username, password)`
- `recoverQueues()`
- `getSettings()`
- `getHealthStatus()`
- `enterQueue(clinicId, userId, isAutoEntry, name, queueType)`
- `queueDone(clinicId, userId)`
- `generatePIN()`, `getPinStatus()`, `getActivePins()`, `clinicExit()` are safe no-op shims and must not be treated as active business logic.

## 5) Algorithms and behaviors that must not be broken

### A. Qatar date normalization

Multiple queue functions use a UTC+3 offset to calculate the day correctly for Qatar. That logic is present in `api-unified.js` and `api.js`. If the date boundary is wrong, queue duplication and status queries will drift.

### B. Dynamic pathway generation

`createQueue()` uses `getDynamicMedicalPathway(examType, gender)` to produce the station sequence. If this branch fails, the patient can still queue, but the route may be incomplete.

### C. Idempotent queue creation

`createQueue()` first checks whether the patient already has an active queue entry for the same day. This prevents duplicates and is one of the most important protection layers in the app.

### D. Offline queue buffering

`src/lib/api.js` keeps a local queue of failed write operations under `mms.offlineQueue` and retries them when connectivity returns. Do not delete this without replacing it with an equivalent retry strategy.

### E. PIN removal

The live frontend path no longer relies on PIN issuance or PIN validation. Any old guide that still treats PIN as part of the active workflow is outdated.

## 6) How to find the failing layer quickly

### If login fails

- Check `frontend/src/components/LoginPage.jsx` for the handler.
- Check `frontend/src/App.jsx` for the dispatch target.
- Check `frontend/src/lib/api-unified.js` for the direct Supabase function.
- Check environment variables for the Supabase client.

### If the queue is duplicated or the screen is missing the route path

- Check `createQueue()` in `frontend/src/lib/api-unified.js`.
- Check the compatibility layer in `src/lib/api.js`.
- Check `getDynamicMedicalPathway()` in `src/lib/dynamic-pathways.js`.
- Check any old docs that still describe the wrong endpoint shape.

### If the doctor dashboard cannot call the next patient

- Check `frontend/src/components/DoctorDashboard.jsx`.
- Check `callNextPatient()` in `frontend/src/lib/api-unified.js`.
- Check the same operation in `src/lib/api.js` if the dashboard is using the compatibility layer.

### If admin login behaves inconsistently

- Check `frontend/src/lib/auth-service.js` first.
- Then check `src/lib/auth-service.js`.
- Then check the `/api/v1/admin/login` contract in `src/lib/api.js`.

## 7) Legacy material and what to do with it

These files exist only for history, rollback notes, or archived context:

- `archive/`
- `docs/README_OLD.md`
- `docs/API_INTEGRATION_COMPLETE.md`
- old reports in the root such as `FINAL_SUMMARY.md`, `PROJECT_REPORT.md`, `COMPLETE_PROJECT_REPORT.md`, `TEST_RESULTS_FINAL.md`, and similar historical status files
- PIN-era files and reports

Do not use them to understand current behavior unless you are intentionally checking how the system used to work.

## 8) Safe maintenance workflow

When you need to fix a live issue:

1. Identify the screen in `frontend/src/components/`.
2. Trace the event handler in `frontend/src/App.jsx`.
3. Trace the service function in `frontend/src/lib/api-unified.js` or `src/lib/api.js`.
4. Check the data model used by the function.
5. Compare the endpoint or RPC with the backend contract.
6. Update the canonical docs after the code is corrected.
7. Mark any older explanation file as deprecated, not authoritative.

## 9) What not to change casually

- The queue idempotency logic.
- The Qatar date normalization.
- The dynamic pathway generation.
- The `doctor_login` RPC flow.
- The compatibility `/api/v1` surface.
- The retry/offline queue behavior in `src/lib/api.js`.

If one of these needs to change, the code and the docs must change together.
