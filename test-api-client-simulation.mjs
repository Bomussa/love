/**
 * API Client Simulation Test
 * Tests vercel-api-client.js functionality without actual API calls
 */

console.log('🧪 Starting API Client Simulation Test...\n');

// Mock fetch for simulation
global.fetch = async (url, options) => {
  console.log(`📡 Mock API Call: ${options?.method || 'GET'} ${url}`);
  
  // Simulate successful responses
  if (url.includes('/health')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: 'healthy' }),
    };
  }
  
  if (url.includes('/queue/status')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        current: 5,
        waiting: 10,
        pin: '42',
      }),
    };
  }
  
  if (url.includes('/queue/enter')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        display_number: 11,
        ahead: 10,
        position: 11,
      }),
    };
  }
  
  if (url.includes('/pin/status')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        pins: {
          lab: '42',
          xray: '13',
          vitals: '27',
        },
      }),
    };
  }
  
  if (url.includes('/admin/status')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        queues: {
          lab: { current: 5, waiting: 10 },
          xray: { current: 3, waiting: 5 },
        },
      }),
    };
  }
  
  // Default response
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  };
};

// Import the API client
const vercelApiModule = await import('./frontend/src/lib/vercel-api-client.js');
const api = vercelApiModule.default;

const tests = [
  {
    name: 'Health Check',
    test: async () => {
      const result = await api.healthCheck();
      return result.success === true;
    },
  },
  {
    name: 'Queue Status',
    test: async () => {
      const result = await api.getQueueStatus('lab');
      return result.success === true && result.current === 5;
    },
  },
  {
    name: 'Enter Queue',
    test: async () => {
      const result = await api.enterQueue('lab', { id: 'P001', gender: 'male' });
      return result.success === true && result.display_number === 11;
    },
  },
  {
    name: 'PIN Status',
    test: async () => {
      const result = await api.getPinStatus('lab');
      return result.success === true;
    },
  },
  {
    name: 'Admin Status',
    test: async () => {
      const result = await api.getAdminStatus();
      return result.success === true && result.queues !== undefined;
    },
  },
  {
    name: 'Patient Login',
    test: async () => {
      const result = await api.patientLogin('P001', 'male');
      return result.success === true;
    },
  },
];

let passed = 0;
let failed = 0;

console.log('═'.repeat(60));
console.log('');

for (const test of tests) {
  try {
    const result = await test.test();
    if (result) {
      console.log(`✅ PASS | ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL | ${test.name} (returned false)`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL | ${test.name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

console.log('');
console.log('═'.repeat(60));
console.log('\n📊 Simulation Test Summary:\n');
console.log(`Total Tests: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('');

if (failed === 0) {
  console.log('🎉 All simulation tests passed! API client is working correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some simulation tests failed. Check the API client implementation.\n');
  process.exit(1);
}
