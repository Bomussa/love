# [Official Source of Truth] - Refer to [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for context

# FULL SYSTEM GUIDE — MMC-MMS (`Bomussa/love`)

This document explains the current system in a way that lets a maintainer understand the application flow, the important files, the maintenance boundaries, and the live data paths without needing old reports.

## 1) What the system is

`Bomussa/love` is the frontend application for the MMC-MMS queue and clinic workflow. The current live stack is:

- Frontend: Vite + React
- Data layer: Supabase direct calls and a same-origin `/api/v1` compatibility layer
- Hosting: Vercel for the frontend
- Backend/API repo: `Bomussa/love-api`
- Domain: `mmc-mms.com`

The active frontend is not a PIN-driven system anymore. Any old text that says the active workflow depends on PIN issuance or PIN validation is outdated.

## 2) High-level flow of the application

The application has three main user paths:

1. Patient / visitor flow
2. Doctor flow
3. Admin / operational flow

Each path begins in the UI, passes through `frontend/src/App.jsx`, then reaches either the direct Supabase service layer or the compatibility `/api/v1` layer.

### Patient path

1. User opens the login screen.
2. `frontend/src/components/LoginPage.jsx` collects the input.
3. `frontend/src/App.jsx` routes the event to the patient login handler.
4. `frontend/src/lib/api-unified.js` performs the live Supabase operation.
5. The patient then continues to exam selection and queue entry.
6. A route is created or updated if the workflow requires one.

### Doctor path

1. Doctor login starts in `LoginPage.jsx`.
2. `App.jsx` forwards the login call to the unified API layer.
3. `frontend/src/lib/api-unified.js` calls `supabase.rpc('doctor_login', ...)`.
4. `frontend/src/components/DoctorDashboard.jsx` manages the actual queue actions.
5. The doctor can call the next patient, start an exam, complete an exam, and advance a route.

### Admin / operations path

1. Admin access is routed through the auth wrappers.
2. `frontend/src/lib/auth-service.js` and `src/lib/auth-service.js` provide the login layer.
3. Older admin operations still exist through the `/api/v1` compatibility surface in `src/lib/api.js`.
4. Monitoring, stats, clinic lists, queue state, and recovery actions use the same compatibility layer or the direct Supabase path depending on the screen.

## 3) The three data-access layers and why they exist

### A. `frontend/src/lib/api-unified.js`

This is the direct Supabase service layer. It is currently the clearest live path for the core flows. It handles:

- patient login
- queue entry
- queue status lookups
- queue completion
- route creation and retrieval
- clinic listing
- doctor login via RPC
- admin login fallback behavior

This file is the primary place to inspect when something looks wrong in the live flow.

### B. `src/lib/api.js`

This is the same-origin `/api/v1` compatibility layer. It exists because the codebase still has historical and compatibility needs.

It handles:

- patient login
- queue creation
- queue status and position
- call next patient
- start examination
- advance patient
- route create/get
- clinics
- stats
- admin login
- recover queues
- health check
- legacy shims for queue entry and completion

This layer still matters because some screens or older utilities may still call it.

### C. `src/lib/local-api.js`

This is a legacy localStorage-backed fallback. It should be treated as compatibility only. It is not the source of truth for live behavior.

## 4) The core files and what they do

### `frontend/src/App.jsx`

This is the orchestration layer. It decides which screen is visible and which handler is called. It is also where login, exam selection, and queue flow are linked together.

### `frontend/src/components/LoginPage.jsx`

This screen collects login input for both patient and doctor use cases. It is the first place to inspect when login behavior is wrong, validation is broken, or the wrong handler is triggered.

### `frontend/src/components/DoctorDashboard.jsx`

This is the operational doctor screen. It is where the queue is actually controlled, where the next patient is called, and where exam lifecycle steps are managed.

### `frontend/src/lib/api-unified.js`

This file contains the direct Supabase implementation. It is responsible for the live queue path and the doctor login RPC.

### `src/lib/api.js`

This file is the API contract wrapper. It preserves `/api/v1` compatibility and provides offline queue buffering and legacy helpers.

### `frontend/src/lib/auth-service.js`

This is the frontend auth wrapper used by the live UI. It should remain aligned with the unified service layer.

### `src/lib/auth-service.js`

This is another auth wrapper used by older or alternate code paths. It should not diverge from the live login behavior.

## 5) The important algorithms and behaviors

### A. Queue idempotency

The queue creation path checks whether the patient already exists in the active queue for the same day. That prevents duplicate queue creation and duplicate medical-path assignments.

### B. Qatar day boundary logic

The queue logic uses UTC+3 calculations to match Qatar time. If this is changed casually, the system will misclassify “today” and produce incorrect queue states.

### C. Dynamic pathway creation

The patient route can be built dynamically from exam type and gender. This is important because the system is not a fixed linear flow; it can adapt the clinic sequence.

### D. Queue lifecycle timestamps

Statuses such as waiting, called, serving, in progress, done, completed, absent, and no-show are not just labels. They map to timestamps and state transitions.

### E. Offline write buffering

The compatibility API still uses offline write buffering in localStorage so failed write operations can be retried later. This is a recovery feature, not a live workflow.

## 6) Flow by screen group

### Screen group 1 — patient / visitor

- Login page
- Exam selection page
- Patient page
- Completion page
- Notifications page when applicable

Primary data path: `LoginPage.jsx` → `App.jsx` → `api-unified.js` → Supabase.

### Screen group 2 — doctor

- Login page in doctor mode
- Doctor dashboard
- Queue control and exam progression screens

Primary data path: `LoginPage.jsx` → `App.jsx` → `api-unified.js` and `DoctorDashboard.jsx`.

### Screen group 3 — admin / ops

- Admin dashboard
- Queue monitors
- PIN-related legacy monitors if still present in the UI
- clinic configuration panels
- system settings panels
- reports and stats panels

Primary data path: auth wrappers plus either Supabase direct or `/api/v1` compatibility calls.

## 7) What is current and what is legacy

### Current

- Supabase direct login and queue operations in `api-unified.js`
- doctor login via `doctor_login` RPC
- `/api/v1` compatibility surface in `src/lib/api.js`
- live doctor dashboard queue control
- current README and maintenance guide

### Legacy

- PIN issuance and PIN validation workflows
- old reports that still describe PIN as active
- archive files under `archive/`
- backup files like `*.old`, `*.backup`, and old reports that are not the live source of truth

## 8) Maintenance rules

When changing behavior, follow this order:

1. Update the live code path.
2. Verify the matching screen still calls the correct service function.
3. Verify the service function still points to the correct RPC or endpoint.
4. Update this guide and the root README.
5. Deprecate older explanation files so they stop being treated as current documentation.

## 9) How to rebuild the system from this document

A maintainer can reconstruct the application by following these steps:

1. Install dependencies.
2. Run the frontend.
3. Ensure Supabase variables are configured.
4. Confirm the login screen calls the correct handler.
5. Confirm queue creation uses the unified service layer.
6. Confirm doctor login uses the RPC path.
7. Confirm queue status, route creation, and doctor dashboard actions all reach the same source of truth.
8. Confirm `/api/v1` compatibility still works for older paths.
9. Confirm no current screen depends on old PIN logic.

## 10) Final operating statement

The source of truth for live behavior is the current frontend code plus the matching backend contract. Old reports are only historical context. They must not be used to describe the current runtime behavior.
