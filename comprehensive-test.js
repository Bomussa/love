import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM5MzY1NiwiZXhwIjoyMDc3OTY5NjU2fQ.9zW2vSi5JX-KOJHUxuh-GGtLXZ-fLu5lhXjkxwv41Jg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function comprehensiveTest() {
  console.log('🧪 Comprehensive Database Test\n');
  console.log('=' .repeat(60) + '\n');
  
  const testPatientId = 'test-comprehensive-' + Date.now();
  
  try {
    // ========================================
    // TEST 1: Create a test patient
    // ========================================
    console.log('📝 TEST 1: Creating test patient...');
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert([{
        id: testPatientId,
        gender: 'male'
      }])
      .select()
      .single();
    
    if (patientError) {
      console.error('❌ Failed to create patient:', patientError);
      return;
    }
    
    console.log('✅ Patient created successfully!');
    console.log('   Patient ID:', patient.id);
    console.log('   Columns:', Object.keys(patient).join(', '));
    
    // ========================================
    // TEST 2: Create a pathway for the patient
    // ========================================
    console.log('\n📝 TEST 2: Creating pathway...');
    const pathway = ['lab', 'radiology', 'vitals', 'internal'];
    
    const { data: pathwayData, error: pathwayError } = await supabase
      .from('pathways')
      .insert([{
        patient_id: testPatientId,
        gender: 'male',
        pathway: pathway,
        current_step: 0,
        completed: false
      }])
      .select()
      .single();
    
    if (pathwayError) {
      console.error('❌ Failed to create pathway:', pathwayError);
    } else {
      console.log('✅ Pathway created successfully!');
      console.log('   Pathway:', pathwayData.pathway);
    }
    
    // ========================================
    // TEST 3: Add patient to queue
    // ========================================
    console.log('\n📝 TEST 3: Adding patient to queue...');
    const { data: queueData, error: queueError } = await supabase
      .from('queues')
      .insert([{
        clinic_id: 'lab',
        patient_id: testPatientId,
        display_number: 1,
        status: 'waiting'
      }])
      .select()
      .single();
    
    if (queueError) {
      console.error('❌ Failed to add to queue:', queueError);
      console.log('   Error details:', JSON.stringify(queueError, null, 2));
    } else {
      console.log('✅ Added to queue successfully!');
      console.log('   Queue entry:', queueData);
      console.log('   Columns:', Object.keys(queueData).join(', '));
    }
    
    // ========================================
    // TEST 4: Query queue status
    // ========================================
    console.log('\n📝 TEST 4: Querying queue status...');
    const { data: queueStatus, error: statusError } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', 'lab')
      .eq('status', 'waiting');
    
    if (statusError) {
      console.error('❌ Failed to query queue:', statusError);
    } else {
      console.log('✅ Queue query successful!');
      console.log('   Waiting in lab:', queueStatus.length);
    }
    
    // ========================================
    // TEST 5: Create a notification
    // ========================================
    console.log('\n📝 TEST 5: Creating notification...');
    const { data: notifData, error: notifError } = await supabase
      .from('notifications')
      .insert([{
        patient_id: testPatientId,
        message: 'Test notification',
        type: 'info',
        read: false
      }])
      .select()
      .single();
    
    if (notifError) {
      console.error('❌ Failed to create notification:', notifError);
    } else {
      console.log('✅ Notification created successfully!');
      console.log('   Message:', notifData.message);
    }
    
    // ========================================
    // CLEANUP: Delete all test data
    // ========================================
    console.log('\n🗑️  CLEANUP: Removing test data...');
    
    // Delete notification
    await supabase.from('notifications').delete().eq('patient_id', testPatientId);
    console.log('   ✓ Deleted notifications');
    
    // Delete queue entry
    await supabase.from('queues').delete().eq('patient_id', testPatientId);
    console.log('   ✓ Deleted queue entries');
    
    // Delete pathway
    await supabase.from('pathways').delete().eq('patient_id', testPatientId);
    console.log('   ✓ Deleted pathways');
    
    // Delete patient
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log('   ✓ Deleted patient');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

comprehensiveTest();
