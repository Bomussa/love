import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM5MzY1NiwiZXhwIjoyMDc3OTY5NjU2fQ.9zW2vSi5JX-KOJHUxuh-GGtLXZ-fLu5lhXjkxwv41Jg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllTables() {
  console.log('🔍 Fetching all tables from Supabase...\n');
  
  try {
    // Using service role key to query pg_catalog
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          table_name,
          table_schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `
    });
    
    if (error) {
      console.log('⚠️  RPC method not available. Trying alternative method...\n');
      
      // Try common table names
      const commonTables = [
        'patients',
        'clinics', 
        'queues',
        'queue_entries',
        'exam_types',
        'exams',
        'pathways',
        'routes',
        'pins',
        'admin_users',
        'notifications',
        'settings',
        'logs',
        'events'
      ];
      
      console.log('📋 Testing common table names:\n');
      
      for (const tableName of commonTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!error) {
            console.log(`✅ ${tableName} - EXISTS`);
            if (data && data.length > 0) {
              console.log(`   Columns:`, Object.keys(data[0]).join(', '));
            }
          } else if (error.code === 'PGRST205') {
            console.log(`❌ ${tableName} - NOT FOUND`);
          } else {
            console.log(`⚠️  ${tableName} - ERROR: ${error.message}`);
          }
        } catch (e) {
          console.log(`⚠️  ${tableName} - EXCEPTION: ${e.message}`);
        }
      }
    } else {
      console.log('✅ Tables found:', data);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

listAllTables();
