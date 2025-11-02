# Ops Runbook (Vercel + Supabase) — Additive
- This file is additive only. No existing files are modified.
- Health probes:
  - Front: `/.well-known/healthz.json` (static)
  - API: `/api/v1/healthz` (edge function)
- Vercel UI: Framework=Other, No build/No install.
- If you need rewrites, prefer Vercel UI to avoid file changes in repo.
