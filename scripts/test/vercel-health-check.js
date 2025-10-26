#!/usr/bin/env node
/**
 * Vercel Functions Health Check Script
 * Tests API endpoints locally and in deployment
 */

const BASE_URL = process.env.DEPLOY_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, options = {}) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const duration = Date.now() - startTime;
    const status = response.status;
    
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { raw: await response.text() };
    }

    const success = response.ok;
    
    if (success) {
      log(`✅ ${name}`, 'green');
      log(`   Status: ${status} | Duration: ${duration}ms`, 'cyan');
    } else {
      log(`❌ ${name}`, 'red');
      log(`   Status: ${status} | Duration: ${duration}ms`, 'yellow');
      log(`   Error: ${data.error || 'Unknown error'}`, 'red');
    }

    return { success, status, data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    log(`❌ ${name}`, 'red');
    log(`   Error: ${error.message}`, 'red');
    log(`   Duration: ${duration}ms`, 'yellow');
    return { success: false, error: error.message, duration };
  }
}

async function runHealthChecks() {
  log('\n🏥 MMC-MMS API Health Check', 'cyan');
  log(`📍 Base URL: ${BASE_URL}\n`, 'cyan');

  const results = [];

  // Test 1: Health Status
  log('Testing health endpoints...', 'yellow');
  results.push(await testEndpoint(
    'GET /api/v1/status',
    `${BASE_URL}/api/v1/status`
  ));

  // Test 2: PIN Status
  log('\nTesting PIN endpoints...', 'yellow');
  results.push(await testEndpoint(
    'GET /api/v1/pin/status',
    `${BASE_URL}/api/v1/pin/status`
  ));

  // Test 3: Admin Status
  log('\nTesting admin endpoints...', 'yellow');
  results.push(await testEndpoint(
    'GET /api/v1/admin/status',
    `${BASE_URL}/api/v1/admin/status`
  ));

  // Test 4: Patient Login
  log('\nTesting patient endpoints...', 'yellow');
  results.push(await testEndpoint(
    'POST /api/v1/patient/login',
    `${BASE_URL}/api/v1/patient/login`,
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: '123456789',
        gender: 'male',
      }),
    }
  ));

  // Test 5: Path Choose
  results.push(await testEndpoint(
    'POST /api/v1/path/choose',
    `${BASE_URL}/api/v1/path/choose`,
    {
      method: 'POST',
      body: JSON.stringify({
        gender: 'male',
      }),
    }
  ));

  // Test 6: Queue Enter
  log('\nTesting queue endpoints...', 'yellow');
  results.push(await testEndpoint(
    'POST /api/v1/queue/enter',
    `${BASE_URL}/api/v1/queue/enter`,
    {
      method: 'POST',
      body: JSON.stringify({
        clinic: 'lab',
        user: '123456789',
      }),
    }
  ));

  // Test 7: Queue Status
  results.push(await testEndpoint(
    'GET /api/v1/queue/status?clinic=lab',
    `${BASE_URL}/api/v1/queue/status?clinic=lab`
  ));

  // Test 8: Reports
  log('\nTesting report endpoints...', 'yellow');
  results.push(await testEndpoint(
    'GET /api/v1/reports/daily',
    `${BASE_URL}/api/v1/reports/daily`
  ));

  // Test 9: CORS check
  log('\nTesting CORS...', 'yellow');
  const corsResult = await testEndpoint(
    'OPTIONS /api/v1/status (CORS preflight)',
    `${BASE_URL}/api/v1/status`,
    { method: 'OPTIONS' }
  );
  results.push(corsResult);

  // Summary
  log('\n📊 Test Summary', 'cyan');
  log('═══════════════', 'cyan');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  const avgDuration = Math.round(
    results.reduce((sum, r) => sum + r.duration, 0) / total
  );

  log(`✅ Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
  log(`❌ Failed: ${failed}/${total}`, failed > 0 ? 'red' : 'green');
  log(`⏱️  Average Response Time: ${avgDuration}ms`, 'cyan');

  if (passed === total) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the output above.', 'yellow');
    process.exit(1);
  }
}

// Run the health checks
runHealthChecks().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
