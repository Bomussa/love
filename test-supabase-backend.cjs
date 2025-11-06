#!/usr/bin/env node
/**
 * Comprehensive Test Suite for Supabase Backend
 * Tests all API functions and Real-time features
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test patient ID
const testPatientId = `test-${Date.now()}`;
const testGender = 'male';

console.log('======================================================================');
console.log('🧪 اختبار شامل للـ Backend الجديد (Supabase)');
console.log('======================================================================\n');

// ============================================
// TEST 1: DATABASE CONNECTION
// ============================================
async function test1_connection() {
  console.log('📌 اختبار 1: الاتصال بقاعدة البيانات');
  console.log('----------------------------------------------------------------------');
  
  try {
    const { data, error } = await supabase.from('clinics').select('count');
    
    if (error) throw error;
    
    console.log('✅ الاتصال بقاعدة البيانات نجح');
    return true;
  } catch (error) {
    console.error('❌ فشل الاتصال:', error.message);
    return false;
  }
}

// ============================================
// TEST 2: CLINICS & PIN SYSTEM
// ============================================
async function test2_clinics() {
  console.log('\n📌 اختبار 2: نظام العيادات وأكواد PIN');
  console.log('----------------------------------------------------------------------');
  
  try {
    // Get all clinics
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('*')
      .order('display_order');
    
    if (error) throw error;
    
    console.log(`✅ تم استرجاع ${clinics.length} عيادة`);
    
    // Show clinics with PINs
    const withPin = clinics.filter(c => c.requires_pin);
    console.log(`\n🔐 العيادات التي تتطلب PIN (${withPin.length}):`);
    withPin.forEach(c => {
      console.log(`   • ${c.name_ar} (${c.id}): PIN=${c.pin}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// TEST 3: PATIENT REGISTRATION
// ============================================
async function test3_patient() {
  console.log('\n📌 اختبار 3: تسجيل المريض');
  console.log('----------------------------------------------------------------------');
  
  try {
    // Register patient
    const { data, error } = await supabase
      .from('patients')
      .insert([{ id: testPatientId, gender: testGender }])
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ تم تسجيل المريض بنجاح');
    console.log(`   معرف المريض: ${data.id}`);
    console.log(`   الجنس: ${data.gender}`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// TEST 4: PATHWAY CREATION
// ============================================
async function test4_pathway() {
  console.log('\n📌 اختبار 4: إنشاء المسار الديناميكي');
  console.log('----------------------------------------------------------------------');
  
  try {
    const malePathway = [
      'lab', 'radiology', 'vitals', 'ecg', 'audiology',
      'eyes', 'internal', 'ent', 'surgery', 'dental',
      'psychiatry', 'dermatology', 'orthopedics'
    ];
    
    const { data, error } = await supabase
      .from('pathways')
      .insert([{
        patient_id: testPatientId,
        gender: testGender,
        pathway: malePathway,
        current_step: 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ تم إنشاء المسار بنجاح');
    console.log(`   عدد المحطات: ${data.pathway.length}`);
    console.log(`   المحطات: ${data.pathway.join(' → ')}`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// TEST 5: QUEUE OPERATIONS
// ============================================
async function test5_queue() {
  console.log('\n📌 اختبار 5: عمليات الطابور');
  console.log('----------------------------------------------------------------------');
  
  try {
    const clinicId = 'eyes';
    
    // 5.1: Enter queue
    console.log('5.1️⃣  دخول الطابور...');
    
    // Get next display number
    const { data: maxNumber } = await supabase
      .from('queues')
      .select('display_number')
      .eq('clinic_id', clinicId)
      .order('display_number', { ascending: false })
      .limit(1)
      .single();
    
    const displayNumber = (maxNumber?.display_number || 0) + 1;
    
    const { data: queueEntry, error: enterError } = await supabase
      .from('queues')
      .insert([{
        clinic_id: clinicId,
        patient_id: testPatientId,
        display_number: displayNumber,
        status: 'waiting'
      }])
      .select()
      .single();
    
    if (enterError) throw enterError;
    
    console.log('✅ تم دخول الطابور بنجاح');
    console.log(`   رقم الدور: ${queueEntry.display_number}`);
    
    // 5.2: Get queue status
    console.log('\n5.2️⃣  الحصول على حالة الطابور...');
    
    const { data: queueStatus, error: statusError } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .in('status', ['waiting', 'serving']);
    
    if (statusError) throw statusError;
    
    console.log('✅ حالة الطابور:');
    console.log(`   عدد المنتظرين: ${queueStatus.length}`);
    
    // 5.3: Complete queue entry
    console.log('\n5.3️⃣  إكمال الدور...');
    
    // Get clinic PIN
    const { data: clinic } = await supabase
      .from('clinics')
      .select('pin')
      .eq('id', clinicId)
      .single();
    
    const { data: completed, error: completeError } = await supabase
      .from('queues')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_pin: clinic.pin
      })
      .eq('clinic_id', clinicId)
      .eq('patient_id', testPatientId)
      .select()
      .single();
    
    if (completeError) throw completeError;
    
    console.log('✅ تم إكمال الدور بنجاح');
    console.log(`   PIN المستخدم: ${clinic.pin}`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// TEST 6: NOTIFICATIONS
// ============================================
async function test6_notifications() {
  console.log('\n📌 اختبار 6: نظام الإشعارات');
  console.log('----------------------------------------------------------------------');
  
  try {
    // 6.1: Add notifications
    console.log('6.1️⃣  إضافة إشعارات...');
    
    const notifications = [
      { message: 'مرحباً بك في النظام', type: 'info' },
      { message: 'أنت الثالث - استعد', type: 'warning' },
      { message: 'دورك الآن!', type: 'success' }
    ];
    
    for (const notif of notifications) {
      await supabase.from('notifications').insert([{
        patient_id: testPatientId,
        message: notif.message,
        type: notif.type,
        read: false
      }]);
    }
    
    console.log(`✅ تم إضافة ${notifications.length} إشعارات`);
    
    // 6.2: Get notifications
    console.log('\n6.2️⃣  استرجاع الإشعارات...');
    
    const { data: allNotifs, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('patient_id', testPatientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('✅ الإشعارات:');
    console.log(`   إجمالي الإشعارات: ${allNotifs.length}`);
    allNotifs.forEach((n, i) => {
      console.log(`      ${i + 1}. ${n.message} (${n.type})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// TEST 7: REPORTS & STATISTICS
// ============================================
async function test7_reports() {
  console.log('\n📌 اختبار 7: التقارير والإحصائيات');
  console.log('----------------------------------------------------------------------');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's completed queues
    const { data: completed, error } = await supabase
      .from('queue_history')
      .select('*')
      .gte('completed_at', `${today}T00:00:00`)
      .lt('completed_at', `${today}T23:59:59`);
    
    if (error) throw error;
    
    console.log('✅ التقرير اليومي:');
    console.log(`   التاريخ: ${today}`);
    console.log(`   إجمالي المرضى المكتملين: ${completed.length}`);
    
    if (completed.length > 0) {
      const avgWait = Math.round(
        completed.reduce((sum, q) => sum + q.wait_time_seconds, 0) / completed.length
      );
      console.log(`   متوسط وقت الانتظار: ${avgWait} ثانية`);
    }
    
    // Get admin status
    const { count: totalToday } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .gte('entered_at', `${today}T00:00:00`);
    
    const { count: waiting } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');
    
    console.log('\n✅ حالة الإدارة:');
    console.log(`   إجمالي المرضى اليوم: ${totalToday || 0}`);
    console.log(`   في الانتظار: ${waiting || 0}`);
    console.log(`   تم خدمتهم: ${completed.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

// ============================================
// CLEANUP
// ============================================
async function cleanup() {
  console.log('\n🧹 تنظيف بيانات الاختبار...');
  
  try {
    // Delete test data
    await supabase.from('notifications').delete().eq('patient_id', testPatientId);
    await supabase.from('queues').delete().eq('patient_id', testPatientId);
    await supabase.from('pathways').delete().eq('patient_id', testPatientId);
    await supabase.from('patients').delete().eq('id', testPatientId);
    
    console.log('✅ تم تنظيف بيانات الاختبار');
  } catch (error) {
    console.error('⚠️  تحذير: فشل التنظيف:', error.message);
  }
}

// ============================================
// RUN ALL TESTS
// ============================================
async function runAllTests() {
  const results = {
    connection: false,
    clinics: false,
    patient: false,
    pathway: false,
    queue: false,
    notifications: false,
    reports: false
  };
  
  results.connection = await test1_connection();
  if (!results.connection) {
    console.log('\n❌ فشل الاتصال بقاعدة البيانات. توقف الاختبار.');
    return results;
  }
  
  results.clinics = await test2_clinics();
  results.patient = await test3_patient();
  results.pathway = await test4_pathway();
  results.queue = await test5_queue();
  results.notifications = await test6_notifications();
  results.reports = await test7_reports();
  
  await cleanup();
  
  // Summary
  console.log('\n======================================================================');
  console.log('📋 ملخص النتائج النهائي');
  console.log('======================================================================');
  
  const tests = [
    { name: 'الاتصال بقاعدة البيانات', result: results.connection },
    { name: 'نظام العيادات وPIN', result: results.clinics },
    { name: 'تسجيل المريض', result: results.patient },
    { name: 'المسار الديناميكي', result: results.pathway },
    { name: 'نظام الطوابير', result: results.queue },
    { name: 'نظام الإشعارات', result: results.notifications },
    { name: 'التقارير والإحصائيات', result: results.reports }
  ];
  
  tests.forEach((test, i) => {
    const status = test.result ? '✅' : '❌';
    console.log(`${status} ${i + 1}️⃣  ${test.name}`);
  });
  
  const passed = tests.filter(t => t.result).length;
  const total = tests.length;
  
  console.log('======================================================================');
  console.log(`🎉 النتيجة النهائية: ${passed}/${total} اختبارات نجحت`);
  console.log('======================================================================');
  
  if (passed === total) {
    console.log('✨ جميع الاختبارات نجحت! Backend جاهز للاستخدام ✨');
  } else {
    console.log('⚠️  بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.');
  }
  
  return results;
}

// Run tests
runAllTests().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('\n❌ خطأ حرج:', error);
  process.exit(1);
});
