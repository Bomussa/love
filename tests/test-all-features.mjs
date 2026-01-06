#!/usr/bin/env node
/**
 * اختبار شامل للميزات الخمسة الأساسية
 * 1. Queue System (نظام الدور/الكيو)
 * 2. PIN Code System (البن كود)
 * 3. Dynamic Routes (المسارات الديناميكية)
 * 4. Real-time Notifications (الإشعارات اللحظية)
 * 5. Reports & Analytics (التقارير والإحصاءات)
 */

import { createClient } from '@supabase/supabase-js';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ألوان للطباعة
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

// نتائج الاختبارات
const results = {
  queueSystem: { passed: 0, failed: 0, tests: [] },
  pinCode: { passed: 0, failed: 0, tests: [] },
  dynamicRoutes: { passed: 0, failed: 0, tests: [] },
  realtime: { passed: 0, failed: 0, tests: [] },
  reports: { passed: 0, failed: 0, tests: [] }
};

function recordTest(feature, testName, passed, details = '') {
  if (passed) {
    results[feature].passed++;
    results[feature].tests.push({ name: testName, status: 'PASS', details });
    success(`${testName} ${details}`);
  } else {
    results[feature].failed++;
    results[feature].tests.push({ name: testName, status: 'FAIL', details });
    error(`${testName} ${details}`);
  }
}

// ==================== 1. Queue System Tests ====================
async function testQueueSystem() {
  section('الميزة 1: نظام الدور/الكيو (Queue System)');
  
  try {
    // Test 1.1: Patient Login
    info('اختبار 1.1: تسجيل دخول المريض');
    const loginRes = await fetch(`${API_BASE}/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalId: '1234567890', gender: 'male' })
    });
    const loginData = await loginRes.json();
    recordTest('queueSystem', 'Patient Login', loginRes.ok && loginData.data?.sessionId, 
      loginData.data?.sessionId ? `Session: ${loginData.data.sessionId.substring(0, 8)}...` : '');
    
    if (!loginRes.ok) return;
    const sessionId = loginData.data.sessionId;
    
    // Test 1.2: Enter Queue
    info('اختبار 1.2: الدخول إلى الطابور');
    const enterRes = await fetch(`${API_BASE}/queue/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, clinicId: 'clinic-1' })
    });
    const enterData = await enterRes.json();
    recordTest('queueSystem', 'Enter Queue', enterRes.ok && enterData.data?.position, 
      enterData.data ? `Position: ${enterData.data.position}` : '');
    
    // Test 1.3: Queue Status
    info('اختبار 1.3: حالة الطابور');
    const statusRes = await fetch(`${API_BASE}/queue/status?clinicId=clinic-1`);
    const statusData = await statusRes.json();
    recordTest('queueSystem', 'Queue Status', statusRes.ok && statusData.data?.queueLength >= 0, 
      statusData.data ? `Queue Length: ${statusData.data.queueLength}` : '');
    
    // Test 1.4: Call Next Patient
    info('اختبار 1.4: استدعاء المريض التالي');
    const callRes = await fetch(`${API_BASE}/queue/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId: 'clinic-1' })
    });
    const callData = await callRes.json();
    recordTest('queueSystem', 'Call Next Patient', callRes.ok, 
      callData.data?.calledPatient ? `Called: ${callData.data.calledPatient.position}` : 'Queue empty');
    
  } catch (err) {
    recordTest('queueSystem', 'Queue System', false, err.message);
  }
}

// ==================== 2. PIN Code System Tests ====================
async function testPINCodeSystem() {
  section('الميزة 2: نظام البن كود (PIN Code System)');
  
  try {
    // Test 2.1: Generate PIN
    info('اختبار 2.1: توليد PIN');
    const genRes = await fetch(`${API_BASE}/pin/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId: 'clinic-1' })
    });
    const genData = await genRes.json();
    recordTest('pinCode', 'Generate PIN', genRes.ok && genData.data?.pin, 
      genData.data?.pin ? `PIN: ${genData.data.pin}` : '');
    
    if (!genRes.ok) return;
    const pin = genData.data.pin;
    
    // Test 2.2: Verify PIN
    info('اختبار 2.2: التحقق من PIN');
    const verifyRes = await fetch(`${API_BASE}/pin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, clinicId: 'clinic-1' })
    });
    const verifyData = await verifyRes.json();
    recordTest('pinCode', 'Verify PIN', verifyRes.ok && verifyData.data?.valid, 
      verifyData.data?.valid ? 'Valid' : 'Invalid');
    
    // Test 2.3: PIN Status
    info('اختبار 2.3: حالة PIN');
    const pinStatusRes = await fetch(`${API_BASE}/pin/status?clinicId=clinic-1`);
    const pinStatusData = await pinStatusRes.json();
    recordTest('pinCode', 'PIN Status', pinStatusRes.ok, 
      pinStatusData.data ? `Active PINs: ${pinStatusData.data.activePins || 0}` : '');
    
  } catch (err) {
    recordTest('pinCode', 'PIN Code System', false, err.message);
  }
}

// ==================== 3. Dynamic Routes Tests ====================
async function testDynamicRoutes() {
  section('الميزة 3: المسارات الديناميكية (Dynamic Routes)');
  
  try {
    // Test 3.1: Health Check
    info('اختبار 3.1: Health Check');
    const healthRes = await fetch(`${API_BASE}/status`);
    const healthData = await healthRes.json();
    recordTest('dynamicRoutes', 'Health Check', healthRes.ok && healthData.data?.status === 'healthy', 
      healthData.data?.status || '');
    
    // Test 3.2: API Routing
    info('اختبار 3.2: API Routing');
    const routeTests = [
      { path: '/status', expected: 200 },
      { path: '/queue/status?clinicId=clinic-1', expected: 200 },
      { path: '/pin/status?clinicId=clinic-1', expected: 200 }
    ];
    
    let routesPassed = 0;
    for (const test of routeTests) {
      const res = await fetch(`${API_BASE}${test.path}`);
      if (res.status === test.expected) routesPassed++;
    }
    
    recordTest('dynamicRoutes', 'API Routing', routesPassed === routeTests.length, 
      `${routesPassed}/${routeTests.length} routes working`);
    
  } catch (err) {
    recordTest('dynamicRoutes', 'Dynamic Routes', false, err.message);
  }
}

// ==================== 4. Real-time Notifications Tests ====================
async function testRealtimeNotifications() {
  section('الميزة 4: الإشعارات اللحظية (Real-time Notifications)');
  
  try {
    // Test 4.1: SSE Connection
    info('اختبار 4.1: اتصال SSE');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
      const sseRes = await fetch(`${API_BASE}/events/stream`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      recordTest('realtime', 'SSE Connection', sseRes.ok && sseRes.headers.get('content-type')?.includes('event-stream'), 
        sseRes.ok ? 'Connected' : 'Failed');
    } catch (err) {
      if (err.name === 'AbortError') {
        recordTest('realtime', 'SSE Connection', false, 'Timeout');
      } else {
        throw err;
      }
    }
    
    // Test 4.2: Supabase Realtime (if configured)
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      info('اختبار 4.2: Supabase Realtime');
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      let subscribed = false;
      const channel = supabase
        .channel('test-channel')
        .on('postgres_changes', { schema: 'public', table: 'queue', event: '*' }, () => {})
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') subscribed = true;
        });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      recordTest('realtime', 'Supabase Realtime', subscribed, subscribed ? 'Subscribed' : 'Not subscribed');
      
      await supabase.removeChannel(channel);
    } else {
      recordTest('realtime', 'Supabase Realtime', false, 'Not configured (SUPABASE_URL/KEY missing)');
    }
    
  } catch (err) {
    recordTest('realtime', 'Real-time Notifications', false, err.message);
  }
}

// ==================== 5. Reports & Analytics Tests ====================
async function testReportsAnalytics() {
  section('الميزة 5: التقارير والإحصاءات (Reports & Analytics)');
  
  try {
    // Test 5.1: Daily Report
    info('اختبار 5.1: التقرير اليومي');
    const dailyRes = await fetch(`${API_BASE}/reports/daily?date=${new Date().toISOString().split('T')[0]}`);
    const dailyData = await dailyRes.json();
    recordTest('reports', 'Daily Report', dailyRes.ok, 
      dailyData.data ? 'Generated' : 'Failed');
    
    // Test 5.2: Weekly Report
    info('اختبار 5.2: التقرير الأسبوعي');
    const weeklyRes = await fetch(`${API_BASE}/reports/weekly`);
    const weeklyData = await weeklyRes.json();
    recordTest('reports', 'Weekly Report', weeklyRes.ok, 
      weeklyData.data ? 'Generated' : 'Failed');
    
    // Test 5.3: Monthly Report
    info('اختبار 5.3: التقرير الشهري');
    const monthlyRes = await fetch(`${API_BASE}/reports/monthly`);
    const monthlyData = await monthlyRes.json();
    recordTest('reports', 'Monthly Report', monthlyRes.ok, 
      monthlyData.data ? 'Generated' : 'Failed');
    
    // Test 5.4: Dashboard Stats
    info('اختبار 5.4: إحصائيات Dashboard');
    const statsRes = await fetch(`${API_BASE}/stats/dashboard`);
    const statsData = await statsRes.json();
    recordTest('reports', 'Dashboard Stats', statsRes.ok, 
      statsData.data ? 'Available' : 'Failed');
    
  } catch (err) {
    recordTest('reports', 'Reports & Analytics', false, err.message);
  }
}

// ==================== Summary ====================
function printSummary() {
  section('ملخص النتائج النهائي');
  
  const features = [
    { name: 'Queue System', key: 'queueSystem', icon: '🔄' },
    { name: 'PIN Code', key: 'pinCode', icon: '🔐' },
    { name: 'Dynamic Routes', key: 'dynamicRoutes', icon: '🛣️' },
    { name: 'Real-time Notifications', key: 'realtime', icon: '🔔' },
    { name: 'Reports & Analytics', key: 'reports', icon: '📊' }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  features.forEach(({ name, key, icon }) => {
    const { passed, failed } = results[key];
    totalPassed += passed;
    totalFailed += failed;
    const total = passed + failed;
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
    
    const status = percentage >= 98 ? '✅' : percentage >= 80 ? '⚠️' : '❌';
    const color = percentage >= 98 ? 'green' : percentage >= 80 ? 'yellow' : 'red';
    
    log(`${status} ${icon} ${name}: ${passed}/${total} (${percentage}%)`, color);
  });
  
  log('\n' + '─'.repeat(60), 'blue');
  const overallTotal = totalPassed + totalFailed;
  const overallPercentage = overallTotal > 0 ? ((totalPassed / overallTotal) * 100).toFixed(1) : 0;
  const overallStatus = overallPercentage >= 98 ? '✅ نجاح' : overallPercentage >= 80 ? '⚠️ تحذير' : '❌ فشل';
  const overallColor = overallPercentage >= 98 ? 'green' : overallPercentage >= 80 ? 'yellow' : 'red';
  
  log(`\n🎯 النتيجة الإجمالية: ${totalPassed}/${overallTotal} (${overallPercentage}%)`, overallColor);
  log(`📋 الحالة: ${overallStatus}`, overallColor);
  
  if (overallPercentage >= 98) {
    log('\n🏆 تهانينا! جميع الميزات تعمل بنجاح!', 'green');
  } else if (overallPercentage >= 80) {
    log('\n⚠️  تحذير: بعض الاختبارات فشلت، يرجى المراجعة.', 'yellow');
  } else {
    log('\n❌ فشل: العديد من الاختبارات فشلت، يلزم إصلاح عاجل.', 'red');
  }
  
  return overallPercentage >= 98;
}

// ==================== Main ====================
async function main() {
  log('\n🚀 بدء اختبار الميزات الخمسة الأساسية', 'cyan');
  log(`📍 API Base: ${API_BASE}`, 'cyan');
  log(`🕐 الوقت: ${new Date().toISOString()}\n`, 'cyan');
  
  await testQueueSystem();
  await testPINCodeSystem();
  await testDynamicRoutes();
  await testRealtimeNotifications();
  await testReportsAnalytics();
  
  const success = printSummary();
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  error(`خطأ فادح: ${err.message}`);
  console.error(err);
  process.exit(1);
});
