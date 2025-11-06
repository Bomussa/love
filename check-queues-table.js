import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkQueuesTable() {
  console.log('🔍 Checking queues table structure...\n');
  
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('✅ Queues table accessible');
    console.log('📊 Record count:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('\n📋 Columns:', Object.keys(data[0]).join(', '));
      console.log('\n📝 Sample records:');
      data.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`, JSON.stringify(record, null, 2));
      });
    } else {
      console.log('\n⚠️  Table is empty');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkQueuesTable();
