# Ops Runbook (Add-Only)

## Health
- Front probe: `/.well-known/healthz.json`
- API probe: `/api/v1/healthz` (expected 200 or 401).

## Vercel UI
- Framework: Other
- Build: No build step required
- Install: No install step required

## Rollback
- Revert to last green deployment if error rate > 2%.
