const fetch = require('node-fetch');

const BASE_URL = 'https://rujwuruuosffcxazymit.supabase.co/functions/v1';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0NjQzMjksImV4cCI6MjA0NTA0MDMyOX0.Wj1d-3WJz-ro-s-3WJz-ro-s-3WJz-ro-s-3WJz-ro';

const endpoints = [
  { name: 'Health Check', path: '/health' },
  { name: 'Queue Status', path: '/queue-status' },
  { name: 'PIN Status', path: '/pin-status' },
  { name: 'Admin Status', path: '/admin-status' },
  { name: 'Stats Dashboard', path: '/stats-dashboard' },
];

async function testEndpoints() {
  console.log('🚀 Starting Supabase Edge Functions Test...');
  let passCount = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint.path}`,
        {
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        console.log(`✅ ${endpoint.name}: Passed (Status: ${response.status})`);
        passCount++;
      } else {
        console.error(`❌ ${endpoint.name}: Failed (Status: ${response.status})`);
      }
    } catch (error) {
      console.error(`❌ ${endpoint.name}: Error - ${error.message}`);
    }
  }

  const passRate = (passCount / endpoints.length) * 100;
  console.log(`
🏁 Test Complete! Pass Rate: ${passRate.toFixed(2)}%`);
}

testEndpoints();
