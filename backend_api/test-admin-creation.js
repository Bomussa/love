import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Simple password hashing function
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

async function testAdminCreation() {
  console.log('=== Testing Admin Creation ===\n');

  try {
    // 1. Check existing admins
    const { data: existingAdmins } = await supabase
      .from('admins')
      .select('id, username, role, is_active');

    console.log(`✅ Found ${existingAdmins?.length || 0} existing admins:`);
    existingAdmins?.forEach(admin => {
      console.log(`   - ${admin.username} (${admin.role}) - Active: ${admin.is_active}`);
    });

    // 2. Create a new admin
    const testAdmin = {
      username: `admin_test_${Date.now()}`,
      password: 'TestPassword123!',
      role: 'admin',
      permissions: ['read', 'write', 'delete'],
      is_active: true
    };

    console.log(`\n📝 Creating new admin: ${testAdmin.username}`);

    const { data: newAdmin, error: createError } = await supabase
      .from('admins')
      .insert({
        username: testAdmin.username,
        password_hash: hashPassword(testAdmin.password),
        role: testAdmin.role,
        is_active: testAdmin.is_active,
        full_name: `Test Admin ${Date.now()}`,
        email: `${testAdmin.username}@mmc-mms.com`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating admin:', createError);
      return;
    }

    console.log(`✅ Admin created successfully:`);
    console.log(`   - ID: ${newAdmin.id}`);
    console.log(`   - Username: ${newAdmin.username}`);
    console.log(`   - Role: ${newAdmin.role}`);
    console.log(`   - Permissions: ${JSON.stringify(newAdmin.permissions)}`);

    // 3. Verify admin can be retrieved
    const { data: retrievedAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('username', testAdmin.username)
      .maybeSingle();

    if (retrievedAdmin) {
      console.log(`\n✅ Admin retrieved successfully from database`);
      console.log(`   - Username: ${retrievedAdmin.username}`);
      console.log(`   - Role: ${retrievedAdmin.role}`);
      console.log(`   - Is Active: ${retrievedAdmin.is_active}`);
    } else {
      console.error('❌ Failed to retrieve admin from database');
    }

    console.log('\n✅ Admin creation test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAdminCreation();
