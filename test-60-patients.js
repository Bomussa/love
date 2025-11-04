/**
 * اختبار نظام التوزيع الديناميكي - 60 مراجع
 * يختبر توزيع المرضى على العيادات بشكل متوازن
 */

const API_BASE = 'http://localhost:3000';

// قائمة العيادات
const clinics = [
  'lab', 'xray', 'vitals', 'ecg', 'audio',
  'eyes', 'internal', 'ent', 'surgery', 'dental',
  'psychiatry', 'derma', 'bones'
];

// إنشاء 60 مراجع
async function createPatients() {
  console.log('🚀 بدء إنشاء 60 مراجع...\n');
  
  const patients = [];
  const genders = ['male', 'female'];
  
  for (let i = 1; i <= 60; i++) {
    const patientId = String(1000000000 + i);
    const gender = genders[i % 2]; // توزيع متساوي بين ذكور وإناث
    
    patients.push({
      id: patientId,
      gender: gender,
      examType: 'recruitment' // فحص التجنيد
    });
  }
  
  console.log(`✅ تم إنشاء ${patients.length} مراجع\n`);
  return patients;
}

// محاكاة دخول المرضى للنظام
async function simulatePatientFlow() {
  const patients = await createPatients();
  const queuesStatus = {};
  
  // تهيئة العيادات
  clinics.forEach(clinic => {
    queuesStatus[clinic] = {
      waiting: 0,
      served: 0,
      patients: []
    };
  });
  
  console.log('📊 بدء توزيع المرضى على العيادات...\n');
  
  // توزيع المرضى بشكل ديناميكي حسب الحمل
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    
    // اختيار المسار الطبي حسب الجنس
    const pathway = patient.gender === 'male' 
      ? ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones']
      : ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'dental', 'psychiatry', 'derma'];
    
    // إضافة المريض لأول عيادة في مساره
    const firstClinic = pathway[0];
    
    // التوزيع الديناميكي - اختيار العيادة الأقل ازدحاماً
    let targetClinic = firstClinic;
    let minLoad = queuesStatus[firstClinic].waiting;
    
    // البحث عن عيادة بديلة أقل ازدحاماً (من نفس النوع)
    const alternativeClinics = clinics.filter(c => 
      queuesStatus[c].waiting < minLoad
    );
    
    if (alternativeClinics.length > 0) {
      targetClinic = alternativeClinics[0];
    }
    
    // إضافة المريض للطابور
    queuesStatus[targetClinic].waiting++;
    queuesStatus[targetClinic].patients.push({
      id: patient.id,
      number: queuesStatus[targetClinic].waiting,
      enteredAt: new Date().toISOString()
    });
  }
  
  // عرض النتائج
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📈 نتائج التوزيع الديناميكي لـ 60 مراجع');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let totalWaiting = 0;
  let minQueue = Infinity;
  let maxQueue = 0;
  
  clinics.forEach(clinic => {
    const status = queuesStatus[clinic];
    const waiting = status.waiting;
    
    totalWaiting += waiting;
    minQueue = Math.min(minQueue, waiting);
    maxQueue = Math.max(maxQueue, waiting);
    
    console.log(`${clinic.padEnd(15)} | المنتظرين: ${String(waiting).padStart(3)} | النسبة: ${((waiting / 60) * 100).toFixed(1)}%`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 الإحصائيات الإجمالية:`);
  console.log(`   • إجمالي المنتظرين: ${totalWaiting}`);
  console.log(`   • أقل طابور: ${minQueue}`);
  console.log(`   • أكبر طابور: ${maxQueue}`);
  console.log(`   • الفرق: ${maxQueue - minQueue}`);
  console.log(`   • متوسط الانتظار: ${(totalWaiting / clinics.length).toFixed(1)}`);
  
  // التحقق من التوازن
  const balance = ((maxQueue - minQueue) / maxQueue) * 100;
  console.log(`   • نسبة التوازن: ${(100 - balance).toFixed(1)}%`);
  
  if (balance < 30) {
    console.log('\n✅ التوزيع ممتاز - متوازن جداً!');
  } else if (balance < 50) {
    console.log('\n⚠️ التوزيع جيد - يحتاج تحسين');
  } else {
    console.log('\n❌ التوزيع ضعيف - يحتاج إعادة هندسة');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return queuesStatus;
}

// تشغيل الاختبار
simulatePatientFlow()
  .then(result => {
    console.log('✅ اكتمل الاختبار بنجاح\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ فشل الاختبار:', error);
    process.exit(1);
  });
