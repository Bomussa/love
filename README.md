# MMC-MMS — current repository guide

This is the authoritative, current documentation for the `Bomussa/love` repository.

## What this repository is

`love` is the frontend application for the Military Medical Committee queue and clinic workflow. The live application is built with Vite + React and is deployed on Vercel. The active production domain is `mmc-mms.com`.

## Current runtime architecture

There are three relevant data-access layers in this repository:

1. `src/lib/api-unified.js` and `src/lib/auth-service.js`
   - Direct Supabase access.
   - This is the active path for patient login, doctor login, queue entry, route creation, and most dashboard interactions.

2. `src/lib/api.js`
   - Same-origin `/api/v1` compatibility layer.
   - Uses `VITE_API_BASE` when provided, otherwise falls back to the current origin.
   - Preserves the contract surface for routes such as `/api/v1/patient/login`, `/api/v1/queue/create`, `/api/v1/queue/status`, `/api/v1/admin/login`, `/api/v1/route/create`, `/api/v1/clinics`, `/api/v1/settings`, `/api/v1/health`, `/api/v1/stats/dashboard`, and `/api/v1/stats/queues`.

3. `src/lib/local-api.js`
   - LocalStorage fallback.
   - Legacy compatibility only.
   - Not the primary live path.

## Active flows

### Patient flow

- `src/components/LoginPage.jsx` sends patient credentials into `src/App.jsx`.
- `src/App.jsx` calls `api.patientLogin(...)`.
- In `src/lib/api-unified.js`, patient login talks directly to Supabase.
- After login, the patient continues through exam selection and queue entry.

### Doctor flow

- `src/components/LoginPage.jsx` routes doctor credentials into `src/App.jsx`.
- `src/App.jsx` calls `api.doctorLogin(...)`.
- In `src/lib/api-unified.js`, doctor login calls `supabase.rpc('doctor_login', ...)`.
- `src/components/DoctorDashboard.jsx` is the operational doctor screen for queue control and exam lifecycle actions.

### Admin / clinic flow

- `src/lib/auth-service.js` wraps clinic/admin login.
- It calls `api.adminLogin(...)`.
- Administrative authentication and operational screens resolve through the Supabase-backed service path and the `/api/v1` compatibility layer.

## PIN system status

The PIN workflow is no longer part of the active frontend control path. Any old README or report that describes PIN issuance, PIN validation, or PIN-based clinic exit behavior is legacy and should not be treated as the source of truth.

## Repository layout that matters now

- `src/App.jsx` — application state, view routing, and login flow orchestration.
- `src/components/` — live UI screens.
- `src/lib/api-unified.js` — direct Supabase service layer.
- `src/lib/auth-service.js` — frontend auth wrapper.
- `src/lib/api.js` — `/api/v1` compatibility contract.
- `src/lib/local-api.js` — local fallback.
- `docs/` — current and legacy documentation.
- `archive/` — archived historical material.

## Environment variables

The frontend environment example currently focuses on Supabase and Vercel variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

If you need an API base for the compatibility layer, use `VITE_API_BASE`. Do not hardcode backend URLs into components.

## Canonical documentation policy

Use these files as the current references:

- `README.md` — current top-level guide
- `docs/DOCUMENTATION_INDEX.md` — documentation hierarchy and canonical map
- `docs/FULL_SYSTEM_GUIDE.md` — complete system flow and architecture
- `docs/MAINTENANCE_GUIDE.md` — troubleshooting and recovery

Do not use older archived reports as the source of truth for live behavior.

## Maintenance notes

- Keep the current frontend data path aligned with Supabase and the `/api/v1` compatibility layer.
- Avoid restoring old PIN logic into active documentation or code examples.
- Keep legacy reports short and clearly marked as deprecated.
- When documentation changes, update the canonical files first, then deprecate old reports.

## Quick reference

- Frontend repo: `Bomussa/love`
- Backend/API repo: `Bomussa/love-api`
- Frontend deployment: `love`
- Backend/API deployment: `love-api`
- Domain: `mmc-mms.com`
- Stack: GitHub + Vercel + Supabase

## Current state summary

- Live doctor login uses Supabase RPC.
- Live patient login uses Supabase-backed service code.
- Legacy PIN documentation has been retired.
- The compatibility `/api/v1` layer still exists for contract stability.
