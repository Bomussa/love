# Ops Runbook (Vercel + Supabase)

## 1) Health Probes
- Front: `/.well-known/healthz.json` (static)
- API: `/api/v1/healthz` (edge function)

## 2) Vercel Settings
- Framework: Other
- No Build / No Install / Output: root
- vercel.json: rewrite `/api/v1/*` -> `https://rujwuruuosffcazymit.supabase.co/functions/v1/*`
- This enables same-domain API calls eliminating CORS issues
- Note: If Supabase project URL changes, update the destination in vercel.json

## 3) Env
- VITE_API_BASE_URL = `/api/v1` (recommended, uses same-origin via rewrite)
  - Alternative: `https://mmc-mms.com/api/v1` (also works with rewrite)
- SUPABASE_URL / VITE_SUPABASE_URL configured

## 4) Smoke
`curl -sSf https://<domain>/.well-known/healthz.json | jq .ok` -> true
`curl -sSI https://<domain>/api/v1/healthz | head -n1` -> HTTP/1.1 200 (or 401 if protected)

## 5) Automated Deployment
- GitHub Actions workflow `.github/workflows/deploy-vercel.yml` handles:
  - Deploy to Vercel (production on main, preview on PRs)
  - Smoke tests: frontend health, API health via /api/v1, CORS preflight
- Required secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

## 6) Rollback
- Revert to previous successful commit on main if deploy fails.
