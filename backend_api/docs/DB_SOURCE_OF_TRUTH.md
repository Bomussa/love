# DB Source of Truth

## Authoritative migration path
The **only** authoritative source for database deployment is:

- `supabase/migrations/`

The following are archived and non-authoritative:

- `legacy/migrations/`
- `legacy/supabase/schema.sql`

---

## Migration execution order
Deploy migrations from `supabase/migrations/` in deterministic file-name order:

1. Files with numeric/timestamp prefixes execute first in ascending lexical order (example: `002_*.sql`, `2025*.sql`, `2026*.sql`).
2. Remaining SQL files execute after prefixed files, also in ascending lexical order.
3. Never execute files from `legacy/` in deployment pipelines.

Operational rule:
- Every new migration must be **append-only** and must not redefine an already-created table with a conflicting structure.

---

## Official tables
The canonical data model is represented by the following table set (public schema unless specified otherwise):

- `admin_users`
- `audit_log`
- `clinic_counters`
- `clinic_pins`
- `clinics`
- `events`
- `exam_types`
- `login_audit`
- `notifications`
- `pathways`
- `patients`
- `patient_sessions`
- `pins`
- `queue`
- `queue_history`
- `queues`
- `reports`
- `roles`
- `route_steps`
- `routes`
- `system_config`

> Note: both `queue` and `queues` currently exist for backward compatibility in historical migrations. New work should avoid introducing additional queue table variants.

---

## Official RPC functions
The canonical RPC/API surface currently includes:

- `admin_authenticate`
- `cleanup_expired_sessions`
- `create_session_for_queue`
- `enter_queue_safe`
- `get_queue_status`
- `mark_session_used`
- `verify_pin`

When adding new RPCs, declare them in a migration under `supabase/migrations/` and update this document in the same PR.
