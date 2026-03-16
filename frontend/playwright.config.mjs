import { defineConfig } from '@playwright/test';

const baseURL = process.env.AUDIT_BASE_URL || 'https://mmc-mms.com';

export default defineConfig({
  testDir: './e2e/audit',
  timeout: 45_000,
  fullyParallel: false,
  reporter: [
    ['line'],
    ['json', { outputFile: 'e2e/audit/artifacts/playwright-report.json' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  outputDir: 'e2e/audit/artifacts/test-results'
});
