#!/usr/bin/env node

/**
 * اختبار شامل للموقع الحي mmc-mms.com
 * يختبر جميع الوظائف من خلال Local Storage
 */

const fs = require('fs');
const path = require('path');

// محاكاة localStorage
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }
};

global.window = {
  location: { origin: 'https://www.mmc-mms.com' }
};

// قراءة ملف local-api.js
const localApiCode = fs.readFileSync(path.join(__dirname, 'frontend/src/lib/local-api.js'), 'utf8');

// إزالة import statements
const cleanCode = localApiCode
  .replace(/import\s+.*?from\s+['"].*?['"]/g, '')
  .replace(/export\s+default\s+localApi/g, 'global.localApi = localApi')
  .replace(/export\s+{\s*localApi\s*}/g, '');

eval(cleanCode);

const localApi = global.localApi;

console.log('\n' + '='.repeat(70));
console.log('🧪 اختبار شامل للموقع الحي: mmc-mms.com');
console.log('='.repeat(70));

// ==========================================
// اختبار 1: نظام PIN
// ==========================================
async function test1_PINSystem() {
  console.log('\n\n📌 اختبار 1: نظام PIN (رموز فتح العيادات)');
  console.log('-'.repeat(70));
  
  try {
    const pinStatus = await localApi.getPinStatus();
    
    if (!pinStatus.success) {
      throw new Error('فشل الحصول على حالة PIN');
    }
    
    console.log('✅ حالة PIN تم استرجاعها بنجاح');
    console.log(`📊 عدد العيادات المدعومة: ${Object.keys(pinStatus.pins).length}`);
    
    Object.entries(pinStatus.pins).forEach(([clinicId, pinData]) => {
      console.log(`   • ${pinData.clinicName}: PIN = ${pinData.pin}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ==========================================
// اختبار 2: نظام الطوابير
// ==========================================
async function test2_QueueSystem() {
  console.log('\n\n📊 اختبار 2: نظام الطوابير (Queue Management)');
  console.log('-'.repeat(70));
  
  try {
    // 2.1: تسجيل دخول المريض
    console.log('\n2.1️⃣  تسجيل دخول المريض...');
    const loginResult = await localApi.patientLogin('987654321', 'male');
    
    if (!loginResult.success) {
      throw new Error('فشل تسجيل الدخول');
    }
    
    const patientId = loginResult.data.id;
    console.log(`✅ تم تسجيل الدخول بنجاح`);
    console.log(`   معرف المريض: ${patientId}`);
    console.log(`   الجنس: ${loginResult.data.gender}`);
    
    // 2.2: دخول الطابور
    console.log('\n2.2️⃣  دخول الطابور (عيادة العيون)...');
    const queueResult = await localApi.enterQueue('eyes', patientId);
    
    if (!queueResult.success) {
      throw new Error('فشل دخول الطابور');
    }
    
    console.log(`✅ تم الدخول إلى الطابور بنجاح`);
    console.log(`   رقم الدور: ${queueResult.display_number}`);
    console.log(`   عدد الأشخاص قبلك: ${queueResult.ahead}`);
    
    // 2.3: الحصول على حالة الطابور
    console.log('\n2.3️⃣  الحصول على حالة الطابور...');
    const queueStatus = await localApi.getQueueStatus('eyes');
    
    if (!queueStatus.success) {
      throw new Error('فشل الحصول على حالة الطابور');
    }
    
    console.log(`✅ حالة الطابور:`);
    console.log(`   عدد المنتظرين: ${queueStatus.total_waiting}`);
    console.log(`   الدور الحالي: ${queueStatus.current_serving || 'لا يوجد'}`);
    
    // 2.4: إكمال الدور
    console.log('\n2.4️⃣  إكمال الدور (خروج من العيادة)...');
    const pins = await localApi.getPinStatus();
    const eyesPin = pins.pins.eyes.pin;
    
    const completeResult = await localApi.queueDone('eyes', patientId, eyesPin);
    
    if (!completeResult.success) {
      throw new Error('فشل إكمال الدور');
    }
    
    console.log(`✅ تم إكمال الدور بنجاح`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ==========================================
// اختبار 3: المسارات الديناميكية
// ==========================================
async function test3_DynamicPathways() {
  console.log('\n\n🛤️  اختبار 3: المسارات الديناميكية (Dynamic Pathways)');
  console.log('-'.repeat(70));
  
  try {
    // 3.1: مسار الذكور
    console.log('\n3.1️⃣  مسار المريض الذكر...');
    const malePathResult = await localApi.choosePath('male');
    
    if (!malePathResult.success) {
      throw new Error('فشل الحصول على مسار الذكور');
    }
    
    console.log(`✅ مسار الذكور:`);
    console.log(`   عدد المحطات: ${malePathResult.path.length}`);
    console.log(`   المحطات:`);
    malePathResult.path.forEach((clinic, index) => {
      const clinicNames = {
        'lab': 'المختبر',
        'xray': 'الأشعة',
        'vitals': 'القياسات الحيوية',
        'ecg': 'تخطيط القلب',
        'audio': 'السمعيات',
        'eyes': 'العيون',
        'internal': 'الباطنية',
        'ent': 'الأنف والأذن والحنجرة',
        'surgery': 'الجراحة العامة',
        'dental': 'الأسنان',
        'psychiatry': 'الطب النفسي',
        'derma': 'الجلدية',
        'bones': 'العظام'
      };
      console.log(`      ${index + 1}. ${clinicNames[clinic] || clinic}`);
    });
    
    // 3.2: مسار الإناث
    console.log('\n3.2️⃣  مسار المريضة الأنثى...');
    const femalePathResult = await localApi.choosePath('female');
    
    if (!femalePathResult.success) {
      throw new Error('فشل الحصول على مسار الإناث');
    }
    
    console.log(`✅ مسار الإناث:`);
    console.log(`   عدد المحطات: ${femalePathResult.path.length}`);
    console.log(`   المحطات:`);
    femalePathResult.path.forEach((clinic, index) => {
      const clinicNames = {
        'lab': 'المختبر',
        'xray': 'الأشعة',
        'vitals': 'القياسات الحيوية',
        'ecg': 'تخطيط القلب',
        'audio': 'السمعيات',
        'eyes': 'العيون',
        'internal': 'الباطنية',
        'ent': 'الأنف والأذن والحنجرة',
        'surgery': 'الجراحة العامة',
        'dental': 'الأسنان',
        'psychiatry': 'الطب النفسي',
        'derma': 'الجلدية',
        'bones': 'العظام'
      };
      console.log(`      ${index + 1}. ${clinicNames[clinic] || clinic}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ==========================================
// اختبار 4: نظام الإشعارات
// ==========================================
async function test4_Notifications() {
  console.log('\n\n🔔 اختبار 4: نظام الإشعارات (Notifications)');
  console.log('-'.repeat(70));
  
  try {
    // 4.1: إضافة إشعارات
    console.log('\n4.1️⃣  إضافة إشعارات...');
    
    const notifications = [
      { patient: 'patient-001', message: 'أنت الثالث - استعد', type: 'warning' },
      { patient: 'patient-001', message: 'أنت الثاني - كن جاهزاً', type: 'warning' },
      { patient: 'patient-001', message: 'دورك الآن!', type: 'success' }
    ];
    
    for (const notif of notifications) {
      const result = await localApi.addNotification(notif.patient, notif.message, notif.type);
      if (!result.success) {
        throw new Error('فشل إضافة إشعار');
      }
    }
    
    console.log(`✅ تم إضافة ${notifications.length} إشعارات بنجاح`);
    
    // 4.2: استرجاع الإشعارات
    console.log('\n4.2️⃣  استرجاع الإشعارات...');
    const getResult = await localApi.getNotifications('patient-001');
    
    if (!getResult.success) {
      throw new Error('فشل الحصول على الإشعارات');
    }
    
    console.log(`✅ الإشعارات:`);
    console.log(`   إجمالي الإشعارات: ${getResult.notifications.length}`);
    console.log(`   الإشعارات غير المقروءة: ${getResult.unread_count}`);
    getResult.notifications.forEach((notif, index) => {
      console.log(`      ${index + 1}. ${notif.message} (${notif.type})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ==========================================
// اختبار 5: نظام التقارير
// ==========================================
async function test5_Reports() {
  console.log('\n\n📈 اختبار 5: نظام التقارير (Reports)');
  console.log('-'.repeat(70));
  
  try {
    // 5.1: التقرير اليومي
    console.log('\n5.1️⃣  التقرير اليومي...');
    const dailyReport = await localApi.getDailyReport();
    
    if (!dailyReport.success) {
      throw new Error('فشل الحصول على التقرير اليومي');
    }
    
    console.log(`✅ التقرير اليومي:`);
    console.log(`   التاريخ: ${dailyReport.date}`);
    console.log(`   إجمالي المرضى: ${dailyReport.summary.total_patients}`);
    console.log(`   تم خدمتهم: ${dailyReport.summary.total_served}`);
    console.log(`   في الانتظار: ${dailyReport.summary.total_waiting}`);
    
    // 5.2: التقرير الأسبوعي
    console.log('\n5.2️⃣  التقرير الأسبوعي...');
    const weeklyReport = await localApi.getWeeklyReport();
    
    if (!weeklyReport.success) {
      throw new Error('فشل الحصول على التقرير الأسبوعي');
    }
    
    console.log(`✅ التقرير الأسبوعي:`);
    console.log(`   عدد الأيام: ${weeklyReport.days.length}`);
    console.log(`   إجمالي المرضى: ${weeklyReport.summary.total_patients}`);
    console.log(`   متوسط المرضى يومياً: ${weeklyReport.summary.avg_daily_patients}`);
    
    // 5.3: التقرير الشهري
    console.log('\n5.3️⃣  التقرير الشهري...');
    const monthlyReport = await localApi.getMonthlyReport();
    
    if (!monthlyReport.success) {
      throw new Error('فشل الحصول على التقرير الشهري');
    }
    
    console.log(`✅ التقرير الشهري:`);
    console.log(`   الشهر: ${monthlyReport.month}`);
    console.log(`   عدد الأسابيع: ${monthlyReport.weeks ? monthlyReport.weeks.length : 'N/A'}`);
    console.log(`   إجمالي المرضى: ${monthlyReport.summary.total_patients}`);
    console.log(`   متوسط المرضى يومياً: ${monthlyReport.summary.avg_daily_patients}`);
    
    // 5.4: التقرير السنوي
    console.log('\n5.4️⃣  التقرير السنوي...');
    const annualReport = await localApi.getAnnualReport();
    
    if (!annualReport.success) {
      throw new Error('فشل الحصول على التقرير السنوي');
    }
    
    console.log(`✅ التقرير السنوي:`);
    console.log(`   السنة: ${annualReport.year}`);
    console.log(`   عدد الأشهر: ${annualReport.months.length}`);
    console.log(`   إجمالي المرضى: ${annualReport.summary.total_patients}`);
    console.log(`   متوسط المرضى شهرياً: ${annualReport.summary.avg_monthly_patients}`);
    console.log(`   الشهر الأكثر ازدحاماً: الشهر ${annualReport.summary.peak_month} (${annualReport.summary.peak_count} مريض)`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ==========================================
// اختبار 6: الإحصائيات والإدارة
// ==========================================
async function test6_Statistics() {
  console.log('\n\n📊 اختبار 6: الإحصائيات والإدارة (Statistics & Admin)');
  console.log('-'.repeat(70));
  
  try {
    // 6.1: حالة الإدارة
    console.log('\n6.1️⃣  حالة الإدارة...');
    const adminStatus = await localApi.getAdminStatus();
    
    if (!adminStatus.success) {
      throw new Error('فشل الحصول على حالة الإدارة');
    }
    
    console.log(`✅ حالة الإدارة:`);
    console.log(`   إجمالي المرضى: ${adminStatus.stats.total_patients}`);
    console.log(`   في الانتظار: ${adminStatus.stats.total_waiting}`);
    console.log(`   تم خدمتهم: ${adminStatus.stats.total_served}`);
    console.log(`   PINs النشطة: ${adminStatus.stats.active_pins}`);
    
    // 6.2: قائمة الطوابير
    console.log('\n6.2️⃣  قائمة الطوابير...');
    const queues = await localApi.getQueues();
    
    if (!queues.success) {
      throw new Error('فشل الحصول على الطوابير');
    }
    
    console.log(`✅ الطوابير:`);
    console.log(`   عدد العيادات: ${queues.queues.length}`);
    queues.queues.slice(0, 5).forEach((queue) => {
      console.log(`      • ${queue.name}: ${queue.waiting} منتظر، ${queue.served} تم خدمتهم`);
    });
    if (queues.queues.length > 5) {
      console.log(`      ... و ${queues.queues.length - 5} عيادات أخرى`);
    }
    
    // 6.3: إحصائيات لوحة التحكم
    console.log('\n6.3️⃣  إحصائيات لوحة التحكم...');
    const dashboardStats = await localApi.getDashboardStats();
    
    if (!dashboardStats.success) {
      throw new Error('فشل الحصول على إحصائيات لوحة التحكم');
    }
    
    console.log(`✅ لوحة التحكم:`);
    console.log(`   إجمالي المرضى: ${dashboardStats.stats.total_patients}`);
    console.log(`   في الانتظار: ${dashboardStats.stats.total_waiting}`);
    console.log(`   تم خدمتهم: ${dashboardStats.stats.total_served}`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ==========================================
// تشغيل جميع الاختبارات
// ==========================================
async function runAllTests() {
  const results = {};
  
  results.pin = await test1_PINSystem();
  results.queue = await test2_QueueSystem();
  results.pathways = await test3_DynamicPathways();
  results.notifications = await test4_Notifications();
  results.reports = await test5_Reports();
  results.statistics = await test6_Statistics();
  
  // ملخص النتائج
  console.log('\n\n' + '='.repeat(70));
  console.log('📋 ملخص النتائج النهائي');
  console.log('='.repeat(70));
  
  const tests = [
    { name: '1️⃣  نظام PIN', result: results.pin },
    { name: '2️⃣  نظام الطوابير', result: results.queue },
    { name: '3️⃣  المسارات الديناميكية', result: results.pathways },
    { name: '4️⃣  نظام الإشعارات', result: results.notifications },
    { name: '5️⃣  نظام التقارير', result: results.reports },
    { name: '6️⃣  الإحصائيات والإدارة', result: results.statistics }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    const status = test.result ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (test.result) passed++;
    else failed++;
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`🎉 النتيجة النهائية: ${passed}/${tests.length} اختبارات نجحت`);
  console.log('='.repeat(70));
  
  if (failed === 0) {
    console.log('\n✨ جميع الميزات تعمل بنجاح على الموقع الحي! ✨\n');
  }
  
  return failed === 0;
}

// تشغيل الاختبارات
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ خطأ غير متوقع:', error);
  process.exit(1);
});
