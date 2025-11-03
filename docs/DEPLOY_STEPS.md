# Quick Deploy Steps

1. Add secrets in GitHub repo **Settings → Secrets** (or in Vercel env):
   - `FRONTEND_ORIGIN` = `https://mmc-mms.com`
   - `UPSTREAM_API_BASE` = your Supabase Functions v1 base (e.g. `https://xxxx.supabase.co/functions/v1`)
   - `UPSTREAM_API_KEY` = (optional) bearer key if your upstream requires it
   - (Frontend) `VITE_API_BASE_URL` = `https://mmc-mms.com/api/v1`
   - (Optional) `VERCEL_DEPLOY_HOOK_URL` if you want workflows to auto-redeploy.
2. Commit the kit to the repo root, then **Run** the two workflows from **Actions** tab:
   - `audit-all-repos` → produces `reports/route-graph.json`
   - `wire-and-patch` → generates `api/v1/auto/*` and opens a PR
3. Merge PR → Redeploy in Vercel → Verify requests under **/api/v1/** return actual responses from upstream.
