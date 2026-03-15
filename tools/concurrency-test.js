/**
 * Concurrency Test - اختبار التزامن
 * محاكاة 5+ مستخدمين يضغطون "أخذ دور" في نفس الثانية
 *
 * التحقق من:
 * - لا تكرار في الأرقام
 * - لا فقدان
 * - لا تأخير غير مقبول
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables: SUPABASE_URL and/or SUPABASE_ANON_KEY');
}
const TEST_CLINIC_ID = process.env.TEST_CLINIC_ID || 'lab';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS) || 10;

async function callQueueEngine(patientId) {
  const startTime = Date.now();

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/queue-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'enter_queue',
        clinic_id: TEST_CLINIC_ID,
        patient_id: patientId,
      }),
    });

    const data = await response.json();
    const endTime = Date.now();

    return {
      patientId,
      success: data.success,
      pin: data.data?.number || data.data?.pin,
      status: data.data?.status,
      duration: endTime - startTime,
      error: data.error || data.reason,
    };
  } catch (err) {
    return {
      patientId,
      success: false,
      error: err.message,
      duration: Date.now() - startTime,
    };
  }
}

async function runConcurrencyTest() {
  console.log('='.repeat(60));
  console.log('🧪 اختبار التزامن (Concurrency Test)');
  console.log('='.repeat(60));
  console.log(`📍 العيادة: ${TEST_CLINIC_ID}`);
  console.log(`👥 عدد المستخدمين المتزامنين: ${CONCURRENT_USERS}`);
  console.log('='.repeat(60));

  // إنشاء طلبات متزامنة
  const timestamp = Date.now();
  const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => callQueueEngine(`test_patient_${timestamp}_${i}`));

  console.log('\n⏳ جاري تنفيذ الطلبات المتزامنة...\n');

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  // تحليل النتائج
  console.log('📊 النتائج:');
  console.log('-'.repeat(60));

  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);
  const pins = successfulResults.map((r) => r.pin).filter((p) => p !== undefined);
  const uniquePins = [...new Set(pins)];
  const duplicatePins = pins.length - uniquePins.length;

  // طباعة كل نتيجة
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    const pinInfo = r.pin ? `PIN: ${r.pin}` : `Error: ${r.error}`;
    console.log(`${status} User ${i + 1}: ${pinInfo} (${r.duration}ms)`);
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('📈 ملخص الاختبار:');
  console.log('='.repeat(60));
  console.log(`✅ ناجح: ${successfulResults.length}/${CONCURRENT_USERS}`);
  console.log(`❌ فاشل: ${failedResults.length}/${CONCURRENT_USERS}`);
  console.log(`🔢 أرقام فريدة: ${uniquePins.length}`);
  console.log(`⚠️ أرقام مكررة: ${duplicatePins}`);
  console.log(`⏱️ إجمالي الوقت: ${totalTime}ms`);
  console.log(`📊 متوسط الوقت: ${Math.round(totalTime / CONCURRENT_USERS)}ms`);

  // الحكم النهائي
  console.log(`\n${'='.repeat(60)}`);
  if (duplicatePins === 0 && failedResults.length === 0) {
    console.log('🎉 النتيجة: ✅ نجح الاختبار - لا تكرار ولا فقدان');
  } else if (duplicatePins > 0) {
    console.log('🚨 النتيجة: ❌ فشل الاختبار - يوجد تكرار في الأرقام!');
  } else {
    console.log('⚠️ النتيجة: جزئي - بعض الطلبات فشلت');
  }
  console.log('='.repeat(60));

  return {
    total: CONCURRENT_USERS,
    successful: successfulResults.length,
    failed: failedResults.length,
    uniquePins: uniquePins.length,
    duplicates: duplicatePins,
    totalTime,
    passed: duplicatePins === 0 && failedResults.length === 0,
  };
}

// تشغيل الاختبار
runConcurrencyTest()
  .then((result) => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ خطأ في الاختبار:', err);
    process.exit(1);
  });
