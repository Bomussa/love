#!/usr/bin/env node
/**
 * Comprehensive API Endpoints Test
 * Tests all critical endpoints for the 5 main features
 */

const BASE_URL = process.env.API_BASE_URL || 'https://mmc-mms.com';

const tests = [
  {
    name: '1. Health Check',
    endpoint: '/api/v1/health',
    method: 'GET',
    feature: 'Infrastructure',
  },
  {
    name: '2. Queue Status',
    endpoint: '/api/v1/queue/status?clinic_id=lab',
    method: 'GET',
    feature: 'Queue System',
  },
  {
    name: '3. PIN Status',
    endpoint: '/api/v1/pin/status',
    method: 'GET',
    feature: 'PIN Code System',
  },
  {
    name: '4. Admin Status',
    endpoint: '/api/v1/admin/status',
    method: 'GET',
    feature: 'Admin Dashboard',
  },
  {
    name: '5. Queue Stats',
    endpoint: '/api/v1/stats/queues',
    method: 'GET',
    feature: 'Statistics & Reports',
  },
  {
    name: '6. Dashboard Stats',
    endpoint: '/api/v1/stats/dashboard',
    method: 'GET',
    feature: 'Statistics & Reports',
  },
];

async function testEndpoint(test) {
  const url = `${BASE_URL}${test.endpoint}`;
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const duration = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));
    
    const status = response.ok ? '✅ PASS' : '❌ FAIL';
    const statusCode = response.status;
    
    console.log(`${status} | ${test.name}`);
    console.log(`   Feature: ${test.feature}`);
    console.log(`   Status: ${statusCode} | Duration: ${duration}ms`);
    console.log(`   Endpoint: ${test.endpoint}`);
    
    if (!response.ok) {
      console.log(`   Error: ${data.error || 'Unknown error'}`);
    }
    
    console.log('');
    
    return {
      name: test.name,
      feature: test.feature,
      passed: response.ok,
      statusCode,
      duration,
      error: data.error,
    };
  } catch (error) {
    console.log(`❌ FAIL | ${test.name}`);
    console.log(`   Feature: ${test.feature}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    
    return {
      name: test.name,
      feature: test.feature,
      passed: false,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log('🧪 Starting API Endpoints Test...\n');
  console.log(`📍 Base URL: ${BASE_URL}\n`);
  console.log('═'.repeat(60));
  console.log('');
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test);
    results.push(result);
  }
  
  console.log('═'.repeat(60));
  console.log('\n📊 Test Summary:\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);
  
  console.log('\n🎯 Feature Coverage:\n');
  
  const features = {};
  results.forEach(r => {
    if (!features[r.feature]) {
      features[r.feature] = { passed: 0, total: 0 };
    }
    features[r.feature].total++;
    if (r.passed) features[r.feature].passed++;
  });
  
  Object.entries(features).forEach(([feature, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const status = rate === '100' ? '✅' : rate >= '50' ? '⚠️' : '❌';
    console.log(`${status} ${feature}: ${stats.passed}/${stats.total} (${rate}%)`);
  });
  
  console.log('\n' + '═'.repeat(60));
  
  if (passRate >= 80) {
    console.log('\n🎉 EXCELLENT! System is ready for production.\n');
  } else if (passRate >= 50) {
    console.log('\n⚠️  WARNING! Some endpoints need attention.\n');
  } else {
    console.log('\n❌ CRITICAL! Major issues detected.\n');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
