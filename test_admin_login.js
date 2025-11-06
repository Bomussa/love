import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testLogin() {
  console.log('🔍 Testing admin login with username: bomussa, password: 14490')
  
  try {
    // Test 1: Check if table exists and has data
    console.log('\n📋 Test 1: Fetching all admin users...')
    const { data: allUsers, error: allError } = await supabase
      .from('admin_users')
      .select('*')
    
    if (allError) {
      console.error('❌ Error fetching all users:', allError)
      return
    }
    
    console.log(`✅ Found ${allUsers.length} admin users:`)
    allUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.role}) - active: ${user.is_active}`)
    })
    
    // Test 2: Try to login with bomussa
    console.log('\n🔐 Test 2: Attempting login with bomussa/14490...')
    const { data: user, error: loginError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', 'bomussa')
      .eq('is_active', true)
      .single()
    
    if (loginError) {
      console.error('❌ Login error:', loginError)
      return
    }
    
    if (!user) {
      console.error('❌ User not found')
      return
    }
    
    console.log('✅ User found:', user.username, user.role)
    console.log('🔑 Password in DB:', user.password)
    console.log('🔑 Password provided: 14490')
    console.log('🔍 Passwords match:', user.password === '14490')
    
    if (user.password === '14490') {
      console.log('\n✅✅✅ LOGIN SUCCESSFUL! ✅✅✅')
    } else {
      console.log('\n❌ PASSWORD MISMATCH!')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testLogin()
