import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/production',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-production', open: 'never' }],
    ['json', { outputFile: 'test-results-production/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    locale: 'ar-QA',
    timezoneId: 'Asia/Qatar',
    ignoreHTTPSErrors: false,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'test-results-production/artifacts',
  projects: [{ name: 'chromium-production', use: { ...devices['Desktop Chrome'] } }],
});
