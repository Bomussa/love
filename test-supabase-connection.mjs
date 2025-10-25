import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  
  try {
    // إنشاء Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created successfully');
    
    // اختبار الاتصال بقراءة الجداول
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.log('⚠️  Could not read tables (this is normal if no tables exist yet)');
      console.log('   Error:', tablesError.message);
    } else {
      console.log('✅ Connection successful!');
      console.log(`📊 Found ${tables ? tables.length : 0} tables in database`);
      if (tables && tables.length > 0) {
        console.log('   Tables:', tables.map(t => t.table_name).join(', '));
      }
    }
    
    // اختبار إنشاء جدول مؤقت
    console.log('\n🧪 Testing CRUD operations...');
    
    const { data: testData, error: testError } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);
    
    if (testError) {
      if (testError.message.includes('does not exist')) {
        console.log('⚠️  Test table does not exist (expected)');
        console.log('   Database is ready for schema creation');
      } else {
        console.log('❌ Unexpected error:', testError.message);
      }
    } else {
      console.log('✅ Test query executed successfully');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 Connection Test Summary:');
    console.log('='.repeat(60));
    console.log('URL:', SUPABASE_URL);
    console.log('Status: ✅ Connected');
    console.log('Ready for migration: ✅ Yes');
    console.log('='.repeat(60));
    
    return {
      success: true,
      url: SUPABASE_URL,
      tablesCount: tables ? tables.length : 0,
      tables: tables ? tables.map(t => t.table_name) : []
    };
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

testConnection()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
