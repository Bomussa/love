# 03_DB_SCHEMA_RLS_SNAPSHOT
**Project**: MMC-MMS (rujwuruuosffcxazymit)
**Region**: ap-southeast-1
**DB Version**: PostgreSQL 17.6.1
**Generated**: 2026-02-24

## Tables (Public Schema) — 80 tables total
Key tables:
| Table | Purpose |
|-------|---------|
| admins | Admin accounts |
| queues | Canonical physical queue table (source of truth) |
| unified_queue | Compatibility view mapped to `queues` |
| notifications | Manual + operational notifications |
| operational_notifications | Operational notification templates (NEW) |
| direct_alerts | Direct Alert to patient by phone (NEW) |
| pins | Daily PINs per clinic |
| patients | Patient records |
| device_logins | Device fingerprint per day |
| patient_visits | Visit history |
| audit_logs | Audit trail |
| routes / route_steps | Exam pathways |
| clinics | Clinic definitions |

## RLS Status
| Table | RLS | Policy |
|-------|-----|--------|
| admins | ✅ | `admins_admins_only` → `is_admin()` |
| notifications | ✅ | Multiple policies |
| queues | ✅ | Multiple policies |
| unified_queue (view) | n/a | Compatibility-only (inherits from `queues`) |
| clinics | ✅ | Public select + admin write |
| audit_logs | ✅ | Admin select + public insert |
| activity_logs | ✅ | `activity_logs_all` → true |
| app_contents | ✅ | `app_contents_full_access` → true |

## Indexes on notifications
- `notifications_pkey` (id)
- `idx_notifications_patient_id`
- `idx_notifications_clinic_id`
- `idx_notifications_is_read`
- `idx_notifications_sent_at`
- `idx_notifications_user_read`
- `idx_notifications_clinic`
- `idx_notifications_patient`

## Active Triggers
| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| queue_audit_trg | queues | INSERT/UPDATE/DELETE | queue_audit_trigger() |
| queue_broadcast_trigger | queues | INSERT/UPDATE/DELETE | clinic_queue_broadcast_trigger() |
| notifications_broadcast_trigger | notifications | INSERT | broadcast_table_changes() |
| update_admins_updated_at | admins | UPDATE | update_updated_at_column() |
| check_route_completion | route_steps | UPDATE | check_route_completion() |

## notifications Table Columns
id, patient_id, clinic_id, type, title, message, is_read, sent_at, read_at, metadata, user_id, actor_id, payload, read, created_at, display_position, display_duration, font_size, font_color, background_color, border_color, scheduled_at, is_active


## Queue canonical contract lock
- Canonical physical relation: `public.queues`.
- `public.unified_queue` and `public.queue` are compatibility views only.
- Official statuses for new code: `waiting`, `called`, `serving`, `completed`, `skipped`, `cancelled`, `postponed`.
- Backward aliases accepted for compatibility: `in_service`→`serving`, `done`→`completed`.
- Reference: `docs/QUEUE_CANONICAL_CONTRACT.md`.
