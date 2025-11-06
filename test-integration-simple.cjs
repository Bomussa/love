#!/usr/bin/env node

/**
 * اختبار شامل لنظام Local Storage Integration
 * يختبر جميع الوظائف: PIN, Queue, Notifications, Reports, Statistics
 */

// محاكاة localStorage
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }
};

// محاكاة window
global.window = {
  location: { origin: 'http://localhost:3000' }
};

// قراءة ملف local-api.js
const fs = require('fs');
const path = require('path');

// قراءة الملف وتنفيذه
const localApiCode = fs.readFileSync(path.join(__dirname, 'frontend/src/lib/local-api.js'), 'utf8');

// إزالة import statements
const cleanCode = localApiCode
  .replace(/import\s+.*?from\s+['"].*?['"]/g, '')
  .replace(/export\s+default\s+localApi/g, 'global.localApi = localApi')
  .replace(/export\s+{\s*localApi\s*}/g, '');

eval(cleanCode);

const localApi = global.localApi;

// ==========================================
// اختبار PIN System
// ==========================================
async function testPINSystem() {
  console.log('\n🔐 اختبار نظام PIN...');
  
  try {
    const pinStatus = await localApi.getPinStatus();
    
    if (!pinStatus.success) {
      throw new Error('فشل الحصول على حالة PIN');
    }
    
    if (!pinStatus.pins || Object.keys(pinStatus.pins).length === 0) {
      throw new Error('لا توجد PINs محفوظة');
    }
    
    console.log(`✅ تم العثور على ${Object.keys(pinStatus.pins).length} PINs`);
    console.log(`   - العيادات المدعومة: ${Object.keys(pinStatus.pins).join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في اختبار PIN:', error.message);
    return false;
  }
}

// ==========================================
// اختبار Queue System
// ==========================================
async function testQueueSystem() {
  console.log('\n📊 اختبار نظام الطوابير...');
  
  try {
    // 1. تسجيل دخول المريض
    console.log('  1️⃣  تسجيل دخول المريض...');
    const loginResult = await localApi.patientLogin('123456', 'male');
    
    if (!loginResult.success) {
      throw new Error('فشل تسجيل الدخول');
    }
    
    const patientId = loginResult.data.id;
    console.log(`     ✅ تم تسجيل الدخول: ${patientId}`);
    
    // 2. دخول الطابور
    console.log('  2️⃣  دخول الطابور...');
    const queueResult = await localApi.enterQueue('eyes', patientId);
    
    if (!queueResult.success) {
      throw new Error('فشل دخول الطابور');
    }
    
    console.log(`     ✅ تم الدخول إلى الطابور: رقم ${queueResult.display_number}`);
    
    // 3. الحصول على حالة الطابور
    console.log('  3️⃣  الحصول على حالة الطابور...');
    const queueStatus = await localApi.getQueueStatus('eyes');
    
    if (!queueStatus.success) {
      throw new Error('فشل الحصول على حالة الطابور');
    }
    
    console.log(`     ✅ عدد المنتظرين: ${queueStatus.total_waiting}`);
    
    // 4. إكمال الدور
    console.log('  4️⃣  إكمال الدور...');
    const pins = await localApi.getPinStatus();
    const eyesPin = pins.pins.eyes.pin;
    
    const completeResult = await localApi.queueDone('eyes', patientId, eyesPin);
    
    if (!completeResult.success) {
      throw new Error('فشل إكمال الدور');
    }
    
    console.log(`     ✅ تم إكمال الدور بنجاح`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في اختبار الطوابير:', error.message);
    return false;
  }
}

// ==========================================
// اختبار Dynamic Pathways
// ==========================================
async function testDynamicPathways() {
  console.log('\n🛤️  اختبار المسارات الديناميكية...');
  
  try {
    // اختبار المسار للذكور
    console.log('  1️⃣  المسار للذكور...');
    const malePathResult = await localApi.choosePath('male');
    
    if (!malePathResult.success || !malePathResult.path || malePathResult.path.length === 0) {
      throw new Error('فشل الحصول على المسار للذكور');
    }
    
    console.log(`     ✅ عدد المحطات للذكور: ${malePathResult.path.length}`);
    
    // اختبار المسار للإناث
    console.log('  2️⃣  المسار للإناث...');
    const femalePathResult = await localApi.choosePath('female');
    
    if (!femalePathResult.success || !femalePathResult.path || femalePathResult.path.length === 0) {
      throw new Error('فشل الحصول على المسار للإناث');
    }
    
    console.log(`     ✅ عدد المحطات للإناث: ${femalePathResult.path.length}`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في اختبار المسارات الديناميكية:', error.message);
    return false;
  }
}

// ==========================================
// اختبار Notifications
// ==========================================
async function testNotifications() {
  console.log('\n🔔 اختبار نظام الإشعارات...');
  
  try {
    // 1. إضافة إشعار
    console.log('  1️⃣  إضافة إشعار...');
    const addResult = await localApi.addNotification('patient-123', 'أنت الثالث - استعد', 'info');
    
    if (!addResult.success) {
      throw new Error('فشل إضافة الإشعار');
    }
    
    console.log(`     ✅ تم إضافة الإشعار`);
    
    // 2. الحصول على الإشعارات
    console.log('  2️⃣  الحصول على الإشعارات...');
    const getResult = await localApi.getNotifications('patient-123');
    
    if (!getResult.success) {
      throw new Error('فشل الحصول على الإشعارات');
    }
    
    if (getResult.notifications.length === 0) {
      throw new Error('لم يتم العثور على إشعارات');
    }
    
    console.log(`     ✅ عدد الإشعارات: ${getResult.notifications.length}`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في اختبار الإشعارات:', error.message);
    return false;
  }
}

// ==========================================
// اختبار Reports
// ==========================================
async function testReports() {
  console.log('\n📈 اختبار نظام التقارير...');
  
  try {
    // 1. التقرير اليومي
    console.log('  1️⃣  التقرير اليومي...');
    const dailyReport = await localApi.getDailyReport();
    
    if (!dailyReport.success) {
      throw new Error('فشل الحصول على التقرير اليومي');
    }
    
    console.log(`     ✅ التقرير اليومي: ${dailyReport.date}`);
    
    // 2. التقرير الأسبوعي
    console.log('  2️⃣  التقرير الأسبوعي...');
    const weeklyReport = await localApi.getWeeklyReport();
    
    if (!weeklyReport.success) {
      throw new Error('فشل الحصول على التقرير الأسبوعي');
    }
    
    console.log(`     ✅ التقرير الأسبوعي: ${weeklyReport.days.length} أيام، ${weeklyReport.summary.total_patients} مريض`);
    
    // 3. التقرير الشهري
    console.log('  3️⃣  التقرير الشهري...');
    const monthlyReport = await localApi.getMonthlyReport();
    
    if (!monthlyReport.success) {
      throw new Error('فشل الحصول على التقرير الشهري');
    }
    
    console.log(`     ✅ التقرير الشهري: ${monthlyReport.summary.total_patients} مريض`);
    
    // 4. التقرير السنوي
    console.log('  4️⃣  التقرير السنوي...');
    const annualReport = await localApi.getAnnualReport();
    
    if (!annualReport.success) {
      throw new Error('فشل الحصول على التقرير السنوي');
    }
    
    console.log(`     ✅ التقرير السنوي: ${annualReport.summary.total_patients} مريض`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في اختبار التقارير:', error.message);
    return false;
  }
}

// ==========================================
// اختبار Statistics/Admin
// ==========================================
async function testStatistics() {
  console.log('\n📊 اختبار الإحصائيات والإدارة...');
  
  try {
    // 1. حالة الإدارة
    console.log('  1️⃣  حالة الإدارة...');
    const adminStatus = await localApi.getAdminStatus();
    
    if (!adminStatus.success) {
      throw new Error('فشل الحصول على حالة الإدارة');
    }
    
    console.log(`     ✅ الإحصائيات: ${adminStatus.stats.total_patients} مريض، ${adminStatus.stats.total_served} تم خدمتهم`);
    
    // 2. الطوابير
    console.log('  2️⃣  الطوابير...');
    const queues = await localApi.getQueues();
    
    if (!queues.success) {
      throw new Error('فشل الحصول على الطوابير');
    }
    
    console.log(`     ✅ عدد العيادات: ${queues.queues.length}`);
    
    // 3. إحصائيات لوحة التحكم
    console.log('  3️⃣  إحصائيات لوحة التحكم...');
    const dashboardStats = await localApi.getDashboardStats();
    
    if (!dashboardStats.success) {
      throw new Error('فشل الحصول على إحصائيات لوحة التحكم');
    }
    
    console.log(`     ✅ لوحة التحكم: ${dashboardStats.stats.total_waiting} في الانتظار`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في اختبار الإحصائيات:', error.message);
    return false;
  }
}

// ==========================================
// تشغيل جميع الاختبارات
// ==========================================
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 اختبار شامل لنظام Local Storage Integration');
  console.log('='.repeat(60));
  
  const results = {};
  
  results.pin = await testPINSystem();
  results.queue = await testQueueSystem();
  results.pathways = await testDynamicPathways();
  results.notifications = await testNotifications();
  results.reports = await testReports();
  results.statistics = await testStatistics();
  
  // ملخص النتائج
  console.log('\n' + '='.repeat(60));
  console.log('📋 ملخص النتائج');
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'نظام PIN', result: results.pin },
    { name: 'نظام الطوابير', result: results.queue },
    { name: 'المسارات الديناميكية', result: results.pathways },
    { name: 'نظام الإشعارات', result: results.notifications },
    { name: 'نظام التقارير', result: results.reports },
    { name: 'الإحصائيات والإدارة', result: results.statistics }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    const status = test.result ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (test.result) passed++;
    else failed++;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 النتيجة النهائية: ${passed}/${tests.length} اختبارات نجحت`);
  console.log('='.repeat(60) + '\n');
  
  return failed === 0;
}

// تشغيل الاختبارات
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ خطأ غير متوقع:', error);
  process.exit(1);
});
