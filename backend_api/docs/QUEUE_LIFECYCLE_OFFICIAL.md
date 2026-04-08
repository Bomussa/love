# Official Queue Lifecycle

This document defines the **single official lifecycle** for `public.queues.status`.

## Allowed statuses

1. `waiting`
2. `called`
3. `in_service`
4. `completed`

## Transition order

`waiting -> called -> in_service -> completed`

## Legacy status mapping

Older environments may still contain legacy values. They must be normalized to the official set:

- `serving` -> `in_service`
- `in_progress` -> `in_service`

## Enforcement

The database migration `supabase/migrations/20260316100000_queue_status_lifecycle_enforcement.sql`
normalizes legacy statuses and adds a check constraint so any non-official status is rejected.
