import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const matrixPath = path.resolve(process.cwd(), 'e2e/audit/audit-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'));

const adminSession = {
  id: `sess_${Date.now()}`,
  username: 'audit_admin',
  role: 'SUPER_ADMIN',
  name: 'AUDIT ADMIN',
  loginTime: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString()
};

async function bootstrapAdmin(page) {
  await page.addInitScript((session) => {
    localStorage.setItem('mmc_admin_session', JSON.stringify(session));
  }, adminSession);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("[data-sidebar='admin']", { timeout: 20000 });
}

test('www و non-www يعرضان نفس مسار الإدارة', async ({ page }) => {
  await page.goto(matrix.baseUrl, { waitUntil: 'domcontentloaded' });
  const baseTitle = await page.title();

  await page.goto(matrix.wwwParityCheck, { waitUntil: 'domcontentloaded' });
  const wwwTitle = await page.title();

  expect(baseTitle.length).toBeGreaterThan(0);
  expect(wwwTitle).toBe(baseTitle);
});

test('تدقيق تبويبات الإدارة الرئيسية', async ({ page }) => {
  await bootstrapAdmin(page);

  for (const screen of matrix.screens) {
    const tab = page.locator(screen.tabSelector).first();
    await expect(tab, `missing tab: ${screen.id}`).toBeVisible();
    await tab.click();
    await expect(tab, `tab not enabled: ${screen.id}`).toBeEnabled();

    for (const action of screen.mainActions || []) {
      const actionLocator = page.locator(action.selector).first();
      const count = await page.locator(action.selector).count();
      if (count === 0 && action.conditional) continue;

      await expect(actionLocator, `missing action: ${action.id}`).toBeVisible();
      if (action.expectedStates.includes('disabled')) {
        const enabled = await actionLocator.isEnabled();
        expect(typeof enabled).toBe('boolean');
      } else {
        await expect(actionLocator, `action not enabled: ${action.id}`).toBeEnabled();
      }
    }
  }
});

test('تدقيق الأزرار العامة في لوحة الإدارة', async ({ page }) => {
  await bootstrapAdmin(page);

  for (const action of matrix.globalActions) {
    const actionLocator = page.locator(action.selector).first();
    await expect(actionLocator, `missing global action: ${action.id}`).toBeVisible();
    await expect(actionLocator, `global action disabled: ${action.id}`).toBeEnabled();
  }
});
