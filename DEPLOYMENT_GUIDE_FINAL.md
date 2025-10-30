# دليل النشر الكامل - Military Medical Committee System

## 📋 المتطلبات

### 1. Supabase CLI
```bash
# تثبيت Supabase CLI
brew install supabase/tap/supabase

# أو عبر npm
npm install -g supabase

# التحقق من التثبيت
supabase --version
```

### 2. تسجيل الدخول
```bash
# تسجيل الدخول إلى Supabase
supabase login

# ربط المشروع
cd /path/to/love
supabase link --project-ref rujwuruuosffcxazymit
```

## 🚀 خطوات النشر

### الخطوة 1: نشر Database Schema
```bash
cd /path/to/love

# تطبيق Schema
supabase db push

# أو استخدام SQL مباشرة
psql -h db.rujwuruuosffcxazymit.supabase.co \
  -U postgres \
  -d postgres \
  -f supabase/schema.sql
```

### الخطوة 2: نشر Edge Functions

#### نشر جميع Functions دفعة واحدة
```bash
cd /path/to/love

# نشر جميع Functions
supabase functions deploy
```

#### أو نشر Functions واحدة تلو الأخرى
```bash
# Core Functions
supabase functions deploy health
supabase functions deploy patient-login
supabase functions deploy admin-login

# Queue Management
supabase functions deploy queue-enter
supabase functions deploy queue-status
supabase functions deploy queue-call
supabase functions deploy queue-done
supabase functions deploy queue-position
supabase functions deploy queue-cancel

# PIN Management
supabase functions deploy pin-generate
supabase functions deploy pin-status
supabase functions deploy pin-verify

# Admin Functions
supabase functions deploy admin-status
supabase functions deploy admin-set-call-interval
supabase functions deploy clinic-exit

# Statistics & Reports
supabase functions deploy stats-dashboard
supabase functions deploy stats-queues
supabase functions deploy reports-daily
supabase functions deploy reports-weekly
supabase functions deploy reports-monthly
supabase functions deploy reports-annual

# Routing & Events
supabase functions deploy route-create
supabase functions deploy route-get
supabase functions deploy path-choose
supabase functions deploy events-stream

# Notifications & Metrics
supabase functions deploy notify-status
supabase functions deploy metrics
```

### الخطوة 3: تكوين CORS Headers

لكل function، تأكد من وجود CORS headers:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### الخطوة 4: تكوين Environment Variables

في Supabase Dashboard → Settings → Edge Functions:
```
SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### الخطوة 5: اختبار Functions

```bash
# اختبار health endpoint
curl https://rujwuruuosffcxazymit.supabase.co/functions/v1/health

# اختبار مع authorization
curl -X POST https://rujwuruuosffcxazymit.supabase.co/functions/v1/patient-login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"patientId":"12345","gender":"male"}'
```

## 🔧 استكشاف الأخطاء

### مشكلة: 404 على Edge Functions
**الحل:**
```bash
# التحقق من Functions المنشورة
supabase functions list

# إعادة نشر Function محددة
supabase functions deploy FUNCTION_NAME --no-verify-jwt
```

### مشكلة: CORS Errors
**الحل:**
1. تأكد من وجود CORS headers في كل function
2. أضف `verify_jwt: false` للـ functions العامة
3. أعد نشر Function

```bash
supabase functions deploy FUNCTION_NAME --no-verify-jwt
```

### مشكلة: Database Connection Error
**الحل:**
```bash
# التحقق من Database status
supabase db status

# إعادة تشغيل Database
supabase db restart
```

## 📊 التحقق من النشر

### 1. التحقق من Edge Functions
```bash
# عرض جميع Functions
curl -X GET "https://api.supabase.com/v1/projects/rujwuruuosffcxazymit/functions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. التحقق من Database Tables
```bash
# الاتصال بـ Database
psql -h db.rujwuruuosffcxazymit.supabase.co -U postgres -d postgres

# عرض الجداول
\dt

# عرض جدول محدد
SELECT * FROM patients LIMIT 5;
```

### 3. اختبار Frontend
1. افتح https://mmc-mms.com
2. سجل دخول كـ admin (admin/admin123)
3. اذهب إلى "إدارة الأرقام السرية"
4. انقر على "+ إضافة PIN"
5. يجب أن يظهر PIN code جديد

## ✅ قائمة التحقق النهائية

- [ ] Supabase CLI مثبت
- [ ] تم تسجيل الدخول إلى Supabase
- [ ] تم ربط المشروع
- [ ] تم نشر Database Schema
- [ ] تم نشر جميع الـ 27 Edge Functions
- [ ] تم اختبار CORS headers
- [ ] تم اختبار PIN generation
- [ ] تم اختبار Queue management
- [ ] تم اختبار Reports
- [ ] Frontend يعمل بدون أخطاء 404

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من Supabase Logs: Dashboard → Logs → Edge Functions
2. تحقق من Browser Console للأخطاء
3. راجع هذا الدليل خطوة بخطوة

---

**آخر تحديث:** 30 أكتوبر 2025  
**الإصدار:** 3.1.0  
**الحالة:** ✅ Ready for Deployment
