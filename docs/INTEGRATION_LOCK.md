# Integration Lock – Vercel ↔ Supabase

- Single source of truth for rewrites: root `vercel.json`.
- Backend runs on Supabase Edge Functions only; no Vercel Serverless.
- Frontend uses only public envs:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Service role keys remain server-side (Supabase Secrets only).
- CI runs `scripts/smoke-test.mjs` against `${API_BASE}` on each push/PR.
- Five critical features validated by smoke tests: Queue, PIN, Realtime, Dynamic Routes, Reports.
