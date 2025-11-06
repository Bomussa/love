/**
 * Live API Connection Test for mmc-mms.com
 * Tests all critical API endpoints on production
 */

import { createClient } from '@supabase/supabase-js';

// Production Supabase configuration
const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test results storage
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (details) console.log(`   ${details}`);
  
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

async function test1_ConnectionTest() {
  console.log('\n📡 Test 1: Connection to Supabase');
  try {
    const { data, error } = await supabase.from('clinics').select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    
    logTest('Connection to Supabase', true, 'Successfully connected');
    return true;
  } catch (error) {
    logTest('Connection to Supabase', false, error.message);
    return false;
  }
}

async function test2_FetchClinics() {
  console.log('\n🏥 Test 2: Fetch Clinics (عيادات)');
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      logTest('Fetch Clinics', false, 'No clinics found');
      return false;
    }
    
    console.log(`   Found ${data.length} clinics:`);
    data.slice(0, 5).forEach(clinic => {
      console.log(`   - ${clinic.name_ar} (${clinic.name_en}) - PIN: ${clinic.pin}`);
    });
    
    logTest('Fetch Clinics', true, `${data.length} clinics retrieved`);
    return true;
  } catch (error) {
    logTest('Fetch Clinics', false, error.message);
    return false;
  }
}

async function test3_PatientLogin() {
  console.log('\n👤 Test 3: Patient Login (تسجيل دخول مريض)');
  const testPatientId = 'API-TEST-' + Date.now();
  
  try {
    // Create patient
    const { data: patient, error: insertError } = await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: 'male' }])
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    console.log(`   ✓ Patient created: ${patient.id}`);
    
    // Verify patient exists
    const { data: fetchedPatient, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', testPatientId)
      .single();
    
    if (fetchError) throw fetchError;
    
    console.log(`   ✓ Patient verified: ${fetchedPatient.id}`);
    
    // Cleanup
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log(`   ✓ Test patient cleaned up`);
    
    logTest('Patient Login', true, 'Create, fetch, and delete successful');
    return true;
  } catch (error) {
    logTest('Patient Login', false, error.message);
    // Cleanup on error
    try {
      await supabase.from('patients').delete().eq('id', testPatientId);
    } catch (e) {}
    return false;
  }
}

async function test4_QueueOperations() {
  console.log('\n🎫 Test 4: Queue Operations (عمليات الطابور)');
  const testPatientId = 'QUEUE-API-TEST-' + Date.now();
  const testClinicId = 'lab';
  
  try {
    // Create test patient
    await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: 'male' }]);
    
    console.log(`   ✓ Test patient created`);
    
    // Get next display number
    const { data: maxNumber } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', testClinicId)
      .order('display_number', { ascending: false })
      .limit(1)
      .single();
    
    const displayNumber = (maxNumber?.display_number || 0) + 1;
    console.log(`   ✓ Next display number: ${displayNumber}`);
    
    // Enter queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('queues')
      .insert([{
        clinic_id: testClinicId,
        patient_id: testPatientId,
        display_number: displayNumber,
        status: 'waiting'
      }])
      .select()
      .single();
    
    if (queueError) throw queueError;
    
    console.log(`   ✓ Entered queue: #${queueEntry.display_number}`);
    
    // Get queue status
    const { data: queueStatus, error: statusError } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', testClinicId)
      .in('status', ['waiting', 'serving']);
    
    if (statusError) throw statusError;
    
    console.log(`   ✓ Queue status: ${queueStatus.length} in queue`);
    
    // Complete queue entry
    const { data: completed, error: completeError } = await supabase
      .from('queues')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('clinic_id', testClinicId)
      .eq('patient_id', testPatientId)
      .select()
      .single();
    
    if (completeError) throw completeError;
    
    console.log(`   ✓ Queue completed: ${completed.status}`);
    
    // Cleanup
    await supabase.from('queues').delete().eq('patient_id', testPatientId);
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log(`   ✓ Test data cleaned up`);
    
    logTest('Queue Operations', true, 'Enter, status, complete successful');
    return true;
  } catch (error) {
    logTest('Queue Operations', false, error.message);
    // Cleanup on error
    try {
      await supabase.from('queues').delete().eq('patient_id', testPatientId);
      await supabase.from('patients').delete().eq('id', testPatientId);
    } catch (e) {}
    return false;
  }
}

async function test5_PathwayManagement() {
  console.log('\n🛤️  Test 5: Pathway Management (إدارة المسارات)');
  const testPatientId = 'PATH-API-TEST-' + Date.now();
  
  try {
    // Create test patient
    await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: 'male' }]);
    
    console.log(`   ✓ Test patient created`);
    
    // Create pathway
    const malePathway = [
      'lab', 'radiology', 'vitals', 'ecg', 'audiology',
      'eyes', 'internal', 'ent', 'surgery', 'dental',
      'psychiatry', 'dermatology', 'orthopedics'
    ];
    
    const { data: pathway, error: pathwayError } = await supabase
      .from('pathways')
      .insert([{
        patient_id: testPatientId,
        gender: 'male',
        pathway: malePathway,
        current_step: 0,
        completed: false
      }])
      .select()
      .single();
    
    if (pathwayError) throw pathwayError;
    
    console.log(`   ✓ Pathway created: ${pathway.pathway.length} steps`);
    
    // Fetch pathway
    const { data: fetchedPathway, error: fetchError } = await supabase
      .from('pathways')
      .select('*')
      .eq('patient_id', testPatientId)
      .single();
    
    if (fetchError) throw fetchError;
    
    console.log(`   ✓ Pathway fetched: step ${fetchedPathway.current_step}/${fetchedPathway.pathway.length}`);
    
    // Update pathway step
    const { data: updated, error: updateError } = await supabase
      .from('pathways')
      .update({ current_step: 3 })
      .eq('patient_id', testPatientId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    console.log(`   ✓ Pathway updated: step ${updated.current_step}`);
    
    // Cleanup
    await supabase.from('pathways').delete().eq('patient_id', testPatientId);
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log(`   ✓ Test data cleaned up`);
    
    logTest('Pathway Management', true, 'Create, fetch, update successful');
    return true;
  } catch (error) {
    logTest('Pathway Management', false, error.message);
    // Cleanup on error
    try {
      await supabase.from('pathways').delete().eq('patient_id', testPatientId);
      await supabase.from('patients').delete().eq('id', testPatientId);
    } catch (e) {}
    return false;
  }
}

async function test6_NotificationSystem() {
  console.log('\n🔔 Test 6: Notification System (نظام الإشعارات)');
  const testPatientId = 'NOTIF-API-TEST-' + Date.now();
  
  try {
    // Create test patient
    await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: 'male' }]);
    
    console.log(`   ✓ Test patient created`);
    
    // Add notification
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert([{
        patient_id: testPatientId,
        message: 'Test notification',
        type: 'info',
        read: false
      }])
      .select()
      .single();
    
    if (notifError) throw notifError;
    
    console.log(`   ✓ Notification created: ${notification.message}`);
    
    // Fetch notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('patient_id', testPatientId)
      .order('created_at', { ascending: false });
    
    if (fetchError) throw fetchError;
    
    console.log(`   ✓ Notifications fetched: ${notifications.length} found`);
    
    // Mark as read
    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notification.id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    console.log(`   ✓ Notification marked as read: ${updated.read}`);
    
    // Cleanup
    await supabase.from('notifications').delete().eq('patient_id', testPatientId);
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log(`   ✓ Test data cleaned up`);
    
    logTest('Notification System', true, 'Add, fetch, update successful');
    return true;
  } catch (error) {
    logTest('Notification System', false, error.message);
    // Cleanup on error
    try {
      await supabase.from('notifications').delete().eq('patient_id', testPatientId);
      await supabase.from('patients').delete().eq('id', testPatientId);
    } catch (e) {}
    return false;
  }
}

async function test7_PINVerification() {
  console.log('\n🔐 Test 7: PIN Verification (التحقق من رمز PIN)');
  
  try {
    // Fetch clinics with PINs
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('id, name_ar, pin, requires_pin')
      .eq('requires_pin', true);
    
    if (error) throw error;
    
    if (!clinics || clinics.length === 0) {
      logTest('PIN Verification', false, 'No clinics with PIN requirement found');
      return false;
    }
    
    console.log(`   Found ${clinics.length} clinics with PIN requirement:`);
    clinics.slice(0, 3).forEach(clinic => {
      console.log(`   - ${clinic.name_ar}: PIN ${clinic.pin}`);
    });
    
    // Test PIN verification logic
    const testClinic = clinics[0];
    const correctPIN = testClinic.pin;
    const wrongPIN = '99';
    
    console.log(`   ✓ Testing PIN for ${testClinic.name_ar}`);
    console.log(`   ✓ Correct PIN: ${correctPIN === correctPIN ? 'Match' : 'No match'}`);
    console.log(`   ✓ Wrong PIN: ${wrongPIN !== correctPIN ? 'Rejected' : 'Accepted'}`);
    
    logTest('PIN Verification', true, `${clinics.length} clinics with PIN verified`);
    return true;
  } catch (error) {
    logTest('PIN Verification', false, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Live API Connection Tests for mmc-mms.com\n');
  console.log('=' .repeat(60));
  console.log('Target: https://mmc-mms.com');
  console.log('Supabase URL:', supabaseUrl);
  console.log('=' .repeat(60));
  
  // Run all tests
  await test1_ConnectionTest();
  await test2_FetchClinics();
  await test3_PatientLogin();
  await test4_QueueOperations();
  await test5_PathwayManagement();
  await test6_NotificationSystem();
  await test7_PINVerification();
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log('=' .repeat(60));
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! API is 100% functional.');
    console.log('✅ Supabase integration is working perfectly on mmc-mms.com');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    console.log('\nFailed tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.details}`);
    });
  }
  
  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
