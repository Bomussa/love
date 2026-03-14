# love (MMC-MMS)

تطبيق MMC-MMS مبني كبنية Monorepo بسيطة:

- `frontend/`: واجهة React/Vite المنشورة على Vercel.
- `supabase/functions/`: الواجهة الخلفية الفعلية (Supabase Edge Functions).
- `supabase/migrations/`: ملفات ترحيل قاعدة البيانات.

## ملاحظة مهمة عن الـ API

لا توجد حزمة `api/` محلية داخل هذا المستودع. المسارات `/api/*` في الواجهة تعتمد على External Rewrite (في `vercel.json`) لتوجيه الطلبات إلى Supabase Functions.

## أوامر سريعة

```bash
npm run dev
npm run test
npm run ci:resilient
```

## التحقق من الصحة

```bash
curl https://mmc-mms.com/api/api-v1-status
```


## إعداد Vercel الصحيح (استعادة النشر)

لضمان أن المشروع يعمل بنفس بنية GitHub الحالية، استخدم الإعدادات التالية **حرفيًا** داخل Vercel Project Settings:

- Root Directory: `/` (جذر المستودع)
- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `cd frontend && npm install && npm run build`
- Output Directory: `frontend/dist`
- Node.js Version: `20.x`

> تنبيه: لا تضبط Root Directory على `frontend` مع Build Command الذي يحتوي `cd frontend`.

### فحص سريع بعد أي تعديل إعدادات

```bash
npm run build --workspace frontend
curl -I https://mmc-mms.com
curl -I https://www.mmc-mms.com
```

النتيجة المتوقعة:
- بناء الواجهة يكتمل بنجاح.
- `www.mmc-mms.com` يعيد التوجيه إلى `mmc-mms.com`.

## فحص الاستعادة: Redirect مقابل Domain Equivalence

سكريبت `scripts/verify-recovery-state.mjs` يدعم نمطين:

- **Redirect Check (الوضع الافتراضي):**
  - يتحقق أن `www.mmc-mms.com` يعيد التوجيه (3xx) إلى النطاق الأساسي.
  - مناسب كفحص سريع عندما يهمنا صحة إعدادات الدومين/التوجيه.

- **Strict Domain Equivalence (`STRICT_DOMAIN_EQUIVALENCE=1`):**
  - ينفّذ `fetch` على `https://mmc-mms.com` و `https://www.mmc-mms.com` مع `redirect: 'follow'`.
  - يقارن بين:
    - `final URL host`
    - `status`
    - `<title>`
    - وجود عنصر الجذر (`id="root"`)
  - إذا منع WAF قراءة المحتوى، يعود تلقائيًا إلى فحص redirect فقط (fallback).

مثال تشغيل:

```bash
# فحص redirect فقط
VERCEL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/verify-recovery-state.mjs

# فحص التكافؤ الصارم بين apex و www
STRICT_DOMAIN_EQUIVALENCE=1 VERCEL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/verify-recovery-state.mjs
```

مخرجات السكربت تتضمن تقرير JSON نهائي يحتوي على:
- `redirect_ok`
- `content_equivalent`
- `failure_reason` (عند الفشل)


## تنفيذ الاستعادة الآلية (Vercel API)

تم إضافة سكربت تشغيلي: `scripts/vercel-recover-deploy.mjs` للتحقق/التطبيق الفعلي لإعدادات الاستعادة على مشروع Vercel الحالي.

```bash
# 1) تحقق فقط
VERCEL_TOKEN=... VERCEL_PROJECT_ID=prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM VERCEL_TEAM_ID=... \
node scripts/vercel-recover-deploy.mjs --check

# 2) تطبيق الإعدادات + نشر إنتاجي + انتظار النتيجة
VERCEL_TOKEN=... VERCEL_PROJECT_ID=prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM VERCEL_TEAM_ID=... \
node scripts/vercel-recover-deploy.mjs --apply --redeploy --wait
```

يشمل السكربت التحقق من:
- `framework`, `rootDirectory`, `installCommand`, `buildCommand`, `outputDirectory`, `nodeVersion`.
- وجود الدومينات: `mmc-mms.com` و `www.mmc-mms.com`.
- دعم نشر Production تلقائيًا عند وجود Git linking.
