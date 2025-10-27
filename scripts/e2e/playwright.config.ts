import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for live drill E2E tests
 * Tests run against production using BASE_URL from environment
 * No repo dependencies modified - Playwright installed via npx
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './',
  
  // 10 minute timeout per test
  timeout: 10 * 60 * 1000,
  
  // Global setup/teardown timeout
  globalTimeout: 30 * 60 * 1000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 30 * 1000,
  },
  
  // Run tests in serial (1 worker) to avoid conflicts
  fullyParallel: false,
  workers: 1,
  
  // Fail fast on CI
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests once on CI
  retries: process.env.CI ? 1 : 0,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  
  use: {
    // Base URL for all tests
    baseURL: BASE_URL,
    
    // Collect trace on first retry
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
  
  // Configure projects for different test types
  projects: [
    {
      name: 'patient-flow',
      testMatch: /drill\.patient\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-flow',
      testMatch: /drill\.admin\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
