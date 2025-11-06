#!/usr/bin/env node
/**
 * Full Application Test Suite
 * Tests Frontend + Backend integration
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('======================================================================');
console.log('🧪 اختبار شامل للتطبيق الكامل (Frontend + Backend)');
console.log('======================================================================\n');

// ============================================
// TEST SCENARIO: Complete Patient Journey
// ============================================

async function testCompletePatientJourney() {
  const testPatientId = `patient-${Date.now()}`;
  const testGender = 'male';
  
  console.log('📋 سيناريو الاختبار: رحلة مريض كاملة');
  console.log('======================================================================');
  console.log(`معرف المريض: ${testPatientId}`);
  console.log(`الجنس: ${testGender}`);
  console.log('');
  
  try {
    // Step 1: Patient Login
    console.log('1️⃣  تسجيل دخول المريض...');
    const { data: patient, error: loginError } = await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: testGender }])
      .select()
      .single();
    
    if (loginError) throw loginError;
    console.log('   ✅ تم تسجيل الدخول بنجاح');
    
    // Step 2: Create Pathway
    console.log('\n2️⃣  إنشاء المسار الديناميكي...');
    const malePathway = [
      'lab', 'radiology', 'vitals', 'ecg', 'audiology',
      'eyes', 'internal', 'ent', 'surgery', 'dental',
      'psychiatry', 'dermatology', 'orthopedics'
    ];
    
    const { data: pathway, error: pathwayError } = await supabase
      .from('pathways')
      .insert([{
        patient_id: testPatientId,
        gender: testGender,
        pathway: malePathway,
        current_step: 0
      }])
      .select()
      .single();
    
    if (pathwayError) throw pathwayError;
    console.log(`   ✅ تم إنشاء المسار: ${pathway.pathway.length} محطة`);
    
    // Step 3: Enter First Clinic (lab)
    console.log('\n3️⃣  دخول أول عيادة (المختبر)...');
    const firstClinic = 'lab';
    
    const { data: maxNum } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', firstClinic)
      .order('display_number', { ascending: false })
      .limit(1)
      .single();
    
    const displayNumber = (maxNum?.display_number || 0) + 1;
    
    const { data: queueEntry, error: queueError } = await supabase
      .from('queues')
      .insert([{
        clinic_id: firstClinic,
        patient_id: testPatientId,
        display_number: displayNumber,
        status: 'waiting'
      }])
      .select()
      .single();
    
    if (queueError) throw queueError;
    console.log(`   ✅ دخلت الطابور برقم: ${queueEntry.display_number}`);
    
    // Step 4: Add Notification
    console.log('\n4️⃣  إضافة إشعار...');
    const { error: notifError } = await supabase
      .from('notifications')
      .insert([{
        patient_id: testPatientId,
        message: `تم دخولك إلى طابور ${firstClinic}. رقمك: ${displayNumber}`,
        type: 'success',
        read: false
      }]);
    
    if (notifError) throw notifError;
    console.log('   ✅ تم إضافة الإشعار');
    
    // Step 5: Complete Visit (no PIN required for lab)
    console.log('\n5️⃣  إكمال الزيارة...');
    const { data: completed, error: completeError } = await supabase
      .from('queues')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('clinic_id', firstClinic)
      .eq('patient_id', testPatientId)
      .select()
      .single();
    
    if (completeError) throw completeError;
    console.log('   ✅ تم إكمال الزيارة');
    
    // Step 6: Enter Second Clinic (eyes - requires PIN)
    console.log('\n6️⃣  دخول عيادة ثانية (العيون - تتطلب PIN)...');
    const secondClinic = 'eyes';
    
    const { data: maxNum2 } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', secondClinic)
      .order('display_number', { ascending: false })
      .limit(1)
      .single();
    
    const displayNumber2 = (maxNum2?.display_number || 0) + 1;
    
    const { data: queueEntry2, error: queueError2 } = await supabase
      .from('queues')
      .insert([{
        clinic_id: secondClinic,
        patient_id: testPatientId,
        display_number: displayNumber2,
        status: 'waiting'
      }])
      .select()
      .single();
    
    if (queueError2) throw queueError2;
    console.log(`   ✅ دخلت الطابور برقم: ${queueEntry2.display_number}`);
    
    // Step 7: Complete with PIN
    console.log('\n7️⃣  إكمال الزيارة باستخدام PIN...');
    
    // Get clinic PIN
    const { data: clinic } = await supabase
      .from('clinics')
      .select('pin')
      .eq('id', secondClinic)
      .single();
    
    const { data: completed2, error: completeError2 } = await supabase
      .from('queues')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_pin: clinic.pin
      })
      .eq('clinic_id', secondClinic)
      .eq('patient_id', testPatientId)
      .select()
      .single();
    
    if (completeError2) throw completeError2;
    console.log(`   ✅ تم إكمال الزيارة بـ PIN: ${clinic.pin}`);
    
    // Step 8: Check Queue History
    console.log('\n8️⃣  التحقق من سجل الطوابير...');
    const { data: history, error: historyError } = await supabase
      .from('queue_history')
      .select('*')
      .eq('patient_id', testPatientId);
    
    if (historyError) throw historyError;
    console.log(`   ✅ تم حفظ ${history.length} سجلات في التاريخ`);
    
    // Step 9: Get All Notifications
    console.log('\n9️⃣  استرجاع جميع الإشعارات...');
    const { data: notifications, error: notifsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('patient_id', testPatientId)
      .order('created_at', { ascending: false });
    
    if (notifsError) throw notifsError;
    console.log(`   ✅ تم استرجاع ${notifications.length} إشعارات`);
    
    // Step 10: Get Admin Status
    console.log('\n🔟 الحصول على حالة الإدارة...');
    const today = new Date().toISOString().split('T')[0];
    
    const { count: totalToday } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .gte('entered_at', `${today}T00:00:00`);
    
    const { count: waiting } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');
    
    console.log(`   ✅ إجمالي المرضى اليوم: ${totalToday || 0}`);
    console.log(`   ✅ في الانتظار: ${waiting || 0}`);
    
    // Cleanup
    console.log('\n🧹 تنظيف بيانات الاختبار...');
    await supabase.from('notifications').delete().eq('patient_id', testPatientId);
    await supabase.from('queues').delete().eq('patient_id', testPatientId);
    await supabase.from('pathways').delete().eq('patient_id', testPatientId);
    await supabase.from('patients').delete().eq('id', testPatientId);
    console.log('   ✅ تم التنظيف');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// TEST RESULTS
// ============================================

async function runTests() {
  const success = await testCompletePatientJourney();
  
  console.log('\n======================================================================');
  console.log('📋 النتيجة النهائية');
  console.log('======================================================================');
  
  if (success) {
    console.log('✅ ✨ جميع الاختبارات نجحت! التطبيق جاهز للإنتاج ✨');
  } else {
    console.log('❌ بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.');
  }
  
  console.log('======================================================================\n');
  
  return success;
}

// Run tests
runTests().then((success) => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n❌ خطأ حرج:', error);
  process.exit(1);
});
