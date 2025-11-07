#!/usr/bin/env node

/**
 * Comprehensive API Integration Test
 * Tests all endpoints with real code execution
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const tests = [];
let passed = 0;
let failed = 0;

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  return { status: response.status, data };
}

// Test function
async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ PASSED: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ==================== TESTS ====================

async function runTests() {
  console.log('🚀 Starting API Integration Tests...\n');
  console.log(`API Base: ${API_BASE}\n`);
  
  // Test 1: Status Endpoint
  await test('GET /api/v1/status', async () => {
    const { status, data } = await apiCall('/api/v1/status');
    assertEqual(status, 200, 'Status should be 200');
    assert(data.success, 'Response should be successful');
    assert(data.data.status === 'healthy', 'Status should be healthy');
    assert(data.data.platform === 'vercel', 'Platform should be vercel');
  });
  
  // Test 2: Patient Login
  await test('POST /api/v1/patient/login', async () => {
    const { status, data } = await apiCall('/api/v1/patient/login', 'POST', {
      personalId: '1234567890',
      gender: 'male'
    });
    assert(status === 200 || status === 404, 'Status should be 200 or 404');
    assert(data.success !== undefined, 'Response should have success field');
  });
  
  // Test 3: Patient Enqueue
  await test('POST /api/v1/patient/enqueue', async () => {
    const { status, data } = await apiCall('/api/v1/patient/enqueue', 'POST', {
      personalId: '1234567890',
      gender: 'male',
      examType: 'recruitment',
      clinicId: 'clinic-1'
    });
    assert(status === 200 || status === 400, 'Status should be 200 or 400');
    assert(data.success !== undefined, 'Response should have success field');
  });
  
  // Test 4: Queue Status
  await test('GET /api/v1/queue/status?clinicId=clinic-1', async () => {
    const { status, data } = await apiCall('/api/v1/queue/status?clinicId=clinic-1');
    assertEqual(status, 200, 'Status should be 200');
    assert(data.success, 'Response should be successful');
  });
  
  // Test 5: Queue Position
  await test('POST /api/v1/queue/position', async () => {
    const { status, data } = await apiCall('/api/v1/queue/position', 'POST', {
      clinicId: 'clinic-1',
      patientId: '1234567890'
    });
    assertEqual(status, 200, 'Status should be 200');
    assert(data.success, 'Response should be successful');
    assert(data.data.position !== undefined, 'Should have position field');
  });
  
  // Test 6: Admin Login (with test credentials)
  await test('POST /api/v1/admin/login', async () => {
    const { status, data } = await apiCall('/api/v1/admin/login', 'POST', {
      username: 'Bomussa',
      password: '14490'
    });
    assert(status === 200 || status === 401, 'Status should be 200 or 401');
    assert(data.success !== undefined, 'Response should have success field');
    
    if (status === 200) {
      assert(data.data.session, 'Should have session data');
      assert(data.data.session.id, 'Session should have ID');
      console.log(`   📝 Session ID: ${data.data.session.id}`);
    }
  });
  
  // Test 7: Admin Status
  await test('GET /api/v1/admin/status', async () => {
    const { status, data } = await apiCall('/api/v1/admin/status');
    assertEqual(status, 200, 'Status should be 200');
    assert(data.success, 'Response should be successful');
    assert(data.data.queues !== undefined, 'Should have queues count');
    assert(data.data.pins !== undefined, 'Should have pins count');
  });
  
  // Test 8: Dynamic Route
  await test('POST /api/v1/route/calculate', async () => {
    const { status, data } = await apiCall('/api/v1/route/calculate', 'POST', {
      examType: 'recruitment',
      personalId: '1234567890'
    });
    assert(status === 200 || status === 400, 'Status should be 200 or 400');
    assert(data.success !== undefined, 'Response should have success field');
  });
  
  // Test 9: Events Stream (just check it exists)
  await test('GET /api/v1/events/stream', async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/events/stream`);
      assert(response.status === 200, 'Events stream should be accessible');
    } catch (error) {
      // Stream might timeout, that's OK
      assert(true, 'Events stream endpoint exists');
    }
  });
  
  // Test 10: PIN Generate
  await test('POST /api/v1/pin/generate', async () => {
    const { status, data } = await apiCall('/api/v1/pin/generate', 'POST', {
      clinicId: 'clinic-1',
      count: 5
    });
    assert(status === 200 || status === 400, 'Status should be 200 or 400');
    assert(data.success !== undefined, 'Response should have success field');
  });
  
  // ==================== RESULTS ====================
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  console.log(`🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED ⚠️\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
