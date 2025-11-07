/**
 * Test Supabase Edge Functions connectivity
 */

const SUPABASE_URL = 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const EDGE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

console.log('🧪 Testing Supabase Edge Functions Connectivity...\n');
console.log('═'.repeat(70));

const tests = [
  { name: 'Health Check', endpoint: 'health', method: 'GET' },
  { name: 'Queue Status', endpoint: 'queue-status', method: 'POST', body: { clinic_id: 'lab' } },
  { name: 'PIN Status', endpoint: 'pin-status', method: 'POST', body: { clinic_id: 'lab' } },
  { name: 'Admin Status', endpoint: 'admin-status', method: 'GET' },
  { name: 'Stats Dashboard', endpoint: 'stats-dashboard', method: 'GET' },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const url = `${EDGE_FUNCTIONS_BASE}/${test.endpoint}`;
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    };

    if (test.body) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok && data.success !== false) {
      console.log(`✅ ${test.name} - ${response.status} OK`);
      passed++;
    } else {
      console.log(`❌ ${test.name} - ${response.status} ${response.statusText}`);
      console.log(`   Response:`, data);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - Error: ${error.message}`);
    failed++;
  }
}

console.log('\n' + '═'.repeat(70));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Pass Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%\n`);

if (passed / (passed + failed) >= 0.8) {
  console.log('🎉 SUCCESS! Supabase Edge Functions are working!');
  process.exit(0);
} else {
  console.log('⚠️  FAILED! Some Edge Functions are not responding.');
  process.exit(1);
}
