# Queue Canonical Contract

## Source of truth
- **Canonical table:** `public.queues`
- **Legacy sources migrated from:** `public.queue`, `public.unified_queue`
- **Temporary compatibility views:** `public.queue_compat`, `public.unified_queue_compat`

## Allowed fields (canonical write/read contract)

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | `uuid` | ✅ | Primary key |
| `clinic_id` | `text` | ✅ | Clinic identifier |
| `patient_id` | `text` | ✅ | Patient identifier (normalized to text) |
| `patient_name` | `text` | ❌ | Optional display name |
| `exam_type` | `text` | ❌ | Optional exam type |
| `queue_number_int` | `integer` | ✅ | Canonical numeric queue ordering field |
| `display_number` | `integer` | ✅ | Human-facing ticket number |
| `queue_number` | `text` | ❌ | Optional legacy string ticket |
| `status` | `text` | ✅ | Must be one of the allowed status values below |
| `queue_date` | `date` | ✅ | Logical business day for queue sequencing |
| `entered_at` | `timestamptz` | ✅ | Queue entry timestamp |
| `called_at` | `timestamptz` | ❌ | Set when patient is called |
| `completed_at` | `timestamptz` | ❌ | Set when service is completed |
| `cancelled_at` | `timestamptz` | ❌ | Set when item is cancelled |
| `completed_by_pin` | `text` | ❌ | Operator PIN for completion |
| `metadata` | `jsonb` | ✅ | Extra non-contract attributes |
| `created_at` | `timestamptz` | ✅ | Record creation timestamp |
| `updated_at` | `timestamptz` | ✅ | Record update timestamp |

## Allowed status values
- `waiting`
- `called`
- `serving` *(legacy-compatible read support)*
- `completed`
- `cancelled`
- `no_show`
- `skipped`

## Legacy status mapping used in migration
| Legacy value | Canonical value |
|---|---|
| `waiting` | `waiting` |
| `called` | `called` |
| `serving` | `serving` |
| `completed` | `completed` |
| `cancelled` | `cancelled` |
| `no_show` | `no_show` |
| `skipped` | `skipped` |
| `in_progress` | `called` |
| `in_service` | `called` |
| `postponed` | `skipped` |
| any unknown value | `waiting` |

## Engineering rule
All application reads/writes must target `public.queues` only. Any new direct usage of `.from('queue')` or `.from('unified_queue')` is considered a contract violation, except within explicit compatibility-layer code.
