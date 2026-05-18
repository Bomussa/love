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
