# Backend – Queue Minimal

This folder contains the **only backend you asked for**: queue hardening + policies.

- Apply `sql/queue_min.sql` on your Postgres (Supabase) database.
- It enforces status enum, not nulls, uniqueness, RLS with staff-only writes, and indices.
- No frontend files are touched.

**Run order:**
1) Execute SQL in Dashboard → SQL Editor.
2) Verify: `SELECT * FROM public.queue LIMIT 5;`
3) Test endpoints (functions) with a valid `Authorization: Bearer <JWT>` header.

Security notes:
- Do **not** open anon write access.
- For public read, expose a VIEW without PII (not included by default).
