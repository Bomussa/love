import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const ACCEPTANCE_FILE = process.env.E2E_ACCEPTANCE_FILE || '/tmp/mmc-acceptance.json';
const MAX_SYNC_MS = 2500;
const RECRUITMENT_CLINICS = ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'];

function acceptanceData() {
  const payload = JSON.parse(fs.readFileSync(ACCEPTANCE_FILE, 'utf8'));
  const acceptance = payload?.data || payload;
  if (!acceptance?.patientIds?.[3] || !Array.isArray(acceptance?.doctors)) {
    throw new Error('RECRUITMENT_ACCEPTANCE_DATA_INVALID');
  }
  return acceptance;
}

function doctorFor(acceptance, clinicId) {
  const doctor = acceptance.doctors.find((item) => String(item.clinic_id) === String(clinicId));
  if (!doctor?.username || !doctor?.password) throw new Error(`DOCTOR_MISSING_FOR_${clinicId}`);
  return doctor;
}

async function loginPatient(page, patientId) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /اللجنة الطبية العسكرية|Military Medical Committee/i })).toBeVisible();
  await page.locator('input[type="text"]').first().fill(patientId);
  await page.locator('select').selectOption('recruitment');
  await page.getByRole('button', { name: /تأكيد|Confirm/i }).click();
  await expect(page.locator('[data-test="patient-page"]')).toBeVisible({ timeout: 30_000 });
}

async function loginDoctor(page, doctor) {
  await page.goto('/doctor');
  await page.getByRole('button', { name: /الطبيب|Doctor/i }).click();
  await page.locator('input[type="text"]').last().fill(doctor.username);
  await page.locator('input[type="password"]').last().fill(doctor.password);
  await page.getByRole('button', { name: /دخول الطبيب|Doctor Login/i }).click();
  await expect(page.getByText(/لوحة الطبيب|Doctor dashboard/i)).toBeVisible({ timeout: 20_000 });
}

async function numericAttribute(page, selector, attribute) {
  const value = await page.locator(selector).getAttribute(attribute);
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function waitForVersion(page, previousVersion, startedAt, label) {
  await expect.poll(
    () => numericAttribute(page, '[data-test="patient-page"], [data-test="completion-screen"]', 'data-route-version'),
    { timeout: MAX_SYNC_MS, intervals: [100, 150, 250, 350] },
  ).toBeGreaterThan(previousVersion);
  const elapsed = Date.now() - startedAt;
  expect(elapsed, `${label} exceeded ${MAX_SYNC_MS}ms`).toBeLessThanOrEqual(MAX_SYNC_MS);
  return elapsed;
}

async function stationSnapshot(page) {
  return page.locator('[data-test="route-station"]').evaluateAll((nodes) => nodes.map((node) => ({
    clinicId: node.getAttribute('data-clinic-id'),
    status: node.getAttribute('data-status'),
    order: Number(node.getAttribute('data-order')),
  })));
}

async function assertStationLocking(page, expectedCurrentClinic = null) {
  const snapshot = await stationSnapshot(page);
  expect(snapshot.length).toBeGreaterThan(0);
  const ready = snapshot.filter((station) => station.status === 'ready');
  expect(ready).toHaveLength(1);
  if (expectedCurrentClinic) expect(ready[0].clinicId).toBe(expectedCurrentClinic);

  const readyIndex = snapshot.findIndex((station) => station.status === 'ready');
  snapshot.forEach((station, index) => {
    if (index < readyIndex) expect(station.status).toBe('completed');
    if (index > readyIndex) expect(station.status).toBe('locked');
  });
  return snapshot;
}

async function clonePatientToSecondPhone(browser, sourcePage) {
  const state = await sourcePage.evaluate(() => ({
    patientData: localStorage.getItem('patientData'),
    selectedTheme: localStorage.getItem('selectedTheme'),
    language: localStorage.getItem('mmc_language') || localStorage.getItem('language'),
  }));
  expect(state.patientData).toBeTruthy();

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ar-QA',
    timezoneId: 'Asia/Qatar',
  });
  await context.addInitScript((stored) => {
    if (stored.patientData) localStorage.setItem('patientData', stored.patientData);
    if (stored.selectedTheme) localStorage.setItem('selectedTheme', stored.selectedTheme);
    if (stored.language) localStorage.setItem('mmc_language', stored.language);
  }, state);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-test="patient-page"]')).toBeVisible({ timeout: 30_000 });
  return { context, page };
}

async function waitForRealtimeSubscription(page) {
  await expect.poll(
    () => page.locator('[data-test="patient-page"]').getAttribute('data-realtime-status'),
    { timeout: 15_000 },
  ).toBe('SUBSCRIBED');
}

async function runDoctorTransition({ doctorPage, patientPages, doctor, clinicId, isLast, timings }) {
  await loginDoctor(doctorPage, doctor);
  await expect(doctorPage.getByText(clinicId, { exact: true })).toBeVisible();

  const runAndObserve = async (buttonName, label) => {
    const previous = await Promise.all(patientPages.map((page) => numericAttribute(
      page,
      '[data-test="patient-page"], [data-test="completion-screen"]',
      'data-route-version',
    )));
    const startedAt = Date.now();
    await doctorPage.getByRole('button', { name: buttonName }).click();
    await Promise.all(patientPages.map((page, index) => waitForVersion(page, previous[index], startedAt, label)));
    timings.push({ clinicId, action: label, elapsedMs: Date.now() - startedAt });
  };

  await runAndObserve(/استدعاء التالي|Call next/i, 'call');
  await runAndObserve(/بدء الفحص|Start exam/i, 'start');
  await runAndObserve(/تمرير الدور|Advance/i, 'advance');

  if (isLast) {
    await Promise.all(patientPages.map((page) => expect(page.locator('[data-test="completion-screen"]')).toBeVisible({ timeout: 15_000 })));
  } else {
    await Promise.all(patientPages.map((page) => expect(page.locator('[data-test="patient-page"]')).toBeVisible()));
  }

  await doctorPage.getByRole('button', { name: /خروج|Logout/i }).click();
}

test.describe.configure({ mode: 'serial' });

test('completes recruitment through every clinic with locked routes and synchronized phone screens', async ({ browser }, testInfo) => {
  test.setTimeout(12 * 60 * 1000);
  const acceptance = acceptanceData();
  const patientId = acceptance.patientIds[3];
  const timings = [];

  const phoneOneContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ar-QA',
    timezoneId: 'Asia/Qatar',
  });
  const doctorContext = await browser.newContext({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
  const phoneOne = await phoneOneContext.newPage();
  const doctorPage = await doctorContext.newPage();

  try {
    await loginPatient(phoneOne, patientId);
    const initial = await assertStationLocking(phoneOne);
    expect(initial.map((station) => station.clinicId).sort()).toEqual([...RECRUITMENT_CLINICS].sort());
    expect(initial).toHaveLength(RECRUITMENT_CLINICS.length);

    const { context: phoneTwoContext, page: phoneTwo } = await clonePatientToSecondPhone(browser, phoneOne);
    try {
      await waitForRealtimeSubscription(phoneOne);
      await waitForRealtimeSubscription(phoneTwo);
      await assertStationLocking(phoneTwo, initial.find((station) => station.status === 'ready').clinicId);

      for (let index = 0; index < RECRUITMENT_CLINICS.length; index += 1) {
        const phoneOneSnapshot = await assertStationLocking(phoneOne);
        const currentClinic = phoneOneSnapshot.find((station) => station.status === 'ready')?.clinicId;
        expect(currentClinic).toBeTruthy();
        await assertStationLocking(phoneTwo, currentClinic);

        const doctor = doctorFor(acceptance, currentClinic);
        await runDoctorTransition({
          doctorPage,
          patientPages: [phoneOne, phoneTwo],
          doctor,
          clinicId: currentClinic,
          isLast: index === RECRUITMENT_CLINICS.length - 1,
          timings,
        });

        if (index < RECRUITMENT_CLINICS.length - 1) {
          const afterOne = await assertStationLocking(phoneOne);
          const nextClinic = afterOne.find((station) => station.status === 'ready')?.clinicId;
          expect(nextClinic).not.toBe(currentClinic);
          await assertStationLocking(phoneTwo, nextClinic);
        }
      }

      await expect(phoneOne.locator('[data-test="completion-screen"]')).toBeVisible();
      await expect(phoneTwo.locator('[data-test="completion-screen"]')).toBeVisible();
      await testInfo.attach('recruitment-realtime-timings.json', {
        body: Buffer.from(JSON.stringify(timings, null, 2)),
        contentType: 'application/json',
      });
      await testInfo.attach('recruitment-completed-phone-one.png', {
        body: await phoneOne.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      await testInfo.attach('recruitment-completed-phone-two.png', {
        body: await phoneTwo.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    } finally {
      await phoneTwoContext.close();
    }
  } finally {
    await phoneOneContext.close();
    await doctorContext.close();
  }
});
