# Live Drill E2E Tests

## Overview

The Live Drill E2E tests validate critical real-world flows on production-like environments using a designated DRILL clinic. These tests ensure that:

- Dynamic routing respects configured weights
- Real-time queue notifications work via SSE (Server-Sent Events)
- PIN codes correctly protect clinic entry/exit and track timestamps
- Dashboard stats and reports are accessible and functional

All tests are designed to be **safe**, **idempotent**, and **non-blocking** for CI. They skip gracefully when optional configuration is missing.

## Prerequisites

### Required Secrets

Configure these in your repository's Actions secrets (Settings → Secrets and variables → Actions):

| Secret | Description | Example |
|--------|-------------|---------|
| `BASE_URL` | Base URL of the deployment to test | `https://your-app.vercel.app` |
| `DRILL_CLINIC_ID` | ID of the DRILL clinic (safe for testing) | `clinic-drill-001` |
| `DRILL_CLINIC_PIN` | PIN code for the DRILL clinic | `1234` |

### Optional Secrets

These enable additional test scenarios:

| Secret | Description | Example | Default |
|--------|-------------|---------|---------|
| `DRILL_EXAM_TYPE` | Exam type for test tickets | `general`, `routine`, `followup` | `general` |
| `DRILL_GENDER` | Gender for test patients | `male` or `female` | `male` |
| `SSE_URL_TEMPLATE` | SSE endpoint URL template | `/api/v1/clinics/{clinicId}/events` | `/api/v1/clinics/{clinicId}/events` |
| `ADMIN_COOKIE` | Admin session cookie for authenticated actions | `session=abc123...` | _(none)_ |
| `ADMIN_AUTH_HEADER` | Admin authorization header | `Bearer token123...` | _(none)_ |

### SSE URL Template

The `SSE_URL_TEMPLATE` can be:
- **Relative path**: `/api/v1/clinics/{clinicId}/events` (prepended with `BASE_URL`)
- **Full URL**: `https://api.example.com/clinics/{clinicId}/sse`

The `{clinicId}` placeholder will be replaced with `DRILL_CLINIC_ID`.

## Test Scenarios

### 1. Routing Tests (`drill.routing.spec.ts`)

**Purpose**: Verify that the routing/plan endpoint returns valid routes and respects weights.

**Tests**:
- ✅ Returns a valid routing plan with non-empty clinic list
- ✅ Plans are consistent across multiple requests
- ⚙️ (Optional) Respects routing weights if admin endpoints available

**Required**: `BASE_URL`, `DRILL_CLINIC_ID`

**Optional**: `ADMIN_COOKIE` or `ADMIN_AUTH_HEADER` (for weight configuration)

### 2. Queue Real-time Tests (`drill.queue-realtime.spec.ts`)

**Purpose**: Test SSE events for queue updates and call-next notifications.

**Tests**:
- ✅ Create ticket and verify it appears in queue state
- ✅ Subscribe to SSE and receive queue events (or fallback to polling)
- ⚙️ (Optional) Trigger call-next via admin endpoint and verify event received

**Required**: `BASE_URL`, `DRILL_CLINIC_ID`

**Optional**: `SSE_URL_TEMPLATE`, `ADMIN_COOKIE`/`ADMIN_AUTH_HEADER`

**Fallback**: If SSE is not configured, tests use polling to verify queue state updates.

### 3. PIN Audit Tests (`drill.pin-audit.spec.ts`)

**Purpose**: Validate PIN protection and timestamp tracking for entry/exit.

**Tests**:
- ✅ Wrong PIN is rejected with 4xx on entry
- ✅ Correct PIN allows entry and tracks `entry_time`
- ✅ Wrong PIN is rejected on exit
- ✅ Correct PIN allows exit and tracks `exit_time`
- ✅ Timestamps fall within test window (±2 minutes tolerance)

**Required**: `BASE_URL`, `DRILL_CLINIC_ID`, `DRILL_CLINIC_PIN`

**Timestamp Fields**: Tests check for `entry_time`, `entryTime`, `timestamp`, `createdAt` (entry) and `exit_time`, `exitTime`, `updatedAt` (exit).

### 4. Reports Tests (`drill.reports.spec.ts`)

**Purpose**: Verify dashboard stats and export/print functionality.

**Tests**:
- ✅ Dashboard stats endpoint returns real-time counts
- ⚙️ (Optional) Reports endpoints accessible with admin auth
- ⚙️ (Optional) Export functionality (button visible, triggers request)
- ⚙️ (Optional) Print action (button triggers `window.print()`)

**Required**: `BASE_URL`, `DRILL_CLINIC_ID`

**Optional**: `ADMIN_COOKIE`/`ADMIN_AUTH_HEADER` (for admin-only endpoints)

## Running Tests

### Manually via GitHub Actions

1. Go to **Actions** → **Live Drill E2E Tests**
2. Click **Run workflow**
3. (Optional) Override `BASE_URL` in the input field
4. Click **Run workflow**

### Locally

```bash
# Install Playwright
npx playwright install chromium

# Set environment variables
export BASE_URL="https://your-app.vercel.app"
export DRILL_CLINIC_ID="clinic-drill-001"
export DRILL_CLINIC_PIN="1234"
export DRILL_EXAM_TYPE="general"
export DRILL_GENDER="male"
export SSE_URL_TEMPLATE="/api/v1/clinics/{clinicId}/events"
# Optional:
# export ADMIN_COOKIE="session=..."
# export ADMIN_AUTH_HEADER="Bearer ..."

# Run tests
npx playwright test scripts/e2e/drill.*.spec.ts --reporter=list
```

### Scheduled Runs

The workflow runs automatically **daily at 2 AM UTC** to continuously validate production health.

## Test Architecture

### Helpers

#### `scripts/e2e/sse.ts`
Minimal SSE client using native `fetch` streaming API:
- `captureSSEEvents()`: Capture all events from SSE stream
- `waitForSSEEvent()`: Wait for specific event type with optional data matcher

No external dependencies. Parses `text/event-stream` format.

#### `scripts/e2e/time.ts`
Timestamp utilities for validation:
- `parseServerTimestamp()`: Parse ISO 8601 or common timestamp formats
- `isTimestampInWindow()`: Check if timestamp falls within time window
- `validateEntryExitTimestamps()`: Validate entry/exit timestamps with tolerance
- `calculateDuration()`: Calculate duration between timestamps
- `formatDuration()`: Human-readable duration format

### Graceful Skipping

Tests use `test.skip()` to skip gracefully when:
- Required secrets are missing (`BASE_URL`, `DRILL_CLINIC_ID`)
- Optional features are unavailable (SSE, admin endpoints)
- Endpoints return 404 (not implemented)

This ensures CI passes even with partial configuration.

### Cleanup

Each test that creates a ticket includes an `afterEach` hook to exit the clinic, ensuring:
- No orphaned tickets in DRILL queue
- Tests are idempotent and can run repeatedly
- Real queues are not polluted

## Safety Measures

1. **DRILL Clinic Only**: All tests target `DRILL_CLINIC_ID`, a designated safe clinic for testing
2. **Automatic Cleanup**: Tickets are exited after tests complete
3. **No Real Patients**: Test patients use unique IDs like `drill-test-{timestamp}`
4. **Non-Blocking CI**: Tests don't fail CI when optional features unavailable
5. **Read-Only Where Possible**: Most tests read state; write operations are minimal and cleaned up

## Troubleshooting

### Tests Skipped

**Cause**: Required secrets not configured.

**Solution**: Add `BASE_URL`, `DRILL_CLINIC_ID`, `DRILL_CLINIC_PIN` in repository secrets.

### SSE Tests Fail or Skip

**Cause**: `SSE_URL_TEMPLATE` not configured or endpoint not available.

**Solution**: 
- Verify SSE endpoint exists: `/api/v1/clinics/{clinicId}/events` or `/api/v1/events/stream`
- Set `SSE_URL_TEMPLATE` secret
- Tests fallback to polling if SSE unavailable

### Admin Tests Skip

**Cause**: `ADMIN_COOKIE` or `ADMIN_AUTH_HEADER` not provided.

**Solution**: This is expected. Admin tests are optional. Set admin auth secrets to enable them.

### Timestamp Validation Fails

**Cause**: Server time differs significantly from test runner time.

**Solution**: 
- Tests allow ±2 minutes tolerance
- Check server time synchronization (NTP)
- Verify timezone handling in API

### PIN Tests Fail

**Cause**: Incorrect `DRILL_CLINIC_PIN` or PIN expired.

**Solution**:
- Verify PIN is current for today (PINs may rotate daily)
- Check PIN in admin dashboard
- Update `DRILL_CLINIC_PIN` secret

## Configuration Examples

### Vercel Deployment

```yaml
BASE_URL: https://your-app.vercel.app
DRILL_CLINIC_ID: clinic-drill-001
DRILL_CLINIC_PIN: 1234
SSE_URL_TEMPLATE: /api/v1/clinics/{clinicId}/events
```

### Self-Hosted with Admin Auth

```yaml
BASE_URL: https://api.example.com
DRILL_CLINIC_ID: drill
DRILL_CLINIC_PIN: 9876
ADMIN_COOKIE: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SSE_URL_TEMPLATE: https://api.example.com/v1/sse/{clinicId}
```

### Minimal Configuration (Core Tests Only)

```yaml
BASE_URL: http://localhost:3000
DRILL_CLINIC_ID: test-clinic
DRILL_CLINIC_PIN: 0000
```

## Extending Tests

To add new test scenarios:

1. Create new spec file in `scripts/e2e/drill.*.spec.ts`
2. Import helpers from `sse.ts` and `time.ts`
3. Use environment variables for configuration
4. Add `test.skip()` guards for optional features
5. Include cleanup in `afterEach` hooks
6. Update this documentation

## Integration with CI/CD

### GitHub Actions

The workflow `.github/workflows/live-drill-e2e.yml`:
- Runs on `workflow_dispatch` (manual) and `schedule` (daily)
- Uses Node 20 as required
- Installs Playwright with Chromium only
- Uploads test reports as artifacts (30 day retention)
- Generates summary in GitHub Actions UI

### Vercel Integration

No changes to Vercel deployment required. Tests run against deployed URL via API.

## Monitoring and Alerts

Recommended monitoring setup:

1. **Scheduled Workflow**: Daily runs detect regressions early
2. **Artifact Review**: Check Playwright HTML reports for detailed results
3. **GitHub Notifications**: Enable notifications for workflow failures
4. **Custom Alerts**: Parse workflow results and send to Slack/email

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Testing Checklist](./TESTING_CHECKLIST.md)

## Support

For issues or questions:
1. Check test logs and Playwright reports (artifacts)
2. Verify secrets configuration
3. Test endpoints manually with `curl` or Postman
4. Review server logs for DRILL clinic activity

---

**Last Updated**: 2025-10-27  
**Version**: 1.0.0
