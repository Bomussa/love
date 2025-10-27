# Live Drill E2E Testing System

## Overview

The Live Drill E2E testing system provides a real, production-ready simulation of patient and administrative workflows without affecting real users. Tests run on-demand via GitHub Actions against a dedicated `DRILL` clinic using Playwright for end-to-end validation.

## 🎯 Objectives

- **Real-world validation**: Test against production URLs with actual API endpoints
- **Zero impact**: Uses dedicated DRILL clinic excluded from normal routing
- **Opt-in execution**: Manual trigger or optional scheduled runs
- **Complete cleanup**: All test data is removed after execution
- **No PII**: Synthetic IDs generated per run (format: `DRILL-<timestamp>-<random>`)

## 🏗️ Architecture

### Test Structure

```
scripts/e2e/
├── playwright.config.ts      # Playwright configuration (10m timeout, 1 worker)
├── drill.patient.spec.ts     # Patient flow tests
└── drill.admin.spec.ts       # Admin flow tests (optional)
```

### Workflow

```
.github/workflows/live-drill-e2e.yml
```

## 🔧 Setup Instructions

### 1. Create DRILL Clinic

The DRILL clinic must be created by administrators using the existing dashboard:

1. Log in to the admin dashboard
2. Navigate to Clinic Management
3. Create a new clinic with:
   - **ID**: `DRILL` (or custom - must match secret)
   - **Name**: "Live Drill Clinic"
   - **PIN**: `9999` (or custom - must match secret)
   - **Type**: Hidden/Testing clinic
   - **Routing**: Excluded from normal patient routing

### 2. Configure GitHub Secrets

Navigate to your repository → Settings → Secrets and variables → Actions → New repository secret:

#### Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `BASE_URL` | Production URL to test | `https://www.mmc-mms.com` |
| `DRILL_CLINIC_ID` | Clinic ID for testing | `DRILL` |
| `DRILL_CLINIC_PIN` | PIN for DRILL clinic | `9999` |

#### Optional Secrets

| Secret Name | Description | Example | Default |
|-------------|-------------|---------|---------|
| `DRILL_EXAM_TYPE` | Exam type for tests | `تجنيد` | `تجنيد` |
| `DRILL_GENDER` | Patient gender | `male` or `female` | `male` |
| `ADMIN_COOKIE` | Admin session cookie | `session=abc123...` | _(skips admin tests)_ |
| `ADMIN_AUTH_HEADER` | Admin auth header | `Bearer xyz789...` | _(skips admin tests)_ |

### 3. Configure .env.local (Optional - Local Testing)

For local development testing, create `.env.local`:

```bash
BASE_URL=http://localhost:5173
DRILL_CLINIC_ID=DRILL
DRILL_CLINIC_PIN=9999
DRILL_EXAM_TYPE=تجنيد
DRILL_GENDER=male
# Optional admin credentials for local testing
ADMIN_COOKIE=session=your-session-cookie
ADMIN_AUTH_HEADER=Bearer your-auth-token
```

## 🚀 Running Tests

### Via GitHub Actions (Recommended)

1. Go to: **Actions** → **Live Drill E2E**
2. Click **Run workflow**
3. Optional: Override `base_url` or skip admin tests
4. Click **Run workflow** button

### Locally (Development)

```bash
# Install Playwright
npx playwright install --with-deps chromium

# Set environment variables (or use .env.local)
export BASE_URL=https://www.mmc-mms.com
export DRILL_CLINIC_ID=DRILL
export DRILL_CLINIC_PIN=9999

# Run patient tests only
cd scripts/e2e
npx playwright test drill.patient.spec.ts

# Run admin tests (requires credentials)
export ADMIN_COOKIE="session=..."
npx playwright test drill.admin.spec.ts

# Run all tests
npx playwright test
```

## 📋 Test Flows

### Patient Flow (`drill.patient.spec.ts`)

1. **Health Check**: Verify API status endpoint
2. **Route Plan**: Create routing plan for drill patient
3. **Queue Entry**: Enter DRILL queue with synthetic ID
4. **Queue State**: Verify patient is in queue
5. **Extend 901**: Simulate extension to clinic 901
6. **Extend 902**: Simulate extension to clinic 902
7. **Exit Queue**: Remove patient from queue
8. **Cleanup Verification**: Confirm queue is clean

### Admin Flow (`drill.admin.spec.ts`)

1. **Setup**: Create drill patient in queue
2. **Initial State**: Get baseline queue metrics
3. **Call Next**: Admin calls next patient
4. **Verify Change**: Confirm queue state updated
5. **Cleanup**: Remove test patient
6. **Queue View**: Verify admin can view queue details

**Note**: Admin tests are automatically skipped if `ADMIN_COOKIE` or `ADMIN_AUTH_HEADER` secrets are not provided.

## 🔐 Security & Safety

### No PII Storage

- All patient IDs are synthetic: `DRILL-<timestamp>-<random>`
- No real patient data is used or stored
- All test data is cleaned up after execution

### Isolated Environment

- Tests only interact with the DRILL clinic
- DRILL clinic is excluded from normal routing
- No impact on real patient queues or workflows

### Idempotency

- All mutating requests use unique idempotency keys
- Prevents duplicate operations on retry
- Format: 32-character hex string from crypto.randomBytes(16)

### Automatic Cleanup

- `afterEach` hook ensures tickets are exited
- Workflow cleanup step verifies empty queue
- Failed tests still trigger cleanup logic

## 📊 Monitoring & Debugging

### GitHub Actions Output

The workflow provides:
- Step-by-step console logs
- Test summary in GitHub Actions UI
- Detailed error messages on failure
- Artifacts with test reports (7-day retention)

### Test Artifacts

When tests complete, artifacts are uploaded:
- `playwright-report/`: HTML test report
- `test-results/`: Screenshots, videos, traces

### Success Criteria

✅ **Pass**: All critical steps succeed
- API health check responds
- Patient can enter/exit queue
- Queue state is clean after test
- Admin operations succeed (if credentials provided)

❌ **Fail**: Any critical step fails
- API unreachable
- Cannot enter queue
- Cannot exit queue
- Queue not cleaned up

⏭️ **Skip**: Non-critical conditions
- Admin credentials not provided → skip admin tests only
- Optional extensions fail → warning logged, test continues

## 🔄 Scheduling (Optional)

To enable nightly runs, uncomment the schedule trigger in `.github/workflows/live-drill-e2e.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'  # 2 AM UTC daily
```

**Recommended schedule**:
- Daily: `0 2 * * *` (2 AM UTC)
- Weekly: `0 2 * * 0` (Sunday 2 AM UTC)
- Twice daily: `0 2,14 * * *` (2 AM and 2 PM UTC)

## 🛠️ Customization

### Timeout Adjustments

Edit `playwright.config.ts`:

```typescript
timeout: 10 * 60 * 1000,  // 10 minutes per test
expect: {
  timeout: 30 * 1000,      // 30 seconds for assertions
}
```

### Additional Test Scenarios

Add new test cases in `drill.patient.spec.ts` or `drill.admin.spec.ts`:

```typescript
test('custom scenario', async ({ request }) => {
  // Your test logic here
});
```

### Custom Clinic Configuration

To test different clinics, create additional secrets:
- `DRILL_CLINIC_ID_ALT`
- `DRILL_CLINIC_PIN_ALT`

And modify workflow to use them.

## 🚨 Troubleshooting

### Test Fails: "DRILL_CLINIC_ID not found"

**Solution**: Ensure DRILL clinic exists in your system and secret matches clinic ID exactly.

### Admin Tests Skipped

**Expected**: Admin tests require `ADMIN_COOKIE` or `ADMIN_AUTH_HEADER` secrets.

**Solution**: Add admin credentials to repository secrets if you want to test admin flows.

### Cleanup Failures

**Symptom**: Queue not empty after test run.

**Solution**: 
1. Manually exit stuck tickets via admin dashboard
2. Check logs for specific ticket IDs
3. Verify DRILL clinic is not locked

### Local Tests Fail

**Check**:
1. Is local backend running? (`npm run start` or `npm run dev`)
2. Is `BASE_URL` correct in `.env.local`?
3. Is DRILL clinic created in local database?
4. Are dependencies installed? (`npm install`)

## 📞 Support

For issues or questions:
1. Check GitHub Actions logs for detailed error messages
2. Review test artifacts (screenshots, traces)
3. Verify DRILL clinic configuration in admin dashboard
4. Ensure all required secrets are set correctly

## 🔄 Version History

- **v1.0.0** (2025-10-27): Initial implementation
  - Patient flow tests
  - Admin flow tests
  - GitHub Actions workflow
  - Documentation

## 📝 Notes

- Tests use Node.js 20 (as per project requirements)
- No TypeScript in workflow scripts (Node.js only)
- Playwright installed via `npx` (no package.json changes)
- All API calls respect `VITE_API_BASE` environment variable
- SSE (Server-Sent Events) URLs constructed using `getApiBase()` helper

## ✅ Acceptance Checklist

- [x] Workflow runs on `workflow_dispatch`
- [x] Optional schedule support (commented out)
- [x] Patient flow tests complete end-to-end
- [x] Admin flow tests (with graceful skip)
- [x] Automatic cleanup after tests
- [x] No package.json modifications
- [x] No UI changes
- [x] No impact on real users
- [x] Synthetic IDs only (no PII)
- [x] Idempotency keys for mutating operations
- [x] Comprehensive documentation
