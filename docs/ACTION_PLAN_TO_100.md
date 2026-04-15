# خطة العمل للوصول إلى 100%
## MMC-MMS System - Complete Implementation Plan

---

## 🎯 الهدف

إكمال الـ **15%** المتبقية من المشروع للوصول إلى **100%** وظيفي بدون أي نقص.

---

## 📋 المهام المتبقية

### ✅ المهام السريعة (يمكن إنجازها فوراً)

#### 1. إصلاح session_code في PIN Assign
**الوقت المتوقع:** 5 دقائق  
**الأولوية:** عالية جداً  
**التعقيد:** بسيط

**الخطوات:**
```javascript
// في ملف: functions/api/v1/pin/[[clinic]]/assign.js
// السطر ~70

// الحالي:
session_code: null,  // ❌

// التعديل المطلوب:
session_code: `${clinic.toUpperCase()}-${pin}-${dateKey}`,  // ✅
```

**الاختبار:**
```bash
curl -X POST "https://www.mmc-mms.com/api/v1/pin/lab/assign" \
  -H "Idempotency-Key: test-123"
# يجب أن يرجع: "session_code": "LAB-01-2025-10-19"
```

---

#### 2. إصلاح success و status في Queue Enter
**الوقت المتوقع:** 5 دقائق  
**الأولوية:** عالية جداً  
**التعقيد:** بسيط

**الخطوات:**
```javascript
// في ملف: functions/api/v1/queue/[[clinic]]/enter.js
// السطر ~90

// إضافة في الاستجابة:
return jsonResponse({
  success: true,  // ✅ إضافة
  clinic,
  pin,
  position,
  status: 'WAITING',  // ✅ إضافة
  session_code,
  queue_length,
  timestamp: new Date().toISOString()
});
```

**الاختبار:**
```bash
curl -X POST "https://www.mmc-mms.com/api/v1/queue/lab/enter" \
  -H "Content-Type: application/json" \
  -d '{"pin":"01"}'
# يجب أن يرجع: "success": true, "status": "WAITING"
```

---

### 🔧 المهام المتوسطة (تحتاج وقت أطول)

#### 3. إصلاح Path Engine
**الوقت المتوقع:** 30 دقيقة  
**الأولوية:** عالية  
**التعقيد:** متوسط

**المشكلة الحالية:**
- الملف `path/choose.js` يرجع HTML بدلاً من JSON

**الحل:**
```javascript
// خيار 1: إصلاح الملف الحالي
// التحقق من _routes.json
{
  "version": 1,
  "include": ["/api/*"],  // ✅ يجب أن يشمل /api/v1/path/*
  "exclude": []
}

// خيار 2: نقل logic إلى Frontend
// في src/core/path-engine.js
export function choosePath(gender, age, conditions) {
  const weights = {
    lab: gender === 'male' ? 1.0 : 0.8,
    xray: 1.0,
    general: gender === 'female' && age > 40 ? 1.2 : 1.0
  };
  
  // منطق الاختيار...
  return selectedClinic;
}
```

**الاختبار:**
```bash
curl -X POST "https://www.mmc-mms.com/api/v1/path/choose" \
  -H "Content-Type: application/json" \
  -d '{"gender":"male","age":30}'
# يجب أن يرجع JSON صحيح
```

---

#### 4. إضافة Queue Call و Done
**الوقت المتوقع:** 45 دقيقة  
**الأولوية:** عالية  
**التعقيد:** متوسط

**الحل الموصى به:** استخدام query parameters في status endpoint

**الخطوات:**
```javascript
// في ملف: functions/api/v1/queue/[[clinic]]/status.js

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  // إذا كان action=call
  if (action === 'call') {
    return await handleQueueCall(env, clinic);
  }
  
  // إذا كان action=done
  if (action === 'done') {
    const pin = url.searchParams.get('pin');
    return await handleQueueDone(env, clinic, pin);
  }
  
  // الافتراضي: إرجاع status
  return await getQueueStatus(env, clinic);
}

async function handleQueueCall(env, clinic) {
  // منطق نداء التالي في الدور
  // 1. الحصول على queue من KV
  // 2. إيجاد أول WAITING
  // 3. تحديث status إلى IN_SERVICE
  // 4. إرسال إشعار
  // 5. حفظ في KV
}

async function handleQueueDone(env, clinic, pin) {
  // منطق إنهاء الخدمة
  // 1. الحصول على queue من KV
  // 2. تحديث status إلى DONE
  // 3. حساب wait time
  // 4. تحديث avg_wait_seconds
  // 5. حفظ في KV
}
```

**الاختبار:**
```bash
# نداء التالي
curl "https://www.mmc-mms.com/api/v1/queue/lab/status?action=call"

# إنهاء الخدمة
curl "https://www.mmc-mms.com/api/v1/queue/lab/status?action=done&pin=01"
```

---

#### 5. إضافة Notify Dispatch
**الوقت المتوقع:** 30 دقيقة  
**الأولوية:** متوسطة  
**التعقيد:** متوسط

**الحل:** نفس الطريقة - استخدام query parameters

```javascript
// في ملف: functions/api/v1/notify/status.js

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (action === 'dispatch') {
    const type = url.searchParams.get('type');
    const pin = url.searchParams.get('pin');
    const clinic = url.searchParams.get('clinic');
    
    return await handleNotifyDispatch(env, { type, pin, clinic });
  }
  
  // الافتراضي: إرجاع notifications للمراجع
  return await getNotifications(env, pin, clinic);
}
```

**الاختبار:**
```bash
curl "https://www.mmc-mms.com/api/v1/notify/status?action=dispatch&type=YOUR_TURN&pin=01&clinic=lab"
```

---

#### 6. إضافة PIN Reset
**الوقت المتوقع:** 20 دقيقة  
**الأولوية:** متوسطة  
**التعقيد:** بسيط

```javascript
// في ملف: functions/api/v1/pin/[[clinic]]/status.js

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (action === 'reset') {
    return await handlePinReset(env, clinic);
  }
  
  return await getPinStatus(env, clinic);
}

async function handlePinReset(env, clinic) {
  const dateKey = getCurrentDateKey();
  const pinsKey = `pins:${clinic}:${dateKey}`;
  
  // حذف البيانات الحالية
  await env.KV_PINS.delete(pinsKey);
  
  // تسجيل الحدث
  await logEvent(env.KV_EVENTS, {
    type: 'PINS_RESET',
    clinic,
    date: dateKey,
    timestamp: new Date().toISOString()
  });
  
  return jsonResponse({
    success: true,
    clinic,
    date: dateKey,
    message: 'PINs reset successfully'
  });
}
```

---

### 🚀 المهام المتقدمة (تحتاج Workers)

#### 7. SSE Events Stream
**الوقت المتوقع:** 2-3 ساعات  
**الأولوية:** منخفضة  
**التعقيد:** عالي

**المشكلة:**
- Cloudflare Pages Functions **لا تدعم SSE**

**الحل:**
```
خيار 1: استخدام Cloudflare Worker منفصل
خيار 2: استخدام Polling من Frontend كل 5 ثواني
خيار 3: استخدام WebSockets عبر Durable Objects
```

**الحل الموصى به:** Polling (الأسهل والأسرع)

```javascript
// في Frontend: src/core/notification-engine.js

class NotificationEngine {
  constructor() {
    this.pollingInterval = null;
  }
  
  startPolling(pin, clinic) {
    this.pollingInterval = setInterval(async () => {
      const response = await fetch(
        `/api/v1/notify/status?pin=${pin}&clinic=${clinic}&limit=5`
      );
      const data = await response.json();
      
      if (data.notifications && data.notifications.length > 0) {
        this.handleNotifications(data.notifications);
      }
    }, 5000); // كل 5 ثواني
  }
  
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
  
  handleNotifications(notifications) {
    notifications.forEach(notif => {
      if (notif.type === 'YOUR_TURN') {
        this.showAlert('دورك الآن!', 'success');
      } else if (notif.type === 'NEAR_TURN') {
        this.showAlert('دورك قريب', 'info');
      }
    });
  }
}
```

---

#### 8. نظام التقارير
**الوقت المتوقع:** 3-4 ساعات  
**الأولوية:** متوسطة  
**التعقيد:** عالي

**الحل البديل:** توليد التقارير في Frontend

```javascript
// في Frontend: src/utils/report-generator.js

export async function generateDailyReport(date) {
  // 1. جلب جميع البيانات من KV
  const pins = await fetch(`/api/v1/pin/all/status?date=${date}`);
  const queues = await fetch(`/api/v1/queue/all/status?date=${date}`);
  
  // 2. معالجة البيانات
  const report = {
    date,
    total_pins_issued: pins.total,
    patients_served: queues.done_count,
    avg_wait_time: queues.avg_wait_minutes,
    clinics: {
      lab: { ... },
      xray: { ... },
      general: { ... }
    }
  };
  
  // 3. توليد CSV
  const csv = convertToCSV(report);
  
  // 4. تحميل الملف
  downloadFile(csv, `report-${date}.csv`);
}
```

---

#### 9. Admin Dashboard
**الوقت المتوقع:** 4-6 ساعات  
**الأولوية:** منخفضة  
**التعقيد:** عالي

**الحل البسيط:** صفحة HTML واحدة

```html
<!-- في: public/admin.html -->
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <title>لوحة التحكم - MMC-MMS</title>
</head>
<body>
  <h1>لوحة التحكم</h1>
  
  <section>
    <h2>إعادة تعيين PINs</h2>
    <select id="clinic">
      <option value="lab">المختبر</option>
      <option value="xray">الأشعة</option>
      <option value="general">العيادة العامة</option>
    </select>
    <button onclick="resetPins()">إعادة تعيين</button>
  </section>
  
  <section>
    <h2>نداء التالي</h2>
    <button onclick="callNext()">نداء التالي</button>
  </section>
  
  <script>
    async function resetPins() {
      const clinic = document.getElementById('clinic').value;
      const response = await fetch(
        `/api/v1/pin/${clinic}/status?action=reset`
      );
      const data = await response.json();
      alert(data.message);
    }
    
    async function callNext() {
      const clinic = document.getElementById('clinic').value;
      const response = await fetch(
        `/api/v1/queue/${clinic}/status?action=call`
      );
      const data = await response.json();
      alert(`تم نداء: ${data.current.pin}`);
    }
  </script>
</body>
</html>
```

---

## 📅 الجدول الزمني المقترح

### اليوم 1 (2-3 ساعات)
- ✅ إصلاح session_code (5 دقائق)
- ✅ إصلاح success و status (5 دقائق)
- ✅ إضافة Queue Call و Done (45 دقيقة)
- ✅ إضافة Notify Dispatch (30 دقيقة)
- ✅ إضافة PIN Reset (20 دقيقة)
- ✅ اختبار شامل (30 دقيقة)
- ✅ نشر وتحديث (15 دقيقة)

**النتيجة:** 95% مكتمل

### اليوم 2 (3-4 ساعات)
- ✅ إصلاح Path Engine (30 دقيقة)
- ✅ إضافة Polling للإشعارات (1 ساعة)
- ✅ إنشاء Admin Dashboard بسيط (1 ساعة)
- ✅ إضافة توليد التقارير في Frontend (1 ساعة)
- ✅ اختبار نهائي شامل (30 دقيقة)

**النتيجة:** 100% مكتمل

---

## ✅ معايير القبول النهائية

### يجب أن يعمل بنسبة 100%:

#### 1. نظام PIN
- ✅ إصدار PIN جديد
- ✅ session_code صحيح
- ✅ Idempotency يعمل
- ✅ عرض الحالة
- ✅ إعادة التعيين

#### 2. نظام Queue
- ✅ الدخول في الدور
- ✅ عرض الحالة
- ✅ نداء التالي
- ✅ إنهاء الخدمة
- ✅ حساب أوقات الانتظار

#### 3. نظام المسارات
- ✅ اختيار العيادة المناسبة
- ✅ الأوزان الديناميكية
- ✅ منطق النساء (no-PIN)

#### 4. نظام الإشعارات
- ✅ إرسال إشعارات
- ✅ استقبال إشعارات (Polling)
- ✅ أنواع مختلفة
- ✅ أولويات

#### 5. نظام التقارير
- ✅ تقرير يومي
- ✅ تقرير أسبوعي
- ✅ تقرير شهري
- ✅ تقرير مخصص
- ✅ صيغة JSON
- ✅ صيغة CSV

#### 6. لوحة التحكم
- ✅ تسجيل دخول
- ✅ إعادة تعيين PINs
- ✅ نداء التالي
- ✅ عرض الإحصائيات

---

## 🎯 الخلاصة

**الوقت الإجمالي المتوقع:** 5-7 ساعات  
**التعقيد:** متوسط  
**المخاطر:** منخفضة

**الطريقة الموصى بها:**
1. البدء بالإصلاحات السريعة (10 دقائق)
2. إضافة الوظائف المتوسطة (2-3 ساعات)
3. إضافة الحلول البديلة للوظائف المتقدمة (2-3 ساعات)
4. اختبار شامل نهائي (1 ساعة)

**النتيجة المتوقعة:** نظام كامل 100% وظيفي بدون أي نقص.

---

**تاريخ الخطة:** 19 أكتوبر 2025  
**الحالة الحالية:** 85%  
**الهدف:** 100%  
**الموعد المستهدف:** خلال 1-2 يوم عمل

