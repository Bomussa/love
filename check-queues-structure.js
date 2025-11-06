import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM5MzY1NiwiZXhwIjoyMDc3OTY5NjU2fQ.9zW2vSi5JX-KOJHUxuh-GGtLXZ-fLu5lhXjkxwv41Jg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkQueuesStructure() {
  console.log('🔍 Testing queues table operations...\n');
  
  try {
    // Test 1: Insert a test record
    console.log('📝 Test 1: Inserting test record...');
    const testRecord = {
      clinic_id: 'lab',
      patient_id: 'test-patient-001',
      display_number: 1,
      status: 'waiting'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('queues')
      .insert([testRecord])
      .select();
    
    if (insertError) {
      console.error('❌ Insert error:', insertError);
      console.log('\n💡 This tells us about the table structure!');
      console.log('   Expected columns might be different.');
    } else {
      console.log('✅ Insert successful!');
      console.log('   Inserted data:', insertData);
      
      // Test 2: Read the record
      console.log('\n📖 Test 2: Reading test record...');
      const { data: readData, error: readError } = await supabase
        .from('queues')
        .select('*')
        .eq('patient_id', 'test-patient-001');
      
      if (readError) {
        console.error('❌ Read error:', readError);
      } else {
        console.log('✅ Read successful!');
        console.log('   Data:', readData);
        console.log('   Columns:', Object.keys(readData[0] || {}));
      }
      
      // Test 3: Delete the test record
      console.log('\n🗑️  Test 3: Cleaning up test record...');
      const { error: deleteError } = await supabase
        .from('queues')
        .delete()
        .eq('patient_id', 'test-patient-001');
      
      if (deleteError) {
        console.error('❌ Delete error:', deleteError);
      } else {
        console.log('✅ Cleanup successful!');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkQueuesStructure();
