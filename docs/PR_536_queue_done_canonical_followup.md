# Confirmed follow-up: queueDone still bypasses canonical API first

## Confirmed repository evidence

In `frontend/src/lib/api-unified.js`, the `queueDone` flow currently:
1. validates the PIN directly against Supabase,
2. updates the `pins` table directly,
3. updates the `queues` table directly,
4. only attempts `requestJson(`${resolveApiV1Base()}/queue/done`, ...)` inside the invalid-pin branch.

That means the frontend still does not prefer the canonical backend `/api/v1/queue/done` contract as the primary path.

## Why this matters

Recent backend work normalized canonical `/api/v1/*` handling and alias compatibility. Leaving `queueDone` primarily client-side creates avoidable contract drift risk between frontend and backend.

## What this branch adds

- A focused regression test that fails until `queueDone` calls the canonical API before any direct `queues` table mutation fallback.
- This branch is intentionally a guardrail follow-up, not a merge-ready runtime patch.

## Expected next implementation

Refactor `queueDone` so that:
- it first attempts `POST /api/v1/queue/done`,
- it only falls back to direct Supabase mutation when the canonical request is unavailable,
- it preserves current user-visible behavior and Arabic error semantics.
