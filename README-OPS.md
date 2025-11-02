# Ops Runbook (Vercel + Supabase)

## 1) Health Probes
- Front: `/.well-known/healthz.json` (static)
- API: `/api/v1/healthz` (edge function)

## 2) Vercel Settings
- Framework: Other
- No Build / No Install / Output: root
- vercel.json: rewrite only `/api/v1/:path*` -> supabase functions

## 3) Env
- VITE_API_BASE_URL = https://mmc-mms.com/api/v1
- SUPABASE_URL / VITE_SUPABASE_URL configured

## 4) Smoke
`curl -sSf https://<domain>/.well-known/healthz.json | jq .ok` -> true
`curl -sSI https://<domain>/api/v1/healthz | head -n1` -> HTTP/1.1 200 (or 401 if protected)

## 5) Rollback
- Revert to previous successful commit on main if deploy fails.
