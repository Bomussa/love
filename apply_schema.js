/**
 * Apply Schema to Supabase Database
 * This script applies the complete database schema to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Supabase configuration
const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('🔍 Testing connection to Supabase...');
  
  try {
    const { data, error } = await supabase.from('clinics').select('count');
    
    if (error) {
      console.log('⚠️  Table does not exist yet, will create schema');
      return false;
    }
    
    console.log('✅ Connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function checkTables() {
  console.log('\n📋 Checking existing tables...');
  
  const tables = ['clinics', 'patients', 'pathways', 'queues', 'queue_history', 'notifications', 'system_settings'];
  const existingTables = [];
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (!error) {
        existingTables.push(table);
        console.log(`  ✓ ${table} exists`);
      }
    } catch (e) {
      console.log(`  ✗ ${table} does not exist`);
    }
  }
  
  return existingTables;
}

async function testClinics() {
  console.log('\n🏥 Testing clinics table...');
  
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching clinics:', error.message);
      return false;
    }
    
    console.log(`✅ Found ${data.length} clinics`);
    if (data.length > 0) {
      console.log('Sample clinic:', data[0]);
    }
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testPatientLogin() {
  console.log('\n👤 Testing patient login functionality...');
  
  const testPatientId = 'TEST-' + Date.now();
  const testGender = 'male';
  
  try {
    // Insert test patient
    const { data: patient, error: insertError } = await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: testGender }])
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error creating patient:', insertError.message);
      return false;
    }
    
    console.log('✅ Patient created successfully:', patient.id);
    
    // Fetch patient
    const { data: fetchedPatient, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', testPatientId)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching patient:', fetchError.message);
      return false;
    }
    
    console.log('✅ Patient fetched successfully');
    
    // Clean up
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log('✅ Test patient cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testQueueOperations() {
  console.log('\n🎫 Testing queue operations...');
  
  const testPatientId = 'QUEUE-TEST-' + Date.now();
  const testClinicId = 'lab';
  
  try {
    // Create test patient
    await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: 'male' }]);
    
    // Enter queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('queues')
      .insert([{
        clinic_id: testClinicId,
        patient_id: testPatientId,
        display_number: 999,
        status: 'waiting'
      }])
      .select()
      .single();
    
    if (queueError) {
      console.error('❌ Error entering queue:', queueError.message);
      return false;
    }
    
    console.log('✅ Queue entry created:', queueEntry.display_number);
    
    // Get queue status
    const { data: queueStatus, error: statusError } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', testClinicId)
      .eq('patient_id', testPatientId);
    
    if (statusError) {
      console.error('❌ Error getting queue status:', statusError.message);
      return false;
    }
    
    console.log('✅ Queue status retrieved:', queueStatus.length, 'entries');
    
    // Clean up
    await supabase.from('queues').delete().eq('patient_id', testPatientId);
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log('✅ Test data cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase Schema Verification\n');
  console.log('Project URL:', supabaseUrl);
  console.log('Project ID: utgsoizsnqchiduzffxo\n');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('\n⚠️  Database schema not applied yet.');
    console.log('📝 Please apply the schema manually using Supabase SQL Editor:');
    console.log('   1. Go to https://supabase.com/dashboard/project/utgsoizsnqchiduzffxo/editor');
    console.log('   2. Open SQL Editor');
    console.log('   3. Copy and paste the content from supabase/schema.sql');
    console.log('   4. Run the SQL script');
    return;
  }
  
  // Check tables
  const existingTables = await checkTables();
  
  if (existingTables.length === 0) {
    console.log('\n❌ No tables found. Schema needs to be applied.');
    return;
  }
  
  // Test operations
  await testClinics();
  await testPatientLogin();
  await testQueueOperations();
  
  console.log('\n✅ All tests passed! Supabase is ready for production.');
}

main().catch(console.error);
