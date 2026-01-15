# تعليمات تطبيق إصلاح نظام الدور

## تاريخ: 15 يناير 2026

---

## الخطوة 1: تطبيق Migration على قاعدة البيانات

### 1.1 الاتصال بـ Supabase Dashboard
1. افتح [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. اختر المشروع: `rujwuruuosffcxazymit`
3. انتقل إلى **SQL Editor**

### 1.2 تشغيل Migration
1. انسخ محتوى ملف `02-fix-queue-system.sql`
2. الصقه في SQL Editor
3. اضغط **Run**
4. تأكد من ظهور رسالة "Success"

### 1.3 التحقق من إنشاء الجداول
```sql
-- تحقق من الجداول
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('patient_queue_numbers', 'queue_counters');

-- تحقق من الدوال
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%queue%';
```

---

## الخطوة 2: تحديث API Backend

### 2.1 في مستودع love-api
1. انسخ ملف `02-queue-api-fixed.js` إلى `/api/lib/queue-service.js`
2. قم بتحديث `/api/v1.js` لاستخدام الدوال الجديدة

### 2.2 تحديث endpoint /api/v1/queue/enter
```javascript
// استبدل الكود القديم بهذا
if (pathname === '/api/v1/queue/enter' && method === 'POST') {
  const { clinicId, patientId, examType, activate } = body;
  if (!clinicId || !patientId || !examType) {
    return sendError('Clinic ID, Patient ID and Exam Type required');
  }
  
  // إذا activate = false، فقط نخصص رقم
  if (activate === false) {
    const result = await assignQueueNumber(patientId, clinicId, examType);
    return sendResponse(result);
  }
  
  // إذا activate = true أو غير محدد، نخصص ونفعل
  const assignResult = await assignQueueNumber(patientId, clinicId, examType);
  if (!assignResult.success) {
    return sendError(assignResult.error);
  }
  
  const activateResult = await activateQueueNumber(patientId, clinicId, examType);
  return sendResponse(activateResult);
}
```

### 2.3 تحديث endpoint /api/v1/queue/status
```javascript
if (pathname === '/api/v1/queue/status' && method === 'GET') {
  const clinicId = parsedUrl.searchParams.get('clinicId');
  const patientId = parsedUrl.searchParams.get('patientId');
  const examType = parsedUrl.searchParams.get('examType');
  
  if (!clinicId || !patientId || !examType) {
    return sendError('Clinic ID, Patient ID and Exam Type required');
  }
  
  const result = await getQueuePosition(patientId, clinicId, examType);
  return result.success ? sendResponse(result) : sendError(result.error, 404);
}
```

### 2.4 تحديث endpoint /api/v1/queue/done
```javascript
if (pathname === '/api/v1/queue/done' && method === 'POST') {
  const { clinicId, patientId, examType, pin } = body;
  if (!clinicId || !patientId || !examType || !pin) {
    return sendError('Clinic ID, Patient ID, Exam Type and PIN required');
  }
  
  // التحقق من PIN
  if (pin !== generateDailyPIN(clinicId)) {
    return sendError('Invalid PIN', 401);
  }
  
  const result = await completeQueueNumber(patientId, clinicId, examType);
  return result.success ? sendResponse(result) : sendError(result.error);
}
```

---

## الخطوة 3: تحديث Frontend

### 3.1 تحديث PatientPage.jsx

#### في دالة handleGetTicketForFirstClinic:
```javascript
const handleGetTicketForFirstClinic = async (station) => {
  try {
    // فقط أخذ رقم دور (بدون تفعيل)
    const result = await api.enterQueue(
      station.id, 
      patientData.id, 
      patientData.queueType, // إضافة examType
      false // activate = false
    )
    
    if (result && result.success) {
      setStations(prev => prev.map((s, idx) => idx === 0 ? {
        ...s,
        yourNumber: result.queue_number,
        status: 'ready',
        isEntered: false,
      } : s))
    }
  } catch (e) {
    console.error('Get ticket for first clinic failed:', e)
  }
}
```

#### في دالة handleEnterClinic:
```javascript
const handleEnterClinic = async (station) => {
  try {
    setLoading(true)
    
    // تفعيل رقم الدور
    const result = await api.enterQueue(
      station.id, 
      patientData.id,
      patientData.queueType,
      true // activate = true
    )
    
    if (result && result.success) {
      setActiveTicket({ 
        clinicId: station.id, 
        ticket: result.queue_number 
      })
      
      setStations(prev => prev.map(s => s.id === station.id ? {
        ...s,
        yourNumber: result.queue_number,
        ahead: result.ahead,
        totalWaiting: result.total_waiting,
        status: 'ready',
        isEntered: true,
        entered_at: new Date().toISOString()
      } : s))
    }
    
    setLoading(false)
  } catch (e) {
    console.error('Enter clinic failed:', e)
    alert('فشل الدخول للعيادة')
    setLoading(false)
  }
}
```

### 3.2 تحديث api-unified.js

#### تحديث دالة enterQueue:
```javascript
async enterQueue(clinicId, patientId, examType, activate = true) {
  const response = await fetch(`${this.baseUrl}/queue/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      clinicId, 
      patientId, 
      examType,
      activate 
    })
  })
  return await response.json()
}
```

#### تحديث دالة getQueuePosition:
```javascript
async getQueuePosition(clinicId, patientId, examType) {
  const params = new URLSearchParams({ clinicId, patientId, examType })
  const response = await fetch(`${this.baseUrl}/queue/status?${params}`)
  return await response.json()
}
```

#### تحديث دالة queueDone:
```javascript
async queueDone(clinicId, patientId, examType, pin) {
  const response = await fetch(`${this.baseUrl}/queue/done`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, patientId, examType, pin })
  })
  return await response.json()
}
```

---

## الخطوة 4: الاختبار

### 4.1 اختبار قاعدة البيانات
```sql
-- اختبار تخصيص رقم دور
SELECT get_next_queue_number('TEST001', 'clinic_001', 'recruitment');

-- اختبار تفعيل رقم
SELECT activate_queue_number('TEST001', 'clinic_001', 'recruitment');

-- اختبار الحصول على الموقع
SELECT * FROM get_queue_position('TEST001', 'clinic_001', 'recruitment');

-- اختبار إكمال الفحص
SELECT complete_queue_number('TEST001', 'clinic_001', 'recruitment');

-- عرض حالة الطابور
SELECT * FROM queue_status_view;
```

### 4.2 اختبار API
```bash
# تخصيص رقم دور (بدون تفعيل)
curl -X POST https://mmc-mms.com/api/v1/queue/enter \
  -H "Content-Type: application/json" \
  -d '{"clinicId":"clinic_001","patientId":"123456","examType":"recruitment","activate":false}'

# تفعيل رقم دور
curl -X POST https://mmc-mms.com/api/v1/queue/enter \
  -H "Content-Type: application/json" \
  -d '{"clinicId":"clinic_001","patientId":"123456","examType":"recruitment","activate":true}'

# الحصول على الموقع
curl "https://mmc-mms.com/api/v1/queue/status?clinicId=clinic_001&patientId=123456&examType=recruitment"

# إكمال الفحص
curl -X POST https://mmc-mms.com/api/v1/queue/done \
  -H "Content-Type: application/json" \
  -d '{"clinicId":"clinic_001","patientId":"123456","examType":"recruitment","pin":"1234"}'
```

### 4.3 اختبار Frontend
1. افتح الموقع: https://mmc-mms.com
2. سجل دخول برقم عسكري جديد
3. اختر نوع فحص
4. تحقق من ظهور رقم الدور
5. حدّث الصفحة - يجب أن يبقى الرقم ثابتاً ✅
6. ادخل العيادة الأولى
7. تحقق من تحديث الموقع في الطابور
8. أكمل الفحص وانتقل للعيادة التالية
9. كرر العملية

---

## الخطوة 5: النشر

### 5.1 نشر Backend (love-api)
```bash
cd /home/ubuntu/love-api
git add .
git commit -m "fix: implement stable queue number system"
git push origin master
vercel --prod
```

### 5.2 نشر Frontend (love)
```bash
cd /home/ubuntu/love
git add .
git commit -m "fix: integrate stable queue number system"
git push origin master
vercel --prod
```

---

## معايير النجاح

- ✅ رقم الدور ثابت ولا يتغير عند تحديث الصفحة
- ✅ كل مراجع له رقم فريد في كل عيادة
- ✅ الأرقام متسلسلة ومنظمة
- ✅ الموقع في الطابور دقيق ومحدث
- ✅ لا توجد أرقام مكررة
- ✅ النظام يعمل بسلاسة مع عدة مراجعين في نفس الوقت

---

## استكشاف الأخطاء

### المشكلة: رقم الدور لا يظهر
**الحل**: تحقق من:
- تم تشغيل Migration بنجاح
- API تستخدم الدوال الجديدة
- examType يتم إرساله في جميع الطلبات

### المشكلة: رقم الدور يتغير
**الحل**: تحقق من:
- الفهرس الفريد موجود في الجدول
- الدالة get_next_queue_number تتحقق من الأرقام الموجودة أولاً

### المشكلة: أخطاء في قاعدة البيانات
**الحل**: تحقق من:
- صلاحيات RLS مفعلة بشكل صحيح
- الدوال لها صلاحيات EXECUTE

---

## ملاحظات مهمة

1. **لا تحذف الجداول القديمة** حتى تتأكد من عمل النظام الجديد بشكل كامل
2. **احتفظ بنسخة احتياطية** من قاعدة البيانات قبل التطبيق
3. **اختبر على بيئة staging** أولاً إن أمكن
4. **راقب الأداء** في الأيام الأولى بعد النشر
5. **جدول cleanup_old_queue_data()** للتنفيذ يومياً عند منتصف الليل
