/**
 * اختبار شامل للتكامل بين Frontend و Backend
 */

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10"
const API_BASE = "https://rujwuruuosffcxazymit.supabase.co/functions/v1"

async function testFunction(name, path, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(`${API_BASE}${path}`, options)
    const data = await response.text()
    
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = data
    }
    
    const status = response.ok ? '✅' : '❌'
    console.log(`${status} ${name}: ${response.status}`)
    
    if (!response.ok) {
      console.log(`   Error: ${JSON.stringify(parsed).substring(0, 100)}`)
    }
    
    return { ok: response.ok, data: parsed }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`)
    return { ok: false, error: error.message }
  }
}

async function runTests() {
  console.log('='.repeat(60))
  console.log('اختبار التكامل بين Frontend و Backend')
  console.log('='.repeat(60))
  console.log('')
  
  // 1. Health Check
  console.log('1️⃣  Infrastructure Tests')
  await testFunction('Health Check', '/health')
  console.log('')
  
  // 2. Queue APIs
  console.log('2️⃣  Queue Management APIs')
  await testFunction('Queue Status', '/queue-status?clinic=general')
  await testFunction('Queue Enter', '/queue-enter', 'POST', {
    clinic: 'general',
    user: 'test-patient-001',
    isAutoEntry: false
  })
  await testFunction('Queue Position', '/queue-position?clinic=general&user=test-patient-001')
  console.log('')
  
  // 3. PIN APIs
  console.log('3️⃣  PIN Management APIs')
  await testFunction('PIN Status', '/pin-status')
  await testFunction('PIN Generate', '/pin-generate', 'POST', {
    clinic: 'general',
    adminId: 'admin-001'
  })
  console.log('')
  
  // 4. Patient APIs
  console.log('4️⃣  Patient APIs')
  await testFunction('Patient Login', '/patient-login', 'POST', {
    patientId: 'P12345',
    gender: 'male'
  })
  console.log('')
  
  // 5. Admin APIs
  console.log('5️⃣  Admin APIs')
  await testFunction('Admin Status', '/admin-status?clinic=general')
  await testFunction('Queue Call', '/queue-call', 'POST', {
    clinic: 'general'
  })
  console.log('')
  
  // 6. Route APIs
  console.log('6️⃣  Route Management APIs')
  await testFunction('Route Create', '/route-create', 'POST', {
    patientId: 'P12345',
    clinics: ['general', 'specialist']
  })
  await testFunction('Route Get', '/route-get?patientId=P12345')
  console.log('')
  
  // 7. Stats APIs
  console.log('7️⃣  Statistics APIs')
  await testFunction('Stats Dashboard', '/stats-dashboard')
  await testFunction('Stats Queues', '/stats-queues')
  console.log('')
  
  console.log('='.repeat(60))
  console.log('اكتمل الاختبار')
  console.log('='.repeat(60))
}

runTests().catch(console.error)
