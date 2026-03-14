# دليل الاستعادة التشغيلية (Vercel + Supabase)

هذا الدليل يعيد مشروع **love** إلى حالة عمل آمنة بعد الحذف/فقدان الإعدادات، مع التحقق من:

- ربط النطاقين `mmc-mms.com` و `www.mmc-mms.com`.
- وجود متغيرات البيئة الإلزامية في Vercel.
- سلامة Rewrite من `/api/*` إلى خدمة الـ API.
- نجاح فحوصات الدومين والـ API بعد النشر.

> مهم: لا تحفظ أي سر داخل Git. استخدم لوحة Vercel/Supabase أو CLI فقط.

---

## 1) استعادة إعدادات Vercel الأساسية

1. اربط المشروع:

```bash
vercel link
```

2. تأكد من إعدادات البناء حسب `vercel.json`:
   - Build Command: `cd frontend && npm install && npm run build`
   - Output Directory: `frontend/dist`
   - Framework: `vite`

3. تأكد من وجود redirect:
   - `www.mmc-mms.com` ⟶ `https://mmc-mms.com/:path*`

4. تأكد من rewrite:
   - `/api/(.*)` ⟶ `https://love-api-bomussa.vercel.app/api/$1`

---

## 2) استعادة الأسرار في Vercel (بدون كشف القيم)

أضف المتغيرات التالية لكل البيئات المطلوبة (Production/Preview/Development بحسب الاستخدام):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

أوامر CLI مثال:

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

> ملاحظة: لا تطبع القيم في السجل، وأعد النشر بعد أي تعديل أسرار.

---

## 3) استعادة أسرار Supabase Functions

في لوحة Supabase (Project Settings → Edge Functions Secrets) تأكد من وجود:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

ثم أعد نشر الدوال:

```bash
supabase functions deploy api-v1-status --no-verify-jwt
supabase functions deploy queue-call --no-verify-jwt
supabase functions deploy queue-status --no-verify-jwt
supabase functions deploy pin-generate --no-verify-jwt
supabase functions deploy pin-status --no-verify-jwt
supabase functions deploy reports-daily --no-verify-jwt
```

---

## 4) فحص آلي سريع لحالة الاستعادة

تم إضافة سكربت:

```bash
node scripts/verify-recovery-state.mjs
```

المتغيرات اللازمة قبل التشغيل:

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID` (اختياري)

السكربت يتحقق من:
- `vercel.json` المحلي (redirect + rewrite)
- النطاقات داخل مشروع Vercel
- وجود مفاتيح البيئة الإلزامية (أسماء فقط)
- سلوك redirect للدومين `www`
- توفر endpoint `/api/api-v1-status`

---

## 5) قبول النشر (Go/No-Go)

**Go** عندما:
- كل الفحوصات الآلية تمر.
- `www` يعيد توجيه دائم/مؤقت إلى النطاق الأساسي.
- الصفحة الرئيسية وواجهة الإدارة تعملان دون أخطاء Console حرجة.
- API health endpoint يرجع استجابة سليمة (<500).

**No-Go** عندما:
- أي سر إلزامي مفقود.
- `www` لا يعيد التوجيه.
- أي endpoint أساسي يرجع 5xx.

