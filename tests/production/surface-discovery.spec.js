import { test, expect } from '@playwright/test';

const ENTRY_URL = process.env.E2E_ENTRY_URL;
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const DOCTOR_USERNAME = process.env.E2E_DOCTOR_USERNAME;
const DOCTOR_PASSWORD = process.env.E2E_DOCTOR_PASSWORD;

const adminSections = [
  'لوحة التحكم',
  'إدارة الطوابير',
  'الإشعارات',
  'المسارات',
  'توجيه الطوابق',
  'التقارير',
  'العيادات',
  'الأطباء',
  'حالة النظام',
  'الإعدادات',
  'إدارة المستخدمين',
  'سجل النشاطات',
  'النسخ والتصدير',
  'العمل أوفلاين',
  'إدارة المحتوى',
  'المظهر',
  'قاعدة البيانات',
  'مراقبة API',
  'التشخيصات الذكية',
  'الإصلاح والجودة',
  'مركز الملفات',
];

function startEvidenceCollection(page) {
  const evidence = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    serverErrors: [],
  };

  page.on('console', message => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => evidence.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    const url = request.url();
    if (!/fonts\.googleapis\.com|fonts\.gstatic\.com|analytics|speed-insights/i.test(url)) {
      evidence.failedRequests.push({ url, error: request.failure()?.errorText || 'unknown' });
    }
  });
  page.on('response', response => {
    if (response.status() >= 500) {
      evidence.serverErrors.push({ status: response.status(), url: response.url() });
    }
  });
  page.on('dialog', dialog => dialog.accept());

  return evidence;
}

async function attachJson(testInfo, name, value) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2), 'utf8'),
    contentType: 'application/json',
  });
}

async function inventorySurface(page, testInfo, name) {
  const inventory = await page.locator('button, input, select, textarea, a[href], [role="button"], [role="tab"]').evaluateAll(elements =>
    elements.map((element, index) => ({
      index,
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      role: element.getAttribute('role'),
      text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      placeholder: element.getAttribute('placeholder'),
      name: element.getAttribute('name'),
      id: element.id || null,
      href: element.getAttribute('href'),
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
      visible: Boolean(element.getClientRects().length),
    })),
  );

  const headings = await page.locator('h1, h2, h3, h4').evaluateAll(elements =>
    elements
      .filter(element => element.getClientRects().length)
      .map(element => (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  );

  await attachJson(testInfo, `${name}-inventory`, { url: page.url(), headings, controls: inventory });
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  return { headings, inventory };
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }
  return false;
}

async function fillCredentialForm(page, username, password) {
  const visibleTextInputs = page.locator('input[type="text"]:visible');
  const visiblePasswordInputs = page.locator('input[type="password"]:visible');
  await expect(visibleTextInputs.first()).toBeVisible();
  await expect(visiblePasswordInputs.first()).toBeVisible();
  await visibleTextInputs.first().fill(username);
  await visiblePasswordInputs.first().fill(password);
}

test('discover and exercise all visible application surfaces', async ({ page }, testInfo) => {
  test.skip(!ENTRY_URL || !ADMIN_USERNAME || !ADMIN_PASSWORD || !DOCTOR_USERNAME || !DOCTOR_PASSWORD, 'E2E credentials are required');
  const evidence = startEvidenceCollection(page);

  await page.goto(ENTRY_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /اللجنة الطبية العسكرية|Military Medical Committee/i })).toBeVisible();
  await page.waitForTimeout(6500);

  expect(await page.evaluate(() => Boolean(window.__healthMonitor))).toBe(false);
  expect(await page.locator('[data-input-handler], [data-change-handler], [data-row-handler], .interactive').count()).toBe(0);
  await inventorySurface(page, testInfo, '01-login-ar');

  const themeButtons = page.locator('.theme-buttons-container button');
  expect(await themeButtons.count()).toBeGreaterThan(0);
  for (let index = 0; index < await themeButtons.count(); index += 1) {
    await themeButtons.nth(index).click();
  }

  const languageButton = page.getByRole('button', { name: /English|العربية/ }).first();
  await languageButton.click();
  await expect(page.getByRole('heading', { name: /Military Medical Committee/i })).toBeVisible();
  await inventorySurface(page, testInfo, '02-login-en');
  await page.getByRole('button', { name: /العربية|English/ }).first().click();

  const guideButton = page.getByRole('button', { name: /تعليمات الدخول|Instructions/i }).first();
  if (await guideButton.isVisible().catch(() => false)) {
    await guideButton.click();
    await expect(page.getByText(/أدخل رقمك الشخصي|Enter your personal/i)).toBeVisible();
    await clickFirstVisible(page.getByRole('button', { name: '×' }));
  }

  const statisticsButton = page.locator('button[title="الإحصائيات"], button[title="Statistics"]');
  if (await statisticsButton.count()) {
    await statisticsButton.first().click();
    await page.waitForTimeout(800);
    await inventorySurface(page, testInfo, '03-statistics-modal');
    await clickFirstVisible(page.getByRole('button', { name: /إغلاق|Close|×/i }));
  }

  const patientForm = page.locator('form').first();
  const patientIdInput = patientForm.locator('input[type="text"]').first();
  const examSelect = patientForm.locator('select').first();
  await patientIdInput.fill('1');
  await examSelect.selectOption({ index: 1 });
  await patientForm.getByRole('button', { name: /تأكيد|Confirm/i }).click();
  await expect(page.getByText(/غير صالح|أرقام|invalid|digits/i).first()).toBeVisible();

  const femaleButton = page.getByRole('button', { name: /أنثى|Female/i });
  if (await femaleButton.isVisible().catch(() => false)) {
    await femaleButton.click();
    await expect(page.getByText(/ملاحظة مهمة للعنصر النسائي|important.*female/i)).toBeVisible();
    await page.getByRole('button', { name: /ذكر|Male/i }).click();
  }

  await page.getByRole('button', { name: /الإدارة|Admin/i }).first().click();
  await fillCredentialForm(page, ADMIN_USERNAME, ADMIN_PASSWORD);
  await page.locator('form:visible').getByRole('button', { name: /دخول|Login/i }).click();
  await page.waitForURL(/\/admin(?:\/|$)/, { timeout: 30_000 });
  await expect(page.getByText(/AdminPage Error/i)).toHaveCount(0);
  await inventorySurface(page, testInfo, '10-admin-dashboard');

  const visitedSections = [];
  for (const label of adminSections) {
    const exactButton = page.getByRole('button', { name: label, exact: true });
    const partialButton = page.getByRole('button', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    const clicked = await clickFirstVisible(exactButton).catch(() => false)
      || await clickFirstVisible(partialButton).catch(() => false);
    if (!clicked) continue;

    await page.waitForTimeout(700);
    await expect(page.getByText(/AdminPage Error/i)).toHaveCount(0);
    const surface = await inventorySurface(page, testInfo, `admin-${String(visitedSections.length + 1).padStart(2, '0')}`);
    visitedSections.push({ label, headings: surface.headings, controls: surface.inventory.filter(item => item.visible).length });

    const refreshButton = page.getByRole('button', { name: /تحديث|Refresh/i });
    if (await refreshButton.count()) {
      await clickFirstVisible(refreshButton).catch(() => false);
      await page.waitForTimeout(400);
    }
  }
  await attachJson(testInfo, 'admin-sections-visited', visitedSections);
  expect(visitedSections.length).toBeGreaterThanOrEqual(8);

  const adminLogout = page.getByRole('button', { name: /تسجيل الخروج|خروج|Logout/i });
  await clickFirstVisible(adminLogout);
  await expect(page.getByRole('heading', { name: /اللجنة الطبية العسكرية|Military Medical Committee/i })).toBeVisible();

  await page.getByRole('button', { name: /الطبيب|Doctor/i }).first().click();
  await fillCredentialForm(page, DOCTOR_USERNAME, DOCTOR_PASSWORD);
  await page.locator('form:visible').getByRole('button', { name: /دخول الطبيب|Doctor Login/i }).click();
  await page.waitForURL(/\/doctor(?:\/|$)/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /E2E Doctor|الطبيب/i }).first()).toBeVisible();
  await inventorySurface(page, testInfo, '20-doctor-dashboard');

  await page.getByRole('button', { name: /تحديث|Refresh/i }).click();
  await page.getByRole('button', { name: /English|العربية/ }).click();
  await page.getByRole('button', { name: /Refresh|تحديث/i }).click();
  await page.getByRole('button', { name: /Logout|خروج/i }).click();
  await expect(page.getByRole('heading', { name: /Military Medical Committee|اللجنة الطبية العسكرية/i })).toBeVisible();

  await attachJson(testInfo, 'browser-evidence', evidence);
  expect(evidence.pageErrors, `Page errors: ${JSON.stringify(evidence.pageErrors)}`).toEqual([]);
  expect(evidence.serverErrors, `Server errors: ${JSON.stringify(evidence.serverErrors)}`).toEqual([]);
});
