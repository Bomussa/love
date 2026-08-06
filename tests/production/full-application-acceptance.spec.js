import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const ACCEPTANCE_FILE = process.env.E2E_ACCEPTANCE_FILE || '/tmp/mmc-acceptance.json';
const ADMIN_SECTIONS = [
  'لوحة التحكم',
  'إدارة الطوابير',
  'إدارة الأطباء',
  'شاشة الطبيب',
  'الإشعارات',
  'المسارات',
  'توجيه الطوابق',
  'التقارير',
  'العيادات',
  'حالة النظام',
  'الإعدادات',
  'إدارة المستخدمين',
  'الفحص والإصلاح',
  'النظام الذكي',
  'سجل النشاطات',
  'النسخ والتصدير',
  'العمل أوفلاين',
  'إدارة المحتوى',
  'المظهر',
  'قاعدة البيانات',
  'التحكم بالميزات',
  'مراقبة API',
  'مركز الملفات',
];

function loadAcceptance() {
  const payload = JSON.parse(fs.readFileSync(ACCEPTANCE_FILE, 'utf8'));
  if (!payload?.success || !payload?.data?.admin || !Array.isArray(payload?.data?.doctors)) {
    throw new Error('ACCEPTANCE_BOOTSTRAP_INVALID');
  }
  return payload.data;
}

function evidenceCollector(page) {
  const evidence = { consoleErrors: [], pageErrors: [], failedRequests: [], serverErrors: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!/fonts\.googleapis\.com|fonts\.gstatic\.com|analytics|speed-insights|vercel-insights/i.test(url)) {
      evidence.failedRequests.push({ url, error: request.failure()?.errorText || 'unknown' });
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) evidence.serverErrors.push({ status: response.status(), url: response.url() });
  });
  return evidence;
}

async function attachJson(testInfo, name, value) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2), 'utf8'),
    contentType: 'application/json',
  });
}

async function inventory(page, testInfo, name, { screenshot = true } = {}) {
  const snapshot = await page.locator('button, input, select, textarea, a[href], [role="button"], [role="tab"]').evaluateAll((elements) => {
    const labelFor = (element) => {
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) return (label.textContent || '').trim().replace(/\s+/g, ' ');
      }
      return '';
    };

    return elements.map((element, index) => ({
      index,
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
      label: labelFor(element),
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      placeholder: element.getAttribute('placeholder'),
      name: element.getAttribute('name'),
      id: element.id || null,
      href: element.getAttribute('href'),
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
      visible: Boolean(element.getClientRects().length),
    }));
  });

  const headings = await page.locator('h1, h2, h3, h4').evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length)
    .map((element) => (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean));

  const anonymous = snapshot.filter((control) => control.visible
    && !control.text
    && !control.label
    && !control.ariaLabel
    && !control.title
    && !control.placeholder
    && !control.name
    && control.type !== 'hidden');

  const result = { url: page.url(), headings, controls: snapshot, anonymousControls: anonymous };
  await attachJson(testInfo, `${name}-inventory`, result);
  if (screenshot) await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  return result;
}

async function assertEvidence(testInfo, name, evidence) {
  await attachJson(testInfo, `${name}-browser-evidence`, evidence);
  expect(evidence.pageErrors, `${name} page errors`).toEqual([]);
  expect(evidence.serverErrors, `${name} server errors`).toEqual([]);
  expect(evidence.failedRequests, `${name} failed requests`).toEqual([]);
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return candidate;
    }
  }
  return null;
}

async function fillVisibleCredentials(page, username, password) {
  const form = page.locator('form:visible').first();
  await expect(form).toBeVisible();
  await form.locator('input[type="text"]:visible').first().fill(username);
  await form.locator('input[type="password"]:visible').first().fill(password);
  return form;
}

async function loginAdmin(page, admin) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /الإدارة|Admin/i }).first().click();
  const form = await fillVisibleCredentials(page, admin.username, admin.password);
  await form.getByRole('button', { name: /دخول|Login/i }).click();
  await page.waitForURL(/\/admin(?:\/|$)/, { timeout: 30_000 });
  await expect(page.getByText('AdminPage Error')).toHaveCount(0);
}

async function loginDoctor(page, doctor) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /الطبيب|Doctor/i }).first().click();
  const form = await fillVisibleCredentials(page, doctor.username, doctor.password);
  await form.getByRole('button', { name: /دخول الطبيب|Doctor Login/i }).click();
  await page.waitForURL(/\/doctor(?:\/|$)/, { timeout: 30_000 });
  await expect(page.getByText(doctor.username, { exact: false }).first()).toBeVisible();
}

async function loginPatient(page, patientId, examType) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').first();
  await form.locator('input[type="text"]').first().fill(patientId);
  await form.locator('select').first().selectOption(examType);
  await form.getByRole('button', { name: /تأكيد|Confirm/i }).click();

  await page.waitForFunction(() => {
    try {
      const data = JSON.parse(localStorage.getItem('patientData') || 'null');
      return Boolean(data?.token && (data?.patient_id || data?.personal_id || data?.patientId));
    } catch {
      return false;
    }
  }, undefined, { timeout: 30_000 });

  await expect(page.getByText(/تعذر تحميل المسار الطبي|Unable to load the medical pathway/i)).toHaveCount(0);
  await expect(page.getByText(/جارٍ تحميل المسار الطبي|Loading medical pathway/i)).toHaveCount(0, { timeout: 30_000 });
}

async function patientSignedFetch(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const data = JSON.parse(localStorage.getItem('patientData') || '{}');
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Session-Token': data.token,
        ...(options.headers || {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
    return { status: response.status, ok: response.ok, payload };
  }, { path, options });
}

function routeStations(payload) {
  const candidates = [
    payload?.route?.stations,
    payload?.data?.route?.stations,
    payload?.data?.stations,
    payload?.stations,
    payload?.data?.path,
    payload?.path,
  ];
  const rows = candidates.find(Array.isArray) || [];
  return rows.map((station) => ({
    id: String(station?.id || station?.clinic_id || station).trim(),
    name: station?.name_ar || station?.name || station?.id || station,
  })).filter((station) => station.id);
}

async function getPatientRoute(page, patientId) {
  const response = await patientSignedFetch(page, `/api/v1/route/get?patientId=${encodeURIComponent(patientId)}`);
  expect(response.ok, `route/get ${patientId}: ${JSON.stringify(response.payload)}`).toBe(true);
  const stations = routeStations(response.payload);
  expect(stations.length, `route stations missing for ${patientId}: ${JSON.stringify(response.payload)}`).toBeGreaterThan(0);
  return { response, stations };
}

async function waitForNotice(page, matcher) {
  await expect(page.getByText(matcher).first()).toBeVisible({ timeout: 25_000 });
}

async function processStationWithDoctor(page, doctor, { useComplete = false } = {}) {
  await loginDoctor(page, doctor);
  await expect(page.getByRole('button', { name: /استدعاء التالي|Call next/i })).toBeEnabled();
  await page.getByRole('button', { name: /استدعاء التالي|Call next/i }).click();
  await waitForNotice(page, /تم استدعاء المراجع التالي|Next patient called/i);

  await expect(page.getByRole('button', { name: /بدء الفحص|Start exam/i })).toBeEnabled();
  await page.getByRole('button', { name: /بدء الفحص|Start exam/i }).click();
  await waitForNotice(page, /بدأت مرحلة الفحص|Examination started/i);

  if (useComplete) {
    await expect(page.getByRole('button', { name: /إنهاء المرحلة|Complete/i })).toBeEnabled();
    await page.getByRole('button', { name: /إنهاء المرحلة|Complete/i }).click();
    await waitForNotice(page, /اكتملت محطة العيادة|Clinic stage completed/i);
  } else {
    await expect(page.getByRole('button', { name: /تمرير الدور|Advance/i })).toBeEnabled();
    await page.getByRole('button', { name: /تمرير الدور|Advance/i }).click();
    await waitForNotice(page, /تم تمرير المراجع للمحطة التالية|Patient advanced/i);
  }

  await page.getByRole('button', { name: /خروج|Logout/i }).click();
  await expect(page.getByRole('heading', { name: /اللجنة الطبية العسكرية|Military Medical Committee/i })).toBeVisible();
}

test.describe.serial('production application acceptance', () => {
  const acceptance = loadAcceptance();

  test('public login, themes, localization, QR, statistics and all clinic displays', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
    const page = await context.newPage();
    const evidence = evidenceCollector(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /اللجنة الطبية العسكرية|Military Medical Committee/i })).toBeVisible();
    await page.waitForTimeout(6500);
    expect(await page.evaluate(() => Boolean(window.__healthMonitor))).toBe(false);
    expect(await page.locator('[data-input-handler], [data-change-handler], [data-row-handler], .interactive').count()).toBe(0);

    const loginInventory = await inventory(page, testInfo, 'public-login-ar');
    expect(loginInventory.anonymousControls, 'anonymous controls on login').toEqual([]);

    const themeButtons = page.locator('.theme-buttons-container button');
    expect(await themeButtons.count()).toBeGreaterThanOrEqual(5);
    for (let index = 0; index < await themeButtons.count(); index += 1) await themeButtons.nth(index).click();

    await page.getByRole('button', { name: /English/ }).click();
    await expect(page.getByRole('heading', { name: /Military Medical Committee/i })).toBeVisible();
    await inventory(page, testInfo, 'public-login-en');
    await page.getByRole('button', { name: /العربية/ }).click();

    await page.getByRole('button', { name: /تعليمات الدخول|Instructions/i }).click();
    await expect(page.getByText(/أدخل رقمك الشخصي أو العسكري|Enter your personal or military ID/i)).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();

    await page.locator('button[title="الإحصائيات"]').click();
    await expect(page.getByText(/الإحصائيات|Statistics/i).first()).toBeVisible();
    await inventory(page, testInfo, 'public-statistics');
    const closeStatistics = page.getByRole('button', { name: /إغلاق|Close|×/i });
    if (await closeStatistics.count()) await clickFirstVisible(closeStatistics);
    else await page.keyboard.press('Escape');

    const qrButton = page.getByRole('button', { name: /مسح الباركود|Scan QR/i });
    if (await qrButton.count()) {
      await qrButton.click();
      await inventory(page, testInfo, 'public-qr-scanner');
      const closeQr = page.getByRole('button', { name: /إغلاق|Close|إلغاء|Cancel|×/i });
      if (await closeQr.count()) await clickFirstVisible(closeQr);
      else await page.keyboard.press('Escape');
    }

    const patientForm = page.locator('form').first();
    await patientForm.locator('input[type="text"]').first().fill('1');
    await patientForm.locator('select').first().selectOption('promotion');
    await patientForm.getByRole('button', { name: /تأكيد|Confirm/i }).click();
    await expect(page.getByText(/قصير|الحد الأدنى\s*2|2 إلى 12|2-12|غير صالح|invalid/i).first()).toBeVisible();

    await page.getByRole('button', { name: /أنثى|Female/i }).click();
    await expect(page.getByText(/ملاحظة مهمة للعنصر النسائي|important.*female/i)).toBeVisible();
    await page.getByRole('button', { name: /ذكر|Male/i }).click();

    const clinicIds = [...new Set(acceptance.doctors.map((doctor) => doctor.clinic_id).filter(Boolean))];
    expect(clinicIds.length).toBeGreaterThan(0);
    for (const clinicId of clinicIds) {
      const displayPage = await context.newPage();
      const displayEvidence = evidenceCollector(displayPage);
      await displayPage.goto(`/clinic/${encodeURIComponent(clinicId)}/display`, { waitUntil: 'domcontentloaded' });
      await expect(displayPage.locator('body')).not.toContainText(/Application error|AdminPage Error/i);
      await expect(displayPage.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
      const displayInventory = await inventory(displayPage, testInfo, `display-${clinicId}`);
      expect(displayInventory.headings.length, `display heading missing for ${clinicId}`).toBeGreaterThan(0);
      await assertEvidence(testInfo, `display-${clinicId}`, displayEvidence);
      await displayPage.close();
    }

    await assertEvidence(testInfo, 'public', evidence);
    await context.close();
  });

  test('administrator can open every screen and safely exercise doctor CRUD controls', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
    const page = await context.newPage();
    const evidence = evidenceCollector(page);
    page.on('dialog', (dialog) => dialog.dismiss());

    await loginAdmin(page, acceptance.admin);
    const dashboardInventory = await inventory(page, testInfo, 'admin-dashboard');
    expect(dashboardInventory.anonymousControls, 'anonymous controls on admin dashboard').toEqual([]);

    const visited = [];
    for (const section of ADMIN_SECTIONS) {
      const button = page.getByRole('button', { name: section, exact: true });
      await expect(button, `Missing admin section: ${section}`).toBeVisible();
      await button.click();
      await page.waitForTimeout(600);
      await expect(page.getByText('AdminPage Error')).toHaveCount(0);
      const sectionInventory = await inventory(page, testInfo, `admin-${String(visited.length + 1).padStart(2, '0')}`);
      visited.push({ section, headings: sectionInventory.headings, controls: sectionInventory.controls.filter((item) => item.visible).length, anonymous: sectionInventory.anonymousControls });

      const refresh = page.getByRole('button', { name: /تحديث|Refresh/i });
      if (await refresh.count()) {
        const visibleRefresh = await clickFirstVisible(refresh);
        if (visibleRefresh) await page.waitForTimeout(350);
      }
    }
    await attachJson(testInfo, 'admin-sections', visited);
    expect(visited.length).toBe(ADMIN_SECTIONS.length);

    await page.getByRole('button', { name: 'الأطباء', exact: true }).click();
    await expect(page.getByRole('heading', { name: /إدارة الأطباء|Doctor Management/i })).toBeVisible();

    const targetDoctor = acceptance.doctors.find((doctor) => doctor.clinic_id === 'LAB') || acceptance.doctors[0];
    const search = page.getByPlaceholder(/بحث بالاسم|Search by name/i);
    await search.fill(targetDoctor.username);
    const row = page.locator('tr').filter({ hasText: targetDoctor.username }).first();
    await expect(row).toBeVisible();

    const freeze = row.locator('button[title="تجميد"], button[title="Freeze"]');
    await expect(freeze).toBeVisible();
    await freeze.click();
    await expect(row.getByText(/مجمد|Frozen/i)).toBeVisible();

    const activate = row.locator('button[title="تفعيل"], button[title="Activate"]');
    await expect(activate).toBeVisible();
    await activate.click();
    await expect(row.getByText(/نشط|Active/i)).toBeVisible();

    await row.locator('button[title="تعديل"], button[title="Edit"]').click();
    await expect(page.getByRole('heading', { name: /تعديل بيانات الطبيب|Edit Doctor/i })).toBeVisible();
    const specialty = page.getByPlaceholder(/مثال: باطنية|e\.g\., Internal Medicine/i);
    const originalSpecialty = await specialty.inputValue();
    await specialty.fill(`CI_BROWSER_${acceptance.runId}`);
    await page.getByRole('button', { name: /حفظ التغييرات|Save Changes/i }).click();
    await expect(page.getByText(/تم تحديث بيانات الطبيب|Doctor updated successfully/i)).toBeVisible();

    await search.fill(targetDoctor.username);
    const updatedRow = page.locator('tr').filter({ hasText: targetDoctor.username }).first();
    await updatedRow.locator('button[title="تعديل"], button[title="Edit"]').click();
    await expect(specialty).toHaveValue(`CI_BROWSER_${acceptance.runId}`);
    await specialty.fill(originalSpecialty);
    await page.getByRole('button', { name: /حفظ التغييرات|Save Changes/i }).click();
    await expect(page.getByText(/تم تحديث بيانات الطبيب|Doctor updated successfully/i)).toBeVisible();

    await search.fill(targetDoctor.username);
    const deleteButton = page.locator('tr').filter({ hasText: targetDoctor.username }).first().locator('button[title="حذف"], button[title="Delete"]');
    await deleteButton.click();
    await expect(page.locator('tr').filter({ hasText: targetDoctor.username }).first()).toBeVisible();

    await page.getByRole('button', { name: /إضافة طبيب|Add Doctor/i }).click();
    await expect(page.getByRole('heading', { name: /إضافة طبيب جديد|Add New Doctor/i })).toBeVisible();
    await page.getByRole('button', { name: /إضافة الطبيب|Add Doctor/i }).last().click();
    await expect(page.getByText(/الاسم مطلوب|Name is required/i)).toBeVisible();
    await page.getByRole('button', { name: /توليد|Generate/i }).click();
    await page.getByRole('button', { name: /إلغاء|Cancel/i }).click();

    await assertEvidence(testInfo, 'admin', evidence);
    await context.close();
  });

  test('doctor screen and three patient journeys complete every configured station', async ({ browser }, testInfo) => {
    const patientContext = await browser.newContext({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
    const doctorContext = await browser.newContext({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
    const patientPage = await patientContext.newPage();
    const doctorPage = await doctorContext.newPage();
    const patientEvidence = evidenceCollector(patientPage);
    const doctorEvidence = evidenceCollector(doctorPage);

    const journeys = [
      { patientId: acceptance.patientIds[0], examType: 'promotion', useCompleteAt: -1 },
      { patientId: acceptance.patientIds[1], examType: 'courses', useCompleteAt: 0 },
      { patientId: acceptance.patientIds[2], examType: 'cooks', useCompleteAt: -1 },
    ];

    const journeyEvidence = [];
    for (const journey of journeys) {
      await loginPatient(patientPage, journey.patientId, journey.examType);
      await inventory(patientPage, testInfo, `patient-${journey.examType}-start`);
      const initialRoute = await getPatientRoute(patientPage, journey.patientId);
      const stations = initialRoute.stations;

      for (let index = 0; index < stations.length; index += 1) {
        const station = stations[index];
        const doctor = acceptance.doctors.find((candidate) => String(candidate.clinic_id) === station.id);
        expect(doctor, `No CI doctor for ${station.id} in ${journey.examType}`).toBeTruthy();
        await processStationWithDoctor(doctorPage, doctor, { useComplete: index === journey.useCompleteAt });

        const routeAfter = await getPatientRoute(patientPage, journey.patientId);
        journeyEvidence.push({
          patientId: journey.patientId,
          examType: journey.examType,
          stationIndex: index,
          station: station.id,
          stationCount: stations.length,
          response: routeAfter.response.payload,
        });
      }

      await patientPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(patientPage.locator('[data-test="completion-screen"]')).toBeVisible({ timeout: 35_000 });
      await expect(patientPage.getByText(/اكتمل المسار الطبي|Medical pathway completed/i)).toBeVisible();
      await inventory(patientPage, testInfo, `patient-${journey.examType}-completed`);

      const finalRoute = await getPatientRoute(patientPage, journey.patientId);
      const routePayload = finalRoute.response.payload;
      const status = String(routePayload?.route?.status || routePayload?.data?.route?.status || routePayload?.status || '').toLowerCase();
      expect(['completed', 'done'].includes(status), `Route not completed: ${JSON.stringify(routePayload)}`).toBe(true);

      const exit = patientPage.getByRole('button', { name: /خروج|Exit/i });
      if (await exit.count()) await exit.click();
      else {
        await patientPage.evaluate(() => {
          localStorage.removeItem('patientData');
          window.location.href = '/';
        });
      }
      await expect(patientPage.getByRole('heading', { name: /اللجنة الطبية العسكرية|Military Medical Committee/i })).toBeVisible();
    }

    await attachJson(testInfo, 'journey-transitions', journeyEvidence);
    await assertEvidence(testInfo, 'patients', patientEvidence);
    await assertEvidence(testInfo, 'doctors', doctorEvidence);
    await patientContext.close();
    await doctorContext.close();
  });
});
