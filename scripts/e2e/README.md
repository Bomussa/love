# Live Drill E2E Tests

This directory contains end-to-end tests for the live drill simulation system.

## Quick Start

```bash
# Install Playwright
npx playwright install --with-deps chromium

# Set environment variables
export BASE_URL=https://www.mmc-mms.com
export DRILL_CLINIC_ID=DRILL
export DRILL_CLINIC_PIN=9999

# Run tests
npx playwright test
```

## Files

- `playwright.config.ts` - Playwright configuration
- `drill.patient.spec.ts` - Patient flow tests
- `drill.admin.spec.ts` - Admin flow tests (requires credentials)

## Documentation

See [docs/live-drill.md](../../docs/live-drill.md) for complete setup and usage instructions.

## Requirements

- Node.js 20
- Environment variables (see documentation)
- DRILL clinic configured in system
