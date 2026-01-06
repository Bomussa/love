# 🚨 إشعار: النشر مطلوب

## الوضع الحالي

✅ **تم إنشاء الكود بالكامل** (100%)  
⚠️ **لم يتم النشر بعد** على Supabase

### لماذا فشلت الاختبارات؟

جميع الاختبارات أرجعت `404` لأن الـFunctions لم تُنشر بعد على Supabase. الملفات موجودة محليًا فقط.

---

## 🎯 خياران للنشر

### الخيار 1: النشر من جهازك المحلي ⭐ (مُوصى به)

```bash
# 1. استنساخ المستودع
git clone https://github.com/Bomussa/love.git
cd love

# 2. تثبيت Supabase CLI
# macOS/Linux:
brew install supabase/tap/supabase

# Windows:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 3. التسجيل
supabase login

# 4. الربط بالمشروع
supabase link --project-ref rujwuruuosffcxazymit

# 5. نشر Functions
supabase functions deploy queue-enter --no-verify-jwt
supabase functions deploy queue-status --no-verify-jwt
supabase functions deploy queue-call --no-verify-jwt
supabase functions deploy pin-generate --no-verify-jwt
supabase functions deploy pin-verify --no-verify-jwt
supabase functions deploy pin-status --no-verify-jwt
supabase functions deploy reports-daily --no-verify-jwt
supabase functions deploy stats-dashboard --no-verify-jwt

# 6. التحقق
supabase functions list
```

---

### الخيار 2: النشر عبر لوحة Supabase Dashboard 📊

بما أن CLI لا يعمل في بيئة Codespaces، يمكنك نشر Functions يدويًا:

#### الخطوة 1: فتح لوحة Supabase
1. اذهب إلى: https://supabase.com/dashboard/project/rujwuruuosffcxazymit
2. اضغط **Edge Functions** من القائمة الجانبية

#### الخطوة 2: إنشاء Function يدويًا
لكل Function من القائمة أدناه:

##### Functions المطلوبة (8):
1. **queue-enter** → `/workspaces/love/supabase/functions/queue-enter/index.ts`
2. **queue-status** → `/workspaces/love/supabase/functions/queue-status/index.ts`
3. **queue-call** → `/workspaces/love/supabase/functions/queue-call/index.ts`
4. **pin-generate** → `/workspaces/love/supabase/functions/pin-generate/index.ts`
5. **pin-verify** → `/workspaces/love/supabase/functions/pin-verify/index.ts`
6. **pin-status** → `/workspaces/love/supabase/functions/pin-status/index.ts`
7. **reports-daily** → `/workspaces/love/supabase/functions/reports-daily/index.ts`
8. **stats-dashboard** → `/workspaces/love/supabase/functions/stats-dashboard/index.ts`

#### الخطوة 3: نسخ الكود
1. اضغط **New Edge Function**
2. اسم الوظيفة: `queue-enter` (مثلاً)
3. انسخ محتوى ملف `/workspaces/love/supabase/functions/queue-enter/index.ts`
4. الصقه في محرر الكود
5. اضغط **Deploy**
6. كرر لكل وظيفة

---

## 📋 خطوات ما بعد النشر

### 1. تطبيق Migration للـDatabase

افتح **SQL Editor** في لوحة Supabase وشغّل:

```sql
-- نسخ محتوى الملف التالي:
-- /workspaces/love/supabase/migrations/002_add_pins_and_reports.sql
```

### 2. ضبط Secrets

في **Settings → Edge Functions → Secrets**، أضف:

```
SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

احصل على `SUPABASE_SERVICE_ROLE_KEY` من:
**Settings → API → service_role key**

### 3. تفعيل Realtime

في **Database → Replication**:
- فعّل `queues`
- فعّل `notifications`
- فعّل `pins`

في Publication: `supabase_realtime`

---

## ✅ التحقق من النجاح

بعد النشر، جرب:

```bash
# اختبار مباشر على Supabase
curl https://rujwuruuosffcxazymit.functions.supabase.co/queue-status?clinic_id=lab

# اختبار عبر الدومين (مع Rewrite)
curl https://mmc-mms.com/api/queue-status?clinic_id=lab

# اختبار شامل
cd /workspaces/love
node scripts/smoke-test.mjs
```

إذا رجعت `200 OK` مع JSON → ✅ **نجح النشر!**

---

## 📖 ملفات مساعدة

| الملف | الوصف |
|-------|-------|
| `scripts/manual-deploy-guide.sh` | دليل الأوامر بالترتيب |
| `DEPLOYMENT_GUIDE.md` | دليل مفصل خطوة بخطوة |
| `FINAL_REPORT.md` | تقرير تقني كامل |

---

## 🆘 المساعدة

إذا واجهت مشاكل:

1. **تحقق من الـLogs**:
   ```bash
   supabase functions logs <function-name> --tail
   ```

2. **تحقق من CORS**:
   كل Function يجب أن تحتوي:
   ```ts
   const corsHeaders = {
     "access-control-allow-origin": "https://mmc-mms.com",
     // ...
   };
   ```

3. **تحقق من Secrets**:
   ```bash
   supabase secrets list
   ```

---

**📅 الآن:** يجب نشر Functions لإتمام التكامل  
**⏱️ الوقت المتوقع:** 10-15 دقيقة (نشر يدوي)، 2-3 دقائق (عبر CLI)  
**🎯 النتيجة:** نظام كامل جاهز 100%
