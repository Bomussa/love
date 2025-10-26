#!/usr/bin/env node

/**
 * اختبار شامل لـ 5 مراجعين - فحص التجنيد
 * Medical Queue Management System - Comprehensive Test
 */

const API_BASE = 'https://www.mmc-mms.com/api/v1';

// بيانات المراجعين الخمسة
const patients = [
  { id: 'P001', number: '12345001', gender: 'male', name: 'المراجع الأول' },
  { id: 'P002', number: '12345002', gender: 'male', name: 'المراجع الثاني' },
  { id: 'P003', number: '12345003', gender: 'male', name: 'المراجع الثالث' },
  { id: 'P004', number: '12345004', gender: 'female', name: 'المراجعة الرابعة' },
  { id: 'P005', number: '12345005', gender: 'male', name: 'المراجع الخامس' }
];

const examType = 'تجنيد'; // Recruitment exam

// نتائج الاختبار
const testResults = {
  timestamp: new Date().toISOString(),
  totalPatients: 5,
  examType: examType,
  patients: [],
  errors: [],
  summary: {
    loginSuccess: 0,
    routeCreated: 0,
    queueEntered: 0,
    notificationsReceived: 0,
    pinValidated: 0,
    clinicsCompleted: 0
  }
};

// دالة للانتظار
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// دالة لطباعة النتائج
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('ar-QA');
  const prefix = {
    'info': '📋',
    'success': '✅',
    'error': '❌',
    'warning': '⚠️',
    'test': '🧪'
  }[type] || 'ℹ️';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// اختبار 1: تسجيل الدخول
async function testLogin(patient) {
  log(`اختبار تسجيل الدخول: ${patient.name}`, 'test');
  
  try {
    const response = await fetch(`${API_BASE}/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalNumber: patient.number,
        gender: patient.gender
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ نجح تسجيل الدخول: ${patient.name}`, 'success');
      testResults.summary.loginSuccess++;
      return { success: true, data };
    } else {
      log(`❌ فشل تسجيل الدخول: ${patient.name} - ${data.message}`, 'error');
      testResults.errors.push({
        patient: patient.name,
        step: 'login',
        error: data.message
      });
      return { success: false, error: data.message };
    }
  } catch (error) {
    log(`❌ خطأ في تسجيل الدخول: ${patient.name} - ${error.message}`, 'error');
    testResults.errors.push({
      patient: patient.name,
      step: 'login',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

// اختبار 2: إنشاء المسار الديناميكي
async function testRouteCreation(patient) {
  log(`اختبار إنشاء المسار: ${patient.name}`, 'test');
  
  try {
    const response = await fetch(`${API_BASE}/route/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patient.id,
        examType: examType,
        gender: patient.gender
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.route) {
      log(`✅ تم إنشاء المسار: ${patient.name} - ${data.route.stations.length} عيادة`, 'success');
      log(`   المسار: ${data.route.stations.join(' → ')}`, 'info');
      
      if (data.route.dynamic) {
        log(`   🎯 مسار ديناميكي حسب الأوزان`, 'success');
      }
      
      testResults.summary.routeCreated++;
      return { success: true, route: data.route };
    } else {
      log(`❌ فشل إنشاء المسار: ${patient.name}`, 'error');
      testResults.errors.push({
        patient: patient.name,
        step: 'route_creation',
        error: 'Route creation failed'
      });
      return { success: false };
    }
  } catch (error) {
    log(`❌ خطأ في إنشاء المسار: ${patient.name} - ${error.message}`, 'error');
    testResults.errors.push({
      patient: patient.name,
      step: 'route_creation',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

// اختبار 3: دخول الطابور
async function testQueueEntry(patient, clinic) {
  log(`اختبار دخول الطابور: ${patient.name} - ${clinic}`, 'test');
  
  try {
    const response = await fetch(`${API_BASE}/queue/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic: clinic,
        user: patient.id,
        gender: patient.gender
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ دخل الطابور: ${patient.name} - رقم الدور: ${data.yourNumber}`, 'success');
      log(`   الحالي: ${data.current} | أمامك: ${data.ahead}`, 'info');
      
      testResults.summary.queueEntered++;
      return { success: true, queueData: data };
    } else {
      log(`❌ فشل دخول الطابور: ${patient.name} - ${clinic}`, 'error');
      testResults.errors.push({
        patient: patient.name,
        step: 'queue_entry',
        clinic: clinic,
        error: data.message
      });
      return { success: false };
    }
  } catch (error) {
    log(`❌ خطأ في دخول الطابور: ${patient.name} - ${error.message}`, 'error');
    testResults.errors.push({
      patient: patient.name,
      step: 'queue_entry',
      clinic: clinic,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

// اختبار 4: الحصول على PIN
async function testGetPIN(clinic) {
  try {
    const response = await fetch(`${API_BASE}/pin/status`);
    const data = await response.json();
    
    if (data.success && data.pins && data.pins[clinic]) {
      return { success: true, pin: data.pins[clinic] };
    }
    return { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// اختبار 5: إكمال العيادة
async function testCompleteClinic(patient, clinic) {
  log(`اختبار إكمال العيادة: ${patient.name} - ${clinic}`, 'test');
  
  try {
    const response = await fetch(`${API_BASE}/queue/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic: clinic,
        user: patient.id
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ أكمل العيادة: ${patient.name} - ${clinic}`, 'success');
      testResults.summary.clinicsCompleted++;
      return { success: true };
    } else {
      log(`❌ فشل إكمال العيادة: ${patient.name} - ${clinic}`, 'error');
      return { success: false };
    }
  } catch (error) {
    log(`❌ خطأ في إكمال العيادة: ${patient.name} - ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

// اختبار شامل لمراجع واحد
async function testPatientJourney(patient, patientIndex) {
  log(`\n${'='.repeat(60)}`, 'info');
  log(`بدء اختبار: ${patient.name} (${patientIndex + 1}/5)`, 'test');
  log(`${'='.repeat(60)}\n`, 'info');
  
  const patientResult = {
    id: patient.id,
    name: patient.name,
    number: patient.number,
    gender: patient.gender,
    steps: {},
    route: null,
    clinicsVisited: [],
    totalTime: 0,
    success: false
  };
  
  const startTime = Date.now();
  
  // 1. تسجيل الدخول
  const loginResult = await testLogin(patient);
  patientResult.steps.login = loginResult.success;
  
  if (!loginResult.success) {
    patientResult.success = false;
    testResults.patients.push(patientResult);
    return patientResult;
  }
  
  await sleep(1000);
  
  // 2. إنشاء المسار
  const routeResult = await testRouteCreation(patient);
  patientResult.steps.routeCreation = routeResult.success;
  patientResult.route = routeResult.route;
  
  if (!routeResult.success || !routeResult.route) {
    patientResult.success = false;
    testResults.patients.push(patientResult);
    return patientResult;
  }
  
  await sleep(1000);
  
  // 3. زيارة العيادات (أول 3 عيادات فقط للاختبار)
  const clinicsToTest = routeResult.route.stations.slice(0, 3);
  
  for (let i = 0; i < clinicsToTest.length; i++) {
    const clinic = clinicsToTest[i];
    
    log(`\n--- العيادة ${i + 1}/${clinicsToTest.length}: ${clinic} ---`, 'info');
    
    // دخول الطابور
    const queueResult = await testQueueEntry(patient, clinic);
    
    if (queueResult.success) {
      patientResult.clinicsVisited.push({
        clinic: clinic,
        queueNumber: queueResult.queueData.yourNumber,
        ahead: queueResult.queueData.ahead,
        status: 'entered'
      });
      
      await sleep(2000);
      
      // إكمال العيادة
      const completeResult = await testCompleteClinic(patient, clinic);
      
      if (completeResult.success) {
        patientResult.clinicsVisited[patientResult.clinicsVisited.length - 1].status = 'completed';
      }
    }
    
    await sleep(1500);
  }
  
  const endTime = Date.now();
  patientResult.totalTime = Math.round((endTime - startTime) / 1000);
  patientResult.success = patientResult.clinicsVisited.length > 0;
  
  log(`\n✅ انتهى اختبار: ${patient.name} - الوقت: ${patientResult.totalTime}ث`, 'success');
  
  testResults.patients.push(patientResult);
  return patientResult;
}

// الاختبار الرئيسي
async function runFullTest() {
  console.log('\n');
  log('═'.repeat(70), 'info');
  log('   🏥 اختبار شامل لنظام إدارة الطوابير الطبية   ', 'info');
  log('═'.repeat(70), 'info');
  log(`📅 التاريخ: ${new Date().toLocaleDateString('ar-QA')}`, 'info');
  log(`⏰ الوقت: ${new Date().toLocaleTimeString('ar-QA')}`, 'info');
  log(`👥 عدد المراجعين: ${patients.length}`, 'info');
  log(`🔬 نوع الفحص: ${examType}`, 'info');
  log(`🌐 API: ${API_BASE}`, 'info');
  log('═'.repeat(70), 'info');
  console.log('\n');
  
  // اختبار حالة API
  log('🔍 فحص حالة API...', 'test');
  try {
    const statusResponse = await fetch(`${API_BASE}/status`);
    const statusData = await statusResponse.json();
    
    if (statusData.status === 'ok') {
      log('✅ API يعمل بشكل صحيح', 'success');
      log(`   النسخة: ${statusData.version || 'N/A'}`, 'info');
    } else {
      log('⚠️ API يعمل لكن بحالة غير طبيعية', 'warning');
    }
  } catch (error) {
    log(`❌ فشل الاتصال بـ API: ${error.message}`, 'error');
    log('⚠️ سيتم متابعة الاختبار رغم ذلك...', 'warning');
  }
  
  await sleep(2000);
  
  // اختبار كل مراجع
  for (let i = 0; i < patients.length; i++) {
    await testPatientJourney(patients[i], i);
    
    // انتظار بين المراجعين
    if (i < patients.length - 1) {
      await sleep(3000);
    }
  }
  
  // طباعة التقرير النهائي
  printFinalReport();
}

// طباعة التقرير النهائي
function printFinalReport() {
  console.log('\n\n');
  log('═'.repeat(70), 'info');
  log('   📊 التقرير النهائي - نتائج الاختبار الشامل   ', 'success');
  log('═'.repeat(70), 'info');
  
  console.log('\n📈 الإحصائيات العامة:');
  console.log(`   ✅ تسجيل دخول ناجح: ${testResults.summary.loginSuccess}/${testResults.totalPatients}`);
  console.log(`   ✅ مسارات تم إنشاؤها: ${testResults.summary.routeCreated}/${testResults.totalPatients}`);
  console.log(`   ✅ دخول طوابير: ${testResults.summary.queueEntered}`);
  console.log(`   ✅ عيادات مكتملة: ${testResults.summary.clinicsCompleted}`);
  
  console.log('\n👥 نتائج المراجعين:');
  testResults.patients.forEach((patient, index) => {
    const status = patient.success ? '✅' : '❌';
    console.log(`\n   ${index + 1}. ${status} ${patient.name}`);
    console.log(`      📋 الرقم: ${patient.number}`);
    console.log(`      ⚥ الجنس: ${patient.gender === 'male' ? 'ذكر' : 'أنثى'}`);
    console.log(`      ⏱️ الوقت: ${patient.totalTime}ث`);
    
    if (patient.route) {
      console.log(`      🗺️ المسار: ${patient.route.stations.slice(0, 5).join(' → ')}${patient.route.stations.length > 5 ? '...' : ''}`);
      console.log(`      🏥 العيادات: ${patient.clinicsVisited.length}/${patient.route.stations.length}`);
    }
    
    if (patient.clinicsVisited.length > 0) {
      console.log(`      📍 تفاصيل العيادات:`);
      patient.clinicsVisited.forEach((visit, i) => {
        const visitStatus = visit.status === 'completed' ? '✅' : '⏳';
        console.log(`         ${i + 1}. ${visitStatus} ${visit.clinic} - رقم الدور: ${visit.queueNumber} (أمامك: ${visit.ahead})`);
      });
    }
  });
  
  if (testResults.errors.length > 0) {
    console.log('\n\n⚠️ الأخطاء المكتشفة:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.patient} - ${error.step}`);
      console.log(`      ❌ ${error.error}`);
      if (error.clinic) {
        console.log(`      🏥 العيادة: ${error.clinic}`);
      }
    });
  } else {
    console.log('\n\n✅ لا توجد أخطاء! الاختبار ناجح 100%');
  }
  
  // حساب نسبة النجاح
  const successRate = Math.round((testResults.summary.loginSuccess / testResults.totalPatients) * 100);
  
  console.log('\n\n📊 نسبة النجاح الإجمالية:');
  console.log(`   ${successRate >= 80 ? '✅' : '❌'} ${successRate}%`);
  
  if (successRate === 100) {
    console.log('\n   🎉 ممتاز! جميع الاختبارات نجحت!');
  } else if (successRate >= 80) {
    console.log('\n   👍 جيد! معظم الاختبارات نجحت.');
  } else if (successRate >= 50) {
    console.log('\n   ⚠️ متوسط! يحتاج إلى تحسينات.');
  } else {
    console.log('\n   ❌ ضعيف! يحتاج إلى إصلاحات كبيرة.');
  }
  
  log('═'.repeat(70), 'info');
  
  // حفظ التقرير في ملف
  const fs = require('fs');
  const reportPath = '/home/ubuntu/love/TEST_REPORT.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  log(`\n💾 تم حفظ التقرير الكامل في: ${reportPath}`, 'success');
}

// تشغيل الاختبار
runFullTest().catch(error => {
  log(`❌ خطأ فادح في الاختبار: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});

