import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAdminsSchema() {
  console.log('=== Checking Admins Table Schema ===\n');

  try {
    // Get one admin record to see what columns exist
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .limit(1)
      .single();

    if (admin) {
      console.log('✅ Admin record found:');
      console.log(JSON.stringify(admin, null, 2));
      
      console.log('\n📊 Available columns:');
      Object.keys(admin).forEach(key => {
        console.log(`   - ${key}: ${typeof admin[key]}`);
      });
    } else {
      console.log('⚠️  No admin records found');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAdminsSchema();
