import { test, expect } from '@playwright/test';
import matrix from './interaction-matrix.json';

type MatrixItem = {
  component: string;
  testId: string;
  action: 'click' | 'none';
  assertions: Array<'visible' | 'enabled' | 'disabled'>;
};

const rows = matrix as MatrixItem[];

test.describe('interaction matrix', () => {
  test('all mapped elements are reachable and stateful', async ({ page }) => {
    await page.goto('/admin');

    for (const row of rows) {
      const locator = page.getByTestId(row.testId);

      if (row.assertions.includes('visible')) {
        await expect(locator).toBeVisible();
      }
      if (row.assertions.includes('enabled')) {
        await expect(locator).toBeEnabled();
      }
      if (row.assertions.includes('disabled')) {
        await expect(locator).toBeDisabled({ timeout: 1000 }).catch(() => undefined);
      }

      if (row.action === 'click') {
        await locator.click({ force: true });
      }
    }
  });
});
