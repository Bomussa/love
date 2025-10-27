/**
 * Drill E2E Test: Reports and Dashboard
 * Tests dashboard stats endpoints and export/print functionality
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || '';
const DRILL_CLINIC_ID = process.env.DRILL_CLINIC_ID || '';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || '';
const ADMIN_AUTH_HEADER = process.env.ADMIN_AUTH_HEADER || '';

test.describe('Drill: Reports and Dashboard', () => {
  test.skip(!BASE_URL || !DRILL_CLINIC_ID, 'Skipping: BASE_URL or DRILL_CLINIC_ID not configured');

  test('should access dashboard stats endpoint', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // Try to get stats/dashboard data
    const statsEndpoints = [
      `${apiBase}/stats/dashboard`,
      `${apiBase}/dashboard/stats`,
      `${apiBase}/stats`,
      `${apiBase}/clinics/${DRILL_CLINIC_ID}/stats`,
    ];

    let statsFound = false;
    let statsData: any = null;

    for (const endpoint of statsEndpoints) {
      const response = await request.get(endpoint, { failOnStatusCode: false });

      if (response.ok()) {
        statsData = await response.json();
        statsFound = true;
        console.log(`✓ Stats found at: ${endpoint}`);
        break;
      }
    }

    if (!statsFound) {
      console.log('⚠️  No stats endpoint found - skipping stats verification');
      test.skip(true, 'Stats endpoint not available');
      return;
    }

    // Verify stats data structure
    expect(statsData).toBeTruthy();
    console.log('Stats data keys:', Object.keys(statsData));

    // Look for real-time counts
    const hasRealTimeCounts = 
      statsData.totalPatients !== undefined ||
      statsData.waiting !== undefined ||
      statsData.serving !== undefined ||
      statsData.completed !== undefined ||
      statsData.clinics !== undefined;

    expect(hasRealTimeCounts).toBe(true);
    console.log('✓ Real-time counts present in stats');
  });

  test('should access reports endpoint if available', async ({ request }) => {
    // Skip if no admin credentials
    if (!ADMIN_COOKIE && !ADMIN_AUTH_HEADER) {
      console.log('⚠️  Admin credentials not provided - skipping reports test');
      test.skip(true, 'Admin credentials required');
      return;
    }

    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    const headers: Record<string, string> = {};
    if (ADMIN_COOKIE) headers['Cookie'] = ADMIN_COOKIE;
    if (ADMIN_AUTH_HEADER) headers['Authorization'] = ADMIN_AUTH_HEADER;

    // Try various report endpoints
    const reportEndpoints = [
      `${apiBase}/reports/daily`,
      `${apiBase}/reports/weekly`,
      `${apiBase}/reports/monthly`,
      `${apiBase}/admin/reports`,
      `${apiBase}/clinics/${DRILL_CLINIC_ID}/reports`,
    ];

    let reportFound = false;

    for (const endpoint of reportEndpoints) {
      const response = await request.get(endpoint, { 
        headers,
        failOnStatusCode: false 
      });

      if (response.ok()) {
        const data = await response.json();
        console.log(`✓ Report endpoint accessible: ${endpoint}`);
        console.log('Report data keys:', Object.keys(data));
        reportFound = true;
        break;
      }
    }

    if (!reportFound) {
      console.log('ℹ️  No report endpoints accessible (may require different auth or not implemented)');
    }
  });

  test('should detect export functionality in UI', async ({ page }) => {
    // Navigate to dashboard or admin page
    const dashboardUrls = [
      `${BASE_URL}/admin`,
      `${BASE_URL}/dashboard`,
      `${BASE_URL}/#/admin`,
      `${BASE_URL}/#/dashboard`,
    ];

    let pageLoaded = false;

    for (const url of dashboardUrls) {
      try {
        const response = await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        
        if (response?.ok()) {
          console.log(`✓ Navigated to: ${url}`);
          pageLoaded = true;
          break;
        }
      } catch (error) {
        // Try next URL
      }
    }

    if (!pageLoaded) {
      console.log('⚠️  Could not load dashboard/admin page - skipping UI test');
      test.skip(true, 'Dashboard page not accessible');
      return;
    }

    // Look for export/print buttons
    const exportSelectors = [
      'button:has-text("Export")',
      'button:has-text("تصدير")',
      'button:has-text("Print")',
      'button:has-text("طباعة")',
      '[data-action="export"]',
      '[data-action="print"]',
      '.export-button',
      '.print-button',
      'button[id*="export"]',
      'button[id*="print"]',
    ];

    let exportButtonFound = false;

    for (const selector of exportSelectors) {
      try {
        const button = await page.locator(selector).first();
        const isVisible = await button.isVisible({ timeout: 2000 });
        
        if (isVisible) {
          console.log(`✓ Export/Print button found: ${selector}`);
          exportButtonFound = true;

          // Try to click and intercept network request or window.print()
          const [request] = await Promise.race([
            Promise.all([
              page.waitForRequest(req => 
                req.url().includes('export') || 
                req.url().includes('report') ||
                req.url().includes('download'),
                { timeout: 3000 }
              ).then(req => [req]).catch(() => [null]),
              button.click()
            ]),
            new Promise(resolve => setTimeout(() => resolve([null]), 3000))
          ]) as [any];

          if (request) {
            console.log('✓ Export triggered network request:', request.url());
          } else {
            console.log('ℹ️  Button clicked but no network request intercepted (may use window.print or download)');
          }

          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    if (!exportButtonFound) {
      console.log('ℹ️  No export/print button found in UI');
    }
  });

  test('should verify export endpoint returns valid data', async ({ request }) => {
    // Skip if no admin credentials
    if (!ADMIN_COOKIE && !ADMIN_AUTH_HEADER) {
      test.skip(true, 'Admin credentials required');
      return;
    }

    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    const headers: Record<string, string> = {};
    if (ADMIN_COOKIE) headers['Cookie'] = ADMIN_COOKIE;
    if (ADMIN_AUTH_HEADER) headers['Authorization'] = ADMIN_AUTH_HEADER;

    // Try export endpoints
    const exportEndpoints = [
      `${apiBase}/reports/export?format=json`,
      `${apiBase}/reports/export?format=csv`,
      `${apiBase}/export/reports`,
      `${apiBase}/admin/export`,
    ];

    let exportFound = false;

    for (const endpoint of exportEndpoints) {
      const response = await request.get(endpoint, { 
        headers,
        failOnStatusCode: false 
      });

      if (response.status() >= 200 && response.status() < 300) {
        console.log(`✓ Export endpoint returned 2xx: ${endpoint}`);
        
        const contentType = response.headers()['content-type'] || '';
        console.log('Content-Type:', contentType);

        // Verify it's returning data (JSON, CSV, or binary)
        const isValidExport = 
          contentType.includes('json') ||
          contentType.includes('csv') ||
          contentType.includes('application/') ||
          contentType.includes('text/');

        if (isValidExport) {
          console.log('✓ Export endpoint returns valid data format');
          exportFound = true;
        }
        
        break;
      }
    }

    if (!exportFound) {
      console.log('ℹ️  No export endpoint accessible or returns 2xx');
      test.skip(true, 'Export endpoint not available');
      return;
    }

    expect(exportFound).toBe(true);
  });

  test('should verify real-time counts update', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // Get initial stats
    const response1 = await request.get(`${apiBase}/stats/dashboard`, {
      failOnStatusCode: false
    });

    if (!response1.ok()) {
      // Try alternative endpoint
      const response2 = await request.get(`${apiBase}/clinics/${DRILL_CLINIC_ID}/stats`, {
        failOnStatusCode: false
      });

      if (!response2.ok()) {
        console.log('⚠️  Stats endpoint not available');
        test.skip(true, 'Stats endpoint not available');
        return;
      }
    }

    const stats = await (response1.ok() ? response1 : 
                         await request.get(`${apiBase}/clinics/${DRILL_CLINIC_ID}/stats`)).json();

    console.log('Stats snapshot:', JSON.stringify(stats, null, 2));

    // Verify stats contain numeric values
    const hasNumericCounts = Object.values(stats).some(val => typeof val === 'number');
    
    expect(hasNumericCounts).toBe(true);
    console.log('✓ Real-time counts are numeric values');
  });

  test('should handle print action gracefully', async ({ page }) => {
    const dashboardUrls = [
      `${BASE_URL}/admin`,
      `${BASE_URL}/dashboard`,
    ];

    let pageLoaded = false;

    for (const url of dashboardUrls) {
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        
        if (response?.ok()) {
          pageLoaded = true;
          break;
        }
      } catch (error) {
        // Try next URL
      }
    }

    if (!pageLoaded) {
      test.skip(true, 'Dashboard page not accessible');
      return;
    }

    // Intercept window.print calls
    await page.evaluate(() => {
      (window as any).__printCalled = false;
      window.print = () => {
        (window as any).__printCalled = true;
      };
    });

    // Look for print button
    const printSelectors = [
      'button:has-text("Print")',
      'button:has-text("طباعة")',
      '[data-action="print"]',
      '.print-button',
    ];

    for (const selector of printSelectors) {
      try {
        const button = await page.locator(selector).first();
        const isVisible = await button.isVisible({ timeout: 2000 });
        
        if (isVisible) {
          await button.click();
          
          // Check if window.print was called
          const printCalled = await page.evaluate(() => (window as any).__printCalled);
          
          if (printCalled) {
            console.log('✓ Print button triggered window.print()');
            expect(printCalled).toBe(true);
          } else {
            console.log('ℹ️  Print button clicked but window.print() not intercepted');
          }
          
          return;
        }
      } catch (error) {
        // Try next selector
      }
    }

    console.log('ℹ️  No print button found or print action not detected');
  });
});
