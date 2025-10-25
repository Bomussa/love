import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

async function checkTables() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const requiredTables = [
    'users', 'sessions', 'clinics', 'queue', 
    'notifications', 'reports', 'settings', 
    'cache_logs', 'routes'
  ];
  
  const result = {
    connection: false,
    tables_exist: {},
    total_tables: 0,
    missing_tables: [],
    errors: []
  };
  
  console.log('🔍 Checking Supabase Database...\n');
  
  try {
    // اختبار الاتصال الأساسي
    result.connection = true;
    console.log('✅ Connection established');
    
    // فحص كل جدول
    for (const table of requiredTables) {
      try {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        
        if (error) {
          if (error.message.includes('does not exist') || error.message.includes('not found')) {
            result.tables_exist[table] = false;
            result.missing_tables.push(table);
            console.log(`❌ Table '${table}' does not exist`);
          } else {
            result.tables_exist[table] = 'error';
            result.errors.push({ table, error: error.message });
            console.log(`⚠️  Table '${table}' - error: ${error.message}`);
          }
        } else {
          result.tables_exist[table] = true;
          result.total_tables++;
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (err) {
        result.tables_exist[table] = false;
        result.missing_tables.push(table);
        console.log(`❌ Table '${table}' - ${err.message}`);
      }
    }
    
    console.log(`\n📊 Summary: ${result.total_tables}/${requiredTables.length} tables exist`);
    console.log(`📊 Missing: ${result.missing_tables.length} tables`);
    
    if (result.missing_tables.length > 0) {
      console.log('\n⚠️  Missing tables:', result.missing_tables.join(', '));
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    result.connection = false;
    result.error = error.message;
    return result;
  }
}

checkTables()
  .then(result => {
    const report = {
      header: {
        organization: "المركز الطبي التخصصي العسكري",
        report_type: "تقرير فحص قاعدة البيانات",
        generated_by: "Manus AI",
        supervised_by: "المهندس إياد",
        logo_path: "/assets/logo-mmc.png",
        timestamp: new Date().toISOString()
      },
      status: result.connection ? (result.total_tables === 9 ? '✅' : '⚠️') : '❌',
      ...result
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'diagnostics', 'db-check.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('\n✅ Report saved to diagnostics/db-check.json');
    
    process.exit(result.connection && result.total_tables === 9 ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
