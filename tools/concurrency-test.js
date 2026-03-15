/**
 * Concurrency Test - اختبار التزامن
 * محاكاة مستخدمين يضغطون "أخذ دور" بشكل متزامن
 *
 * التحقق من:
 * - لا تكرار في الأرقام
 * - لا فقدان
 * - لا تأخير غير مقبول
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'REQUIRED_SUPABASE_ANON_KEY';
const TEST_CLINIC_ID = process.env.TEST_CLINIC_ID || 'lab';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '10', 10);
const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL || '40', 10);
const QUEUE_FUNCTION = process.env.QUEUE_FUNCTION || 'queue-enter';

const endpoint = `${SUPABASE_URL}/functions/v1/${QUEUE_FUNCTION}`;

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

function normalizeResponseBody(data) {
  return {
    success: Boolean(data?.success),
    pin: data?.data?.number || data?.data?.position || data?.data?.pin || null,
    status: data?.status || data?.data?.status || null,
    error: data?.error || data?.reason || data?.message || null,
  };
}

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function callQueueFunction(patientId, attempt = 1) {
  const startTime = Date.now();

  const payload = JSON.stringify({
    clinic_id: TEST_CLINIC_ID,
    patient_id: patientId,
    patient_name: patientId,
    exam_type: 'general',
  });

  try {
    const { stdout } = await execFileAsync('curl', [
      '-sS',
      '-w', '\n%{http_code}',
      endpoint,
      '-H', `Content-Type: application/json`,
      '-H', `apikey: ${SUPABASE_ANON_KEY}`,
      '-H', `Authorization: Bearer ${SUPABASE_ANON_KEY}`,
      '--data',
      payload,
    ]);

    const lines = stdout.trimEnd().split('\n');
    const status = Number(lines.pop() || 0);
    const text = lines.join('\n');

    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { success: false, error: `Non-JSON response: ${text.slice(0, 200)}` };
    }

    const normalized = normalizeResponseBody(json);

    return {
      patientId,
      httpStatus: status || 'ERR',
      success: status >= 200 && status < 300 && normalized.success,
      pin: normalized.pin,
      status: normalized.status,
      error: normalized.error,
      raw: text,
      attempt,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    if (attempt < 3) {
      return callQueueFunction(patientId, attempt + 1);
    }

    return {
      patientId,
      httpStatus: 'ERR',
      success: false,
      error: err?.stderr || err?.message || 'curl_failed',
      attempt,
      duration: Date.now() - startTime,
    };
  }
}

async function runWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current], current);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function runConcurrencyTest() {
  console.log('='.repeat(70));
  console.log('🧪 اختبار التزامن (Concurrency Test)');
  console.log('='.repeat(70));
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`📍 العيادة: ${TEST_CLINIC_ID}`);
  console.log(`👥 إجمالي المستخدمين: ${CONCURRENT_USERS}`);
  console.log(`⚡ التوازي الفعلي: ${MAX_PARALLEL}`);
  console.log('='.repeat(70));

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'REQUIRED_SUPABASE_ANON_KEY') {
    throw new Error('SUPABASE_ANON_KEY is required');
  }

  const timestamp = Date.now();
  const patientIds = Array.from({ length: CONCURRENT_USERS }, (_, i) => `26${String(timestamp + i).slice(-8)}`);

  console.log('\n⏳ جاري تنفيذ الطلبات المتزامنة...\n');

  const startTime = Date.now();
  const results = await runWithLimit(patientIds, MAX_PARALLEL, (pid) => callQueueFunction(pid));
  const totalTime = Date.now() - startTime;

  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);
  const pins = successfulResults.map((r) => r.pin).filter((p) => p !== undefined && p !== null);
  const uniquePins = [...new Set(pins)];
  const duplicatePins = pins.length - uniquePins.length;

  const byHttpCode = failedResults.reduce((acc, r) => {
    const key = String(r.httpStatus);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 ملخص الاختبار:');
  console.log('-'.repeat(70));
  console.log(`✅ ناجح: ${successfulResults.length}/${CONCURRENT_USERS}`);
  console.log(`❌ فاشل: ${failedResults.length}/${CONCURRENT_USERS}`);
  console.log(`🔢 أرقام فريدة: ${uniquePins.length}`);
  console.log(`⚠️ أرقام مكررة: ${duplicatePins}`);
  console.log(`⏱️ إجمالي الوقت: ${totalTime}ms`);
  console.log(`📊 متوسط الوقت/طلب: ${Math.round(totalTime / CONCURRENT_USERS)}ms`);

  if (Object.keys(byHttpCode).length > 0) {
    console.log(`📉 الفشل حسب HTTP: ${JSON.stringify(byHttpCode)}`);
  }

  if (failedResults.length > 0) {
    console.log(`🧾 أول 5 أخطاء: ${JSON.stringify(failedResults.slice(0, 5).map((r) => ({
      patientId: r.patientId,
      httpStatus: r.httpStatus,
      error: r.error,
      attempt: r.attempt,
    })), null, 2)}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  if (duplicatePins === 0 && failedResults.length === 0) {
    console.log('🎉 النتيجة: ✅ نجح الاختبار - لا تكرار ولا فقدان');
  } else if (duplicatePins > 0) {
    console.log('🚨 النتيجة: ❌ فشل الاختبار - يوجد تكرار في الأرقام!');
  } else {
    console.log('⚠️ النتيجة: ❌ فشل جزئي - توجد طلبات فاشلة');
  }
  console.log('='.repeat(70));

  return {
    total: CONCURRENT_USERS,
    successful: successfulResults.length,
    failed: failedResults.length,
    uniquePins: uniquePins.length,
    duplicates: duplicatePins,
    totalTime,
    passed: duplicatePins === 0 && failedResults.length === 0,
    endpoint,
    byHttpCode,
  };
}

runConcurrencyTest()
  .then((result) => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
