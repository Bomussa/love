# ✅ قائمة الإجراءات التقنية للنشر والتشغيل

**الهدف:** ضمان أن جميع طلبات API من Frontend تعمل بنجاح وتظهر البيانات على الشاشة.

---

## 🎯 الإجراءات المطلوبة (خطوة بخطوة)

### المرحلة 1: رفع الكود على GitHub ✅

```bash
# 1. الانتقال إلى مجلد المشروع
cd /home/ubuntu/love

# 2. إضافة جميع الملفات الجديدة
git add .

# 3. عمل commit
git commit -m "feat: Add complete Supabase Edge Functions + Database Schema + Endpoint Mapping Guide

- ✅ 24 Edge Functions (health, patient-login, queue-*, pin-*, admin-*, stats-*, reports-*, route-*, clinic-exit, events-stream)
- ✅ Complete Database Schema (12 tables with indexes, triggers, RLS)
- ✅ Endpoint Mapping Guide (توجيه نقطة الاتصال)
- ✅ Deployment Checklist
- ✅ Ready for production"

# 4. رفع على GitHub
git push origin main
```

---

### المرحلة 2: التحقق من Vercel Configuration ✅

**الملف:** `vercel.json`

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/v1/(.*)",
      "destination": "https://rujwuruuosffcxazymit.supabase.co/functions/v1/$1"
    }
  ]
}
```

**التحقق:**
```bash
# 1. التأكد من وجود الملف
cat vercel.json

# 2. التأكد من صحة JSON
cat vercel.json | jq .
```

---

### المرحلة 3: إعداد Environment Variables على Vercel ✅

**الخطوات:**

1. اذهب إلى: https://vercel.com/dashboard
2. اختر المشروع: `love` أو `mmc-mms`
3. اذهب إلى: `Settings` → `Environment Variables`
4. أضف المتغيرات التالية:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>

# Optional: API Base (للتطوير فقط)
VITE_API_BASE=https://mmc-mms.com/api/v1
```

**كيفية الحصول على ANON_KEY:**

1. اذهب إلى: https://supabase.com/dashboard/project/rujwuruuosffcxazymit/settings/api
2. انسخ `anon public` key

---

### المرحلة 4: نشر Database Schema على Supabase ✅

**الطريقة 1: عبر Supabase Dashboard**

1. اذهب إلى: https://supabase.com/dashboard/project/rujwuruuosffcxazymit/editor
2. افتح `SQL Editor`
3. انسخ محتوى ملف `supabase/schema.sql`
4. الصق في SQL Editor
5. اضغط `Run`

**الطريقة 2: عبر Supabase CLI**

```bash
# 1. تسجيل الدخول
supabase login

# 2. ربط المشروع
supabase link --project-ref rujwuruuosffcxazymit

# 3. تطبيق Schema
supabase db push

# أو تنفيذ SQL مباشرة
supabase db execute --file supabase/schema.sql
```

**التحقق:**

```bash
# عرض الجداول
supabase db list
```

---

### المرحلة 5: نشر Edge Functions على Supabase ✅

**قائمة Functions المطلوبة (24 function):**

1. health
2. patient-login
3. queue-enter
4. queue-status
5. queue-call
6. queue-done
7. queue-position
8. queue-cancel
9. pin-generate
10. pin-status
11. pin-verify
12. admin-login
13. admin-status
14. clinic-exit
15. stats-dashboard
16. stats-queues
17. route-create
18. route-get
19. path-choose
20. events-stream
21. reports-daily
22. reports-weekly
23. reports-monthly
24. reports-annual

**الطريقة 1: نشر جميع Functions دفعة واحدة**

```bash
# 1. الانتقال إلى مجلد المشروع
cd /home/ubuntu/love

# 2. نشر جميع Functions
supabase functions deploy

# سيتم نشر جميع المجلدات في supabase/functions/
```

**الطريقة 2: نشر Function واحدة**

```bash
# نشر health function
supabase functions deploy health

# نشر patient-login function
supabase functions deploy patient-login

# ... وهكذا لجميع Functions
```

**التحقق:**

```bash
# عرض جميع Functions المنشورة
supabase functions list
```

---

### المرحلة 6: إعادة نشر Frontend على Vercel ✅

**الطريقة 1: عبر Git Push (تلقائي)**

```bash
# بعد رفع الكود على GitHub، Vercel سيقوم بالنشر تلقائياً
git push origin main

# راقب النشر على:
# https://vercel.com/dashboard
```

**الطريقة 2: عبر Vercel CLI**

```bash
# 1. تسجيل الدخول
vercel login

# 2. نشر
vercel --prod

# سيتم build و deploy تلقائياً
```

**الطريقة 3: عبر Vercel Dashboard**

1. اذهب إلى: https://vercel.com/dashboard
2. اختر المشروع
3. اذهب إلى: `Deployments`
4. اضغط `Redeploy`

---

### المرحلة 7: اختبار شامل لجميع Endpoints ✅

**اختبار 1: Health Check**

```bash
# اختبار مباشر من Supabase
curl https://rujwuruuosffcxazymit.supabase.co/functions/v1/health

# اختبار عبر Vercel Proxy
curl https://mmc-mms.com/api/v1/health

# النتيجة المتوقعة:
# {
#   "success": true,
#   "status": "healthy",
#   "backend": "up",
#   "platform": "supabase",
#   "version": "3.0.0"
# }
```

**اختبار 2: Patient Login**

```bash
curl -X POST https://mmc-mms.com/api/v1/patient-login \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "12345",
    "gender": "male"
  }'

# النتيجة المتوقعة:
# {
#   "success": true,
#   "data": { ... },
#   "message": "Login successful"
# }
```

**اختبار 3: Queue Enter**

```bash
curl -X POST https://mmc-mms.com/api/v1/queue-enter \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "12345",
    "clinic": "lab",
    "examType": "general"
  }'

# النتيجة المتوقعة:
# {
#   "success": true,
#   "position": 1,
#   "queueLength": 1,
#   "estimatedWait": 5
# }
```

**اختبار 4: Queue Status**

```bash
curl "https://mmc-mms.com/api/v1/queue-status?clinic=lab"

# النتيجة المتوقعة:
# {
#   "success": true,
#   "clinic": "lab",
#   "queueLength": 1,
#   "currentNumber": 0,
#   "patients": [ ... ]
# }
```

**اختبار 5: Stats Dashboard**

```bash
curl https://mmc-mms.com/api/v1/stats-dashboard

# النتيجة المتوقعة:
# {
#   "success": true,
#   "stats": {
#     "totalPatients": 0,
#     "activeQueues": 0,
#     "completedToday": 0,
#     "averageWaitTime": 0
#   }
# }
```

---

### المرحلة 8: اختبار من المتصفح ✅

**الخطوات:**

1. افتح: https://mmc-mms.com
2. افتح Console: `F12` → `Console`
3. نفذ الأوامر التالية:

```javascript
// اختبار 1: Health Check
fetch('https://mmc-mms.com/api/v1/health')
  .then(r => r.json())
  .then(d => console.log('✅ Health:', d))
  .catch(e => console.error('❌ Error:', e))

// اختبار 2: Patient Login
fetch('https://mmc-mms.com/api/v1/patient-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ patientId: '12345', gender: 'male' })
})
  .then(r => r.json())
  .then(d => console.log('✅ Login:', d))
  .catch(e => console.error('❌ Error:', e))

// اختبار 3: Queue Status
fetch('https://mmc-mms.com/api/v1/queue-status?clinic=lab')
  .then(r => r.json())
  .then(d => console.log('✅ Queue:', d))
  .catch(e => console.error('❌ Error:', e))
```

**النتيجة المتوقعة:**

```
✅ Health: {success: true, status: "healthy", ...}
✅ Login: {success: true, data: {...}, message: "Login successful"}
✅ Queue: {success: true, clinic: "lab", queueLength: 0, ...}
```

---

### المرحلة 9: اختبار UI الكامل ✅

**السيناريو الكامل:**

1. **افتح الموقع:** https://mmc-mms.com
2. **تسجيل دخول مريض:**
   - أدخل رقم المريض: `12345`
   - اختر الجنس: `ذكر`
   - اضغط `تسجيل الدخول`
3. **اختيار الفحص:**
   - اختر نوع الفحص: `تجنيد`
   - اضغط `التالي`
4. **دخول الطابور:**
   - اختر العيادة: `المختبر`
   - اضغط `دخول الطابور`
5. **التحقق من الرقم:**
   - يجب أن يظهر رقم الدور
   - يجب أن يظهر عدد المنتظرين
   - يجب أن يظهر الوقت المتوقع

**التحقق من Console:**

```
✅ API Call: /api/v1/patient-login → 200 OK
✅ API Call: /api/v1/queue-enter → 200 OK
✅ API Call: /api/v1/queue-status → 200 OK
✅ Data displayed on screen
```

---

### المرحلة 10: مراقبة الأخطاء ✅

**على Vercel:**

1. اذهب إلى: https://vercel.com/dashboard
2. اختر المشروع
3. اذهب إلى: `Logs`
4. راقب الأخطاء في Real-time

**على Supabase:**

1. اذهب إلى: https://supabase.com/dashboard/project/rujwuruuosffcxazymit/logs
2. اختر `Edge Functions`
3. راقب الأخطاء والطلبات

**في المتصفح:**

```javascript
// تفعيل Verbose Logging
localStorage.setItem('debug', 'true')

// مراقبة جميع API Calls
window.addEventListener('fetch', (e) => {
  console.log('🌐 API Call:', e.request.url)
})
```

---

## 🔧 استكشاف الأخطاء الشائعة

### خطأ 1: 404 Not Found

**السبب:**
- Vercel rewrites غير صحيحة
- Function name غير صحيح

**الحل:**
```bash
# 1. تحقق من vercel.json
cat vercel.json | grep rewrites

# 2. تحقق من Function names
ls supabase/functions/

# 3. أعد النشر
git push origin main
```

---

### خطأ 2: 500 Internal Server Error

**السبب:**
- Edge Function غير منشورة
- Database Schema غير موجود
- خطأ في الكود

**الحل:**
```bash
# 1. تحقق من Functions
supabase functions list

# 2. تحقق من Database
supabase db list

# 3. راجع Logs
# Supabase Dashboard → Logs → Edge Functions
```

---

### خطأ 3: CORS Error

**السبب:**
- CORS headers مفقودة في Edge Function

**الحل:**
```typescript
// في كل Edge Function، تأكد من وجود:
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}
```

---

### خطأ 4: Unauthorized

**السبب:**
- SUPABASE_ANON_KEY مفقود أو خاطئ

**الحل:**
```bash
# 1. تحقق من Environment Variables على Vercel
# Vercel Dashboard → Settings → Environment Variables

# 2. تحقق من القيمة
# Supabase Dashboard → Settings → API → anon public key

# 3. أعد النشر بعد التحديث
```

---

## ✅ قائمة التحقق النهائية

- [ ] **1. الكود على GitHub**
  ```bash
  git push origin main
  ```

- [ ] **2. Environment Variables على Vercel**
  - VITE_SUPABASE_URL ✅
  - VITE_SUPABASE_ANON_KEY ✅

- [ ] **3. Database Schema على Supabase**
  ```bash
  supabase db push
  ```

- [ ] **4. Edge Functions على Supabase**
  ```bash
  supabase functions deploy
  ```

- [ ] **5. Frontend على Vercel**
  ```bash
  vercel --prod
  ```

- [ ] **6. اختبار Health Check**
  ```bash
  curl https://mmc-mms.com/api/v1/health
  ```

- [ ] **7. اختبار Patient Login**
  ```bash
  curl -X POST https://mmc-mms.com/api/v1/patient-login -d '{"patientId":"12345","gender":"male"}'
  ```

- [ ] **8. اختبار Queue**
  ```bash
  curl https://mmc-mms.com/api/v1/queue-status?clinic=lab
  ```

- [ ] **9. اختبار UI من المتصفح**
  - افتح https://mmc-mms.com
  - سجل دخول مريض
  - ادخل الطابور
  - تحقق من ظهور البيانات

- [ ] **10. مراقبة Logs**
  - Vercel Logs ✅
  - Supabase Logs ✅
  - Browser Console ✅

---

## 🎯 النتيجة المتوقعة

بعد تنفيذ جميع الإجراءات أعلاه:

✅ **Frontend يعمل:** https://mmc-mms.com  
✅ **Backend يعمل:** Supabase Edge Functions  
✅ **Database يعمل:** PostgreSQL على Supabase  
✅ **API Calls تعمل:** جميع الـ 24 endpoint  
✅ **البيانات تظهر:** على الشاشة بدون أخطاء  
✅ **النظام جاهز:** للإنتاج مدى الحياة  

---

**آخر تحديث:** 30 أكتوبر 2025  
**الحالة:** ✅ Ready for Deployment
