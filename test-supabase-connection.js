import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  
  try {
    // Test 1: List all tables
    console.log('📋 Test 1: Fetching database schema...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.log('⚠️  Could not fetch schema (this is normal for security reasons)');
    } else {
      console.log('✅ Tables found:', tables);
    }
    
    // Test 2: Check patients table
    console.log('\n📋 Test 2: Checking patients table...');
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .limit(5);
    
    if (patientsError) {
      console.error('❌ Patients table error:', patientsError);
    } else {
      console.log('✅ Patients table accessible. Sample count:', patients?.length || 0);
      if (patients && patients.length > 0) {
        console.log('   Sample data:', patients[0]);
      }
    }
    
    // Test 3: Check clinics table
    console.log('\n📋 Test 3: Checking clinics table...');
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('*')
      .limit(5);
    
    if (clinicsError) {
      console.error('❌ Clinics table error:', clinicsError);
    } else {
      console.log('✅ Clinics table accessible. Count:', clinics?.length || 0);
      if (clinics && clinics.length > 0) {
        console.log('   Sample clinic:', clinics[0]);
      }
    }
    
    // Test 4: Check queue_entries table
    console.log('\n📋 Test 4: Checking queue_entries table...');
    const { data: queue, error: queueError } = await supabase
      .from('queue_entries')
      .select('*')
      .limit(5);
    
    if (queueError) {
      console.error('❌ Queue entries table error:', queueError);
    } else {
      console.log('✅ Queue entries table accessible. Count:', queue?.length || 0);
    }
    
    // Test 5: Check exam_types table
    console.log('\n📋 Test 5: Checking exam_types table...');
    const { data: exams, error: examsError } = await supabase
      .from('exam_types')
      .select('*')
      .limit(5);
    
    if (examsError) {
      console.error('❌ Exam types table error:', examsError);
    } else {
      console.log('✅ Exam types table accessible. Count:', exams?.length || 0);
      if (exams && exams.length > 0) {
        console.log('   Sample exam type:', exams[0]);
      }
    }
    
    console.log('\n✅ Supabase connection test completed!');
    
  } catch (error) {
    console.error('\n❌ Fatal error during connection test:', error);
  }
}

testSupabaseConnection();
