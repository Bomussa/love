// Test API endpoints locally
import { createEnv } from './api/lib/storage.js';
import { generatePIN } from './api/lib/helpers.js';
import { createOptimizedRoute } from './api/lib/routing.js';

async function testAPI() {
  console.log('🧪 Testing API Components...\n');
  
  // Test 1: Storage
  console.log('1️⃣ Testing Storage Layer...');
  const env = createEnv();
  await env.KV_CACHE.put('test-key', 'test-value', { expirationTtl: 60 });
  const value = await env.KV_CACHE.get('test-key');
  console.log(`   ✅ Storage: ${value === 'test-value' ? 'PASS' : 'FAIL'}`);
  
  // Test 2: PIN Generation
  console.log('\n2️⃣ Testing PIN Generation...');
  const pin = generatePIN();
  console.log(`   ✅ PIN Generated: ${pin} (${pin.length === 2 ? 'PASS' : 'FAIL'})`);
  
  // Test 3: Dynamic Routing
  console.log('\n3️⃣ Testing Dynamic Routing...');
  try {
    const route = await createOptimizedRoute('recruitment', 'male');
    console.log(`   ✅ Route Created: ${route.stations.length} stations`);
    console.log(`   ✅ First Station: ${route.stations[0].name}`);
    console.log(`   ✅ Optimization: ${route.optimizedPath.length > 0 ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`   ❌ Route Error: ${error.message}`);
  }
  
  console.log('\n✅ All Tests Completed!');
}

testAPI().catch(console.error);
