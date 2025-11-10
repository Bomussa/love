# 🚀 دليل النشر والتشغيل السريع
## نظام اللجنة الطبية - MMC-MMS

---

## 📋 المتطلبات الأساسية

### 1. أدوات التطوير
```bash
# Supabase CLI
npm install -g supabase

# Node.js & npm (v18+)
node --version
npm --version

# Git
git --version
```

### 2. حساب Supabase
- معرف المشروع: `rujwuruuosffcxazymit`
- URL: `https://rujwuruuosffcxazymit.supabase.co`

### 3. متغيرات البيئة

**في Supabase (Secrets للـFunctions):**
```bash
SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**في Vercel (Frontend فقط):**
```bash
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 🔧 خطوات النشر

### الخطوة 1: تطبيق Schema (أول مرة فقط)

```bash
# الاتصال بمشروع Supabase
cd /workspaces/love
supabase login
supabase link --project-ref rujwuruuosffcxazymit

# تطبيق الـSchema الأساسي
supabase db push

# أو استخدم SQL Editor في لوحة Supabase وشغّل:
# 1. supabase/schema.sql (الجداول الأساسية)
# 2. supabase/migrations/002_add_pins_and_reports.sql (PINs + Views)
```

### الخطوة 2: نشر Functions

```bash
# نشر تلقائي لجميع الوظائف
./scripts/deploy-functions.sh

# أو نشر يدوي لوظيفة واحدة
supabase functions deploy api-v1-status --no-verify-jwt
supabase functions deploy queue-enter --no-verify-jwt
# ... إلخ
```

### الخطوة 3: تفعيل Realtime

في لوحة Supabase:
1. اذهب إلى **Database → Replication**
2. فعّل `queues`, `notifications`, `pins` للـPublication: `supabase_realtime`

### الخطوة 4: نشر Frontend على Vercel

```bash
# التأكد من إعدادات Vercel
cd frontend
vercel --prod

# أو من GitHub (Auto Deploy)
git push origin main
```

---

## ✅ التحقق من النشر

### 1. اختبار Health Endpoint
```bash
curl -i https://mmc-mms.com/api/api-v1-status

# يجب أن يرجع:
# HTTP/2 200
# {"ok":true,"service":"love-api (supabase)","time":"..."}
```

### 2. اختبار Queue System
```bash
# دخول الدور
curl -X POST https://mmc-mms.com/api/queue-enter \
  -H "Content-Type: application/json" \
  -d '{"clinic_id":"lab","patient_id":"test-123"}'

# حالة الدور
curl "https://mmc-mms.com/api/queue-status?clinic_id=lab"

# استدعاء التالي
curl -X POST https://mmc-mms.com/api/queue-call \
  -H "Content-Type: application/json" \
  -d '{"clinic_id":"lab"}'
```

### 3. اختبار PIN System
```bash
# توليد PIN
curl -X POST https://mmc-mms.com/api/pin-generate \
  -H "Content-Type: application/json" \
  -d '{"clinic_id":"eyes"}'

# التحقق من PIN
curl -X POST https://mmc-mms.com/api/pin-verify \
  -H "Content-Type: application/json" \
  -d '{"clinic_id":"eyes","pin":"123456"}'

# حالة PINs
curl "https://mmc-mms.com/api/pin-status?clinic_id=eyes"
```

### 4. اختبار Reports
```bash
# تقرير يومي (JSON)
curl "https://mmc-mms.com/api/reports-daily?date=2025-11-10"

# تقرير يومي (HTML للطباعة)
curl "https://mmc-mms.com/api/reports-daily?date=2025-11-10&format=print"

# لوحة الإحصاءات
curl "https://mmc-mms.com/api/stats-dashboard"
```

### 5. اختبار شامل
```bash
cd tests
node test-all-features.mjs
```

---

## 🔍 استكشاف الأخطاء

### المشكلة: 404 على /api/*
**الحل:**
1. تحقق من `vercel.json` في `/frontend`:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://rujwuruuosffcxazymit.functions.supabase.co/:path*"
       }
     ]
   }
   ```
2. تأكد من نشر الـFunction على Supabase:
   ```bash
   supabase functions list
   ```

### المشكلة: CORS Error
**الحل:**
- تحقق أن كل Function تحوي:
  ```ts
  const corsHeaders = {
    "access-control-allow-origin": "https://mmc-mms.com",
    // ...
  };
  ```
- تعامل مع OPTIONS:
  ```ts
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  ```

### المشكلة: Database Connection Error
**الحل:**
1. تأكد من إضافة Secrets في Supabase:
   - `Settings → Edge Functions → Secrets`
2. أضف: `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY`

### المشكلة: Realtime لا يعمل
**الحل:**
1. في لوحة Supabase: `Database → Replication`
2. فعّل الجداول المطلوبة في `supabase_realtime` publication
3. أعد تشغيل الفرونت

---

## 📊 مراقبة النظام

### Logs في Supabase
```bash
# متابعة logs مباشرة
supabase functions logs api-v1-status --tail

# logs محددة
supabase functions logs queue-enter --limit 50
```

### Metrics في Vercel
- **Vercel Dashboard → Analytics**
- راقب: Response Time, Error Rate, Request Count

### Database Monitoring
```sql
-- عدد الطوابير النشطة
SELECT COUNT(*) FROM queues WHERE status IN ('waiting','serving');

-- عدد الزيارات اليوم
SELECT COUNT(*) FROM queues WHERE DATE(entered_at) = CURRENT_DATE;

-- متوسط وقت الانتظار
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - entered_at)))/60 as avg_minutes
FROM queues
WHERE status = 'completed' AND DATE(entered_at) = CURRENT_DATE;
```

---

## 🎯 الميزات الخمس المكتملة

| # | الميزة | الوظائف | الحالة |
|---|--------|---------|--------|
| 1 | **نظام الدور (Queue)** | `queue-enter`, `queue-status`, `queue-call` | ✅ |
| 2 | **نظام PIN** | `pin-generate`, `pin-verify`, `pin-status` | ✅ |
| 3 | **الإشعارات الفورية** | Realtime على `notifications`, `queues` | ✅ |
| 4 | **المسارات الديناميكية** | منطق داخلي في `queue-enter` + جدول `pathways` | ✅ |
| 5 | **التقارير والإحصاءات** | `reports-daily`, `stats-dashboard` + Views | ✅ |

---

## 📞 الدعم

- **الوثائق**: `/docs` في المستودع
- **الأخطاء**: أنشئ Issue على GitHub
- **الأسئلة**: راجع `/.github/copilot-instructions.md`

---

**✨ تم إعداد هذا الدليل بواسطة GitHub Copilot**
**📅 آخر تحديث: 2025-11-10**
