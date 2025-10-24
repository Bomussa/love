#!/usr/bin/env node
/**
 * Comprehensive API Endpoints Test
 * اختبار شامل لجميع الـ endpoints
 */

const BASE_URL = process.env.API_URL || 'https://love-snowy-three.vercel.app';

const tests = [
  {
    name: '1. Health Check',
    method: 'GET',
    url: '/api/v1/status',
    expected: { success: true }
  },
  {
    name: '2. Patient Login',
    method: 'POST',
    url: '/api/v1/patient/login',
    body: { patientId: '1234567890', gender: 'male' },
    expected: { success: true }
  },
  {
    name: '3. PIN Status',
    method: 'GET',
    url: '/api/v1/pin/status',
    expected: { success: true }
  },
  {
    name: '4. Queue Enter',
    method: 'POST',
    url: '/api/v1/queue/enter',
    body: { clinic: 'lab', user: '1234567890' },
    expected: { success: true }
  },
  {
    name: '5. Queue Status',
    method: 'GET',
    url: '/api/v1/queue/status?clinic=lab',
    expected: { success: true }
  },
  {
    name: '6. Route Create',
    method: 'POST',
    url: '/api/v1/route/create',
    body: { patientId: '1234567890', examType: 'recruitment', gender: 'male' },
    expected: { success: true }
  },
  {
    name: '7. Route Get',
    method: 'GET',
    url: '/api/v1/route/get?patientId=1234567890',
    expected: { success: true }
  },
  {
    name: '8. Admin Status',
    method: 'GET',
    url: '/api/v1/admin/status',
    expected: { success: true }
  },
  {
    name: '9. Stats Dashboard',
    method: 'GET',
    url: '/api/v1/stats/dashboard',
    expected: { success: true }
  },
  {
    name: '10. Stats Queues',
    method: 'GET',
    url: '/api/v1/stats/queues',
    expected: { success: true }
  },
  {
    name: '11. Daily Report',
    method: 'GET',
    url: '/api/v1/reports/daily',
    expected: { success: true }
  }
];

async function runTest(test) {
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (test.body) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(`${BASE_URL}${test.url}`, options);
    const data = await response.json();

    const passed = response.ok && data.success === test.expected.success;
    
    return {
      name: test.name,
      passed,
      status: response.status,
      data: passed ? '✅ PASS' : `❌ FAIL: ${JSON.stringify(data)}`
    };
  } catch (error) {
    return {
      name: test.name,
      passed: false,
      status: 'ERROR',
      data: `❌ ERROR: ${error.message}`
    };
  }
}

async function runAllTests() {
  console.log('🧪 Starting Comprehensive API Tests...\n');
  console.log(`📍 Base URL: ${BASE_URL}\n`);
  console.log('='.repeat(60));

  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    console.log(`\n${result.name}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Result: ${result.data}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`   ✅ Passed: ${passed}/${total}`);
  console.log(`   ❌ Failed: ${failed}/${total}`);
  console.log(`   📈 Success Rate: ${percentage}%`);

  if (percentage === 100) {
    console.log('\n🎉 All tests passed successfully!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the logs above.');
  }

  return results;
}

// Run tests
runAllTests().catch(console.error);

