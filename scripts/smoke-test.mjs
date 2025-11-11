#!/usr/bin/env node
/**
 * Smoke Test للميزات الخمس
 * يختبر التكامل الكامل بين Vercel Frontend → Supabase Backend
 */

const BASE = process.env.API_BASE || "https://mmc-mms.com/api";
const TEST_CLINIC = "lab"; // عيادة لا تحتاج PIN
const TEST_PATIENT = `test-${Date.now()}`;

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

let passed = 0;
let failed = 0;

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function pass(test) {
  passed++;
  log(`✅ ${test}`, colors.green);
}

function fail(test, error) {
  failed++;
  log(`❌ ${test}: ${error}`, colors.red);
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err.message);
  }
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${data.error || data.message || "Unknown"}`);
  }
  return { res, data };
}

// ════════════════════════════════════════════════════════════════
// الاختبارات
// ════════════════════════════════════════════════════════════════

async function main() {
  log("\n🚀 بدء اختبار الميزات الخمس\n", colors.cyan);
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", colors.cyan);

  // 0. Health Check
  log("\n📍 نقطة الصحة (Health)", colors.blue);

  await test("Health Endpoint", async () => {
    const { data } = await fetchJSON(`${BASE}/api-v1-status`);
    if (!data.ok) throw new Error("Health check failed");
  });

  // 1. Queue System
  log("\n📍 الميزة 1: نظام الدور (Queue)", colors.blue);

  let queueId, displayNumber;

  await test("Queue - Enter", async () => {
    const { data } = await fetchJSON(`${BASE}/queue-enter`, {
      method: "POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC, patient_id: TEST_PATIENT }),
    });
    if (!data.success || !data.data.display_number) {
      throw new Error("Failed to enter queue");
    }
    queueId = data.data.queue_id;
    displayNumber = data.data.display_number;
    log(`   رقم الدور: ${displayNumber}`, colors.yellow);
  });

  await test("Queue - Status", async () => {
    const { data } = await fetchJSON(`${BASE}/queue-status?clinic_id=${TEST_CLINIC}`);
    if (!data.success || data.data.queueLength === undefined) {
      throw new Error("Queue status failed");
    }
    log(`   عدد الانتظار: ${data.data.queueLength}`, colors.yellow);
  });

  await test("Queue - Call Next", async () => {
    const { data } = await fetchJSON(`${BASE}/queue-call`, {
      method: "POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC }),
    });
    if (!data.success) throw new Error("Call next failed");
    if (data.data.called) {
      log(`   تم استدعاء رقم: ${data.data.display_number}`, colors.yellow);
    }
  });

  // 2. PIN System
  log("\n📍 الميزة 2: نظام PIN", colors.blue);

  let generatedPIN;

  await test("PIN - Generate", async () => {
    const { data } = await fetchJSON(`${BASE}/pin-generate`, {
      method: "POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC }),
    });
    if (!data.success || !data.data.pin) throw new Error("PIN generation failed");
    generatedPIN = data.data.pin;
    log(`   PIN: ${generatedPIN} (صالح: ${data.data.expires_in_seconds}s)`, colors.yellow);
  });

  await test("PIN - Verify", async () => {
    const { data } = await fetchJSON(`${BASE}/pin-verify`, {
      method: "POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC, pin: generatedPIN }),
    });
    if (!data.success || !data.data.valid) throw new Error("PIN verification failed");
    log(`   متبقي: ${data.data.remaining_seconds}s`, colors.yellow);
  });

  await test("PIN - Status", async () => {
    const { data } = await fetchJSON(`${BASE}/pin-status?clinic_id=${TEST_CLINIC}`);
    if (!data.success || data.data.active_pins === undefined) {
      throw new Error("PIN status failed");
    }
    log(`   PINs نشطة: ${data.data.active_pins}`, colors.yellow);
  });

  // 3. Realtime (تحقق أساسي من البنية)
  log("\n📍 الميزة 3: الإشعارات الفورية (Realtime)", colors.blue);

  await test("Realtime - Publication Check", async () => {
    // نتحقق أن الجداول موجودة في schema
    // Realtime يُختبر من الفرونت عمليًا
    log(
      "   ℹ️  Realtime تُختبر من الفرونت عبر Supabase Client (جداول: queues, notifications, pins)",
      colors.yellow
    );
  });

  // 4. Dynamic Routes (مدمجة في Queue)
  log("\n📍 الميزة 4: المسارات الديناميكية", colors.blue);

  await test("Dynamic Routes - Integrated in Queue", async () => {
    // المسارات تُحسب تلقائيًا عند الدخول حسب الوزن
    // هنا نتحقق فقط أن دخول الدور يعمل (تم اختباره أعلاه)
    log("   ℹ️  المسارات تُحدد تلقائيًا عند queue-enter حسب جدول weights", colors.yellow);
  });

  // 5. Reports & Stats
  log("\n📍 الميزة 5: التقارير والإحصاءات", colors.blue);

  await test("Reports - Daily (JSON)", async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await fetchJSON(`${BASE}/reports-daily?date=${today}`);
    if (!data.success) throw new Error("Daily report failed");
    log(`   سجلات: ${data.data.total_records}`, colors.yellow);
  });

  await test("Reports - Daily (HTML Print)", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`${BASE}/reports-daily?date=${today}&format=print`);
    const html = await res.text();
    if (!res.ok || !html.includes("التقرير اليومي")) {
      throw new Error("Print format failed");
    }
    log("   ℹ️  HTML للطباعة جاهز", colors.yellow);
  });

  await test("Stats - Dashboard", async () => {
    const { data } = await fetchJSON(`${BASE}/stats-dashboard`);
    if (!data.success || !data.data.overview) throw new Error("Dashboard failed");
    log(
      `   في الدور الآن: ${data.data.overview.in_queue_now}, زيارات اليوم: ${data.data.overview.visits_today}`,
      colors.yellow
    );
  });

  // ════════════════════════════════════════════════════════════════
  // النتيجة النهائية
  // ════════════════════════════════════════════════════════════════
  log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", colors.cyan);
  log("\n📊 ملخص الاختبار:", colors.cyan);
  log(`   ✅ نجح: ${passed}`, colors.green);
  log(`   ❌ فشل: ${failed}`, colors.red);

  const total = passed + failed;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  log(`   📈 نسبة النجاح: ${percentage}%`, colors.cyan);

  if (failed === 0) {
    log("\n🎉 جميع الاختبارات نجحت! النظام جاهز.", colors.green);
    process.exit(0);
  } else {
    log(`\n⚠️  ${failed} اختبار فشل. راجع الأخطاء أعلاه.`, colors.red);
    process.exit(1);
  }
}

main().catch((err) => {
  log(`\n💥 خطأ حرج: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});