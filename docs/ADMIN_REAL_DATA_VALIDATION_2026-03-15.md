# Admin Real-Data Validation Report — 2026-03-15

## Scope
- Frontend repo: `love` (local workspace).
- Target domain checks: `https://mmc-mms.com` and `https://www.mmc-mms.com`.
- Data source: Supabase project `rujwuruuosffcxazymit` using provided anon/service credentials.

## Screen-by-screen status (periodic report)

### 1) Backup & Export
- JSON export uses real tables:
  - `queues` (canonical) with compatibility coverage for `unified_queue`, plus `clinics`, `patients`.
- CSV export uses real tables:
  - `queues` (canonical) with compatibility coverage for `unified_queue`, plus `clinics`, `patients`, `system_config`.
- CSV escaping fixed (quotes/newlines/commas) to avoid corrupt files.

### 2) Offline Mode
- Removed mock sync delay logic.
- `syncNow` now executes real Supabase probe (`system_config`) before marking local offline keys as synced.

### 3) Appearance
- No visual identity/theme changes.
- Existing appearance save/load path remains intact via Supabase-backed settings flow.

### 4) Database
- Queue contract aligned to canonical schema (`queues` physical table, `unified_queue` compatibility view) in management/export flows.

### 5) API Monitor
- Live table checks and counters verified against real Supabase responses.

### 6) Files Center
- No mock replacement needed in this patch; no visual identity changes.

## Real-data validation executed

### Supabase read checks (anon key)
- `clinics`, `patients`, `queues` (plus `unified_queue` compatibility), `system_config`, `pins`, `qa_runs`, `qa_findings`, `repair_runs` returned HTTP 200.

### Supabase write checks (service role)
- Inserted a test patient record then deleted it (rollback confirmed).
- Performed no-op PATCH on canonical `queues` row (status unchanged) while preserving `unified_queue` compatibility contract.

### Website checks
- Both domains return HTTP 200.
- Content parity mismatch still present (`www` HTML/title differs from apex), needs DNS/hosting config fix outside code patch.

## Acceptance calculation snapshot
- Technical checks executed: 12
- Passed: 11
- Failed: 1 (www parity mismatch)
- Measured success ratio: **91.67%**

> According to strict deployment rule (>98% required), production execution should be blocked until domain parity is fixed.

## Rollback points
1. Revert commit that updates admin table mappings.
2. Revert commit that replaces offline sync mock with live probe.
3. Keep resilient request/security fixes if rollback is partial.
