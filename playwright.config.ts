import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Live Drill E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './scripts/e2e',
  testMatch: 'drill.*.spec.ts',
  
  // Maximum time one test can run
  timeout: 60 * 1000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000,
  },

  // Run tests in files in parallel
  fullyParallel: false,
  
  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 1 : 0,
  
  // Run tests sequentially to avoid conflicts with DRILL clinic
  workers: 1,

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL from environment
    baseURL: process.env.BASE_URL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',

    // Navigation timeout
    navigationTimeout: 30 * 1000,
    
    // Action timeout
    actionTimeout: 15 * 1000,
  },

  // Configure projects for different browsers (using only Chromium for E2E)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results/',
});
