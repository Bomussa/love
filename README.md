# MMC-MMS — Repository Guide

This is the current guide for the `Bomussa/love` frontend repository.

## What this repository is

`love` is the frontend application for the Military Medical Committee workflow. It is built with Vite + React and deployed on Vercel for the live domain `mmc-mms.com`.

## Source of truth

The live data source is Supabase. The frontend does not rely on dummy queue data or client-only state for the core patient, doctor, or admin journeys.

## Current application structure

The live application code is centered in:

- `frontend/src/App.jsx` — application routing and view orchestration
- `frontend/src/components/` — live patient, doctor, clinic, and admin screens
- `frontend/src/lib/api-unified.js` — direct Supabase service layer
- `frontend/src/lib/auth-service.js` — frontend authentication wrapper
- `frontend/src/lib/api.js` — `/api/v1` compatibility contract
- `frontend/src/lib/local-api.js` — legacy fallback path only


## Frontend source authority

The root `package.json` `build` script is the build source of truth for this repository. It runs the Vite production build from `frontend` (`cd frontend && ... vite build`), synchronizes runtime configuration there, and then copies `frontend/dist` back to the repository-level `dist` directory for deployment. The Vercel configuration also invokes `npm run build`, so production deployments follow this same path.

Because the production build executes from `frontend`, `frontend/src` is the authoritative frontend source tree. Treat files under the repository-level `src` directory as legacy or server/compatibility code unless a deployment configuration explicitly proves they are active. Do not make production UI fixes only in root `src/components`; migrate any needed changes into `frontend/src/components`.

Before archiving or deleting any duplicated component, compare the legacy and active copies with `diff -u src/path frontend/src/path`, migrate any missing production fixes into `frontend/src`, and perform that cleanup in a dedicated verified cleanup PR. CI runs `npm run check:duplicate-components` to fail when the same component path exists in both `src/components` and `frontend/src/components`.

## Active journeys

### Patient journey

The patient flow starts in `frontend/src/App.jsx`, moves through patient login, exam selection, queue entry, route creation, realtime queue tracking, and finishes on the completion screen when all stations are completed.

### Doctor journey

Doctors authenticate through the frontend auth flow and operate the live clinic queue, call the next patient, and complete the current station using the Supabase-backed service layer.

### Admin / clinic journey

Admins and clinic staff use the live queue monitor and control screens to view the current queue, call patients, and confirm completion. The queue display is driven by the canonical states:

- `waiting`
- `called`
- `completed`

## Legacy behavior

Old PIN-based clinic control is no longer part of the active frontend contract. Any older documentation that describes PIN issuance or PIN-based exit behavior should be treated as legacy.

## Environment variables

The frontend expects these environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE`

Optional deployment variables used in some scripts and deployment workflows:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Current documentation references

Use these files as the main references for the current repository state:

- `README.md` — current top-level guide
- `docs/DOCUMENTATION_INDEX.md` — documentation map
- `docs/FULL_SYSTEM_GUIDE.md` — full system architecture
- `docs/MAINTENANCE_GUIDE.md` — recovery and maintenance notes
- `docs/PROJECT_MEMORY.md` — project-level continuity notes

## Quick reference

- Frontend repo: `Bomussa/love`
- Backend/API repo: `Bomussa/love-api`
- Frontend deployment: `love`
- Backend/API deployment: `love-api`
- Domain: `mmc-mms.com`
- Stack: GitHub + Vercel + Supabase

## Maintenance notes

- Keep the live frontend aligned with Supabase and the `/api/v1` contract.
- Avoid reintroducing old PIN logic into active code or documentation.
- Keep documentation synchronized with the live `frontend/src` code path.
- Prefer canonical queue states and avoid mixed legacy status names in new code.
