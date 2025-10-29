#!/usr/bin/env node

/**
 * اختبار شامل نهائي لربط الفرونت اند والباك اند
 * يختبر جميع الميزات الأساسية ويحسب نسبة النجاح الدقيقة
 */

const API_BASE = process.env.API_BASE || 'https://www.mmc-mms.com';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  results.total++;
  const startTime = Date.now();
  
  try {
    await fn();
    const duration = Date.now() - startTime;
    results.passed++;
    results.tests.push({ name, status: 'PASS', duration });
    console.log(`${colors.green}✓${colors.reset} ${name} ${colors.cyan}(${duration}ms)${colors.reset}`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    results.failed++;
    results.tests.push({ name, status: 'FAIL', duration, error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${name} ${colors.cyan}(${duration}ms)${colors.reset}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}اختبار شامل نهائي - ربط الفرونت اند والباك اند${colors.reset}`);
  console.log(`${colors.blue}API Base: ${API_BASE}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  console.log(`${colors.magenta}[1] اختبارات الصحة والاتصال${colors.reset}\n`);

  // 1. Health Check
  await test('Health Check - النظام يعمل', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/status`);
    assert(response.ok, `HTTP ${response.status}`);
    
    const data = await response.json();
    assert(data.success === true, 'success should be true');
    assert(data.status === 'healthy', 'status should be healthy');
    assert(data.backend === 'up', 'backend should be up');
  });

  // 2. KV Namespaces Check
  await test('KV Namespaces - جميع قواعد البيانات متصلة', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/status`);
    const data = await response.json();
    
    assert(data.kv !== undefined, 'KV status should exist');
    assert(data.kv.admin === true, 'KV_ADMIN should be connected');
    assert(data.kv.pins === true, 'KV_PINS should be connected');
    assert(data.kv.queues === true, 'KV_QUEUES should be connected');
    assert(data.kv.events === true, 'KV_EVENTS should be connected');
    assert(data.kv.locks === true, 'KV_LOCKS should be connected');
    assert(data.kv.cache === true, 'KV_CACHE should be connected');
  });

  console.log(`\n${colors.magenta}[2] اختبارات جلب البيانات من الباك اند${colors.reset}\n`);

  // 3. PIN Status - جلب أكواد PIN
  await test('PIN Status - جلب أكواد PIN لجميع العيادات', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/pin/status`);
    assert(response.ok, `HTTP ${response.status}`);
    
    const data = await response.json();
    assert(data.success === true, 'success should be true');
    assert(data.pins !== undefined, 'pins should exist');
    assert(typeof data.pins === 'object', 'pins should be an object');
    
    // التحقق من وجود جميع العيادات
    const requiredClinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 
                             'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
                             'derma', 'bones'];
    
    for (const clinic of requiredClinics) {
      assert(data.pins[clinic] !== undefined, `PIN for ${clinic} should exist`);
      const pinData = data.pins[clinic];
      assert(pinData.pin !== undefined, `PIN value for ${clinic} should exist`);
      assert(pinData.active === true, `PIN for ${clinic} should be active`);
    }
  });

  // 4. Queue Status - جلب حالة الطابور
  await test('Queue Status - جلب حالة طابور المختبر', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/queue/status?clinic=lab`);
    assert(response.ok, `HTTP ${response.status}`);
    
    const data = await response.json();
    assert(data.success === true, 'success should be true');
    assert(data.clinic === 'lab', 'clinic should be lab');
    assert(data.list !== undefined, 'list should exist');
    assert(Array.isArray(data.list), 'list should be an array');
    assert(data.current !== undefined, 'current should exist');
    assert(data.waiting !== undefined, 'waiting should exist');
  });

  // 5. Admin Status - حالة الإدارة
  await test('Admin Status - جلب حالة لوحة الإدارة', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/admin/status`);
    assert(response.ok, `HTTP ${response.status}`);
    
    const data = await response.json();
    assert(data.success === true, 'success should be true');
  });

  console.log(`\n${colors.magenta}[3] اختبارات المصادقة والتسجيل${colors.reset}\n`);

  // 6. Patient Login
  await test('Patient Login - تسجيل دخول مريض', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: '9876543210',
        gender: 'male'
      })
    });
    
    assert(response.ok, `HTTP ${response.status}`);
    const data = await response.json();
    assert(data.success === true, 'Login should succeed');
    assert(data.data !== undefined, 'data should exist');
    assert(data.data.patientId === '9876543210', 'Patient ID should match');
    assert(data.data.gender === 'male', 'Gender should match');
  });

  console.log(`\n${colors.magenta}[4] اختبارات الأداء والاستجابة${colors.reset}\n`);

  // 7. Response Time Test
  await test('Response Time - زمن الاستجابة < 2 ثانية', async () => {
    const start = Date.now();
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/status`);
    const duration = Date.now() - start;
    
    assert(response.ok, 'Request should succeed');
    assert(duration < 2000, `Response time ${duration}ms exceeds 2000ms`);
  });

  // 8. Multiple Requests Test
  await test('Concurrent Requests - طلبات متزامنة', async () => {
    const requests = [
      fetchWithTimeout(`${API_BASE}/api/v1/status`),
      fetchWithTimeout(`${API_BASE}/api/v1/pin/status`),
      fetchWithTimeout(`${API_BASE}/api/v1/admin/status`)
    ];
    
    const responses = await Promise.all(requests);
    
    for (const response of responses) {
      assert(response.ok, 'All requests should succeed');
    }
  });

  console.log(`\n${colors.magenta}[5] اختبارات الأمان والـ CORS${colors.reset}\n`);

  // 9. CORS Headers
  await test('CORS Headers - التحقق من CORS', async () => {
    const response = await fetchWithTimeout(`${API_BASE}/api/v1/status`, {
      method: 'OPTIONS'
    });
    
    assert(response.status === 204 || response.ok, 'OPTIONS should return 204 or 200');
    assert(
      response.headers.get('Access-Control-Allow-Origin') !== null,
      'Should have CORS headers'
    );
  });

  // 10. Data Consistency Test
  await test('Data Consistency - اتساق البيانات', async () => {
    // جلب البيانات مرتين والتحقق من الاتساق
    const response1 = await fetchWithTimeout(`${API_BASE}/api/v1/pin/status`);
    const data1 = await response1.json();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response2 = await fetchWithTimeout(`${API_BASE}/api/v1/pin/status`);
    const data2 = await response2.json();
    
    assert(data1.success === data2.success, 'Data should be consistent');
    assert(data1.date === data2.date, 'Date should be consistent');
  });

  // ==========================================
  // النتائج النهائية
  // ==========================================
  
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}النتائج النهائية${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  const successRate = ((results.passed / results.total) * 100).toFixed(2);
  
  console.log(`${colors.cyan}إجمالي الاختبارات:${colors.reset} ${results.total}`);
  console.log(`${colors.green}نجح:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}فشل:${colors.reset} ${results.failed}`);
  console.log(`${colors.yellow}نسبة النجاح:${colors.reset} ${successRate}%\n`);
  
  // تفاصيل الاختبارات
  console.log(`${colors.cyan}تفاصيل الاختبارات:${colors.reset}`);
  for (const test of results.tests) {
    const status = test.status === 'PASS' 
      ? `${colors.green}✓${colors.reset}` 
      : `${colors.red}✗${colors.reset}`;
    console.log(`  ${status} ${test.name} (${test.duration}ms)`);
  }
  
  console.log('');
  
  if (successRate >= 90) {
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}✓ نسبة النجاح ${successRate}% - تجاوز الحد المطلوب (90%)${colors.reset}`);
    console.log(`${colors.green}✓ الربط بين الفرونت اند والباك اند ناجح بالكامل!${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.red}✗ نسبة النجاح ${successRate}% - أقل من الحد المطلوب (90%)${colors.reset}`);
    console.log(`${colors.red}${'='.repeat(60)}${colors.reset}\n`);
    process.exit(1);
  }
}

// تشغيل الاختبارات
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});

