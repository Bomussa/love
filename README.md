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

## التحقق الوزني لحالة الاستعادة (Weighted Recovery Gate)

السكربت `scripts/verify-recovery-state.mjs` ينفذ فحوصات موزونة (weights) على خمس فئات:

- `project_settings` (وزن 20)
- `domains` (وزن 25)
- `env_vars` (وزن 25)
- `api_health` (وزن 20)
- `content_equivalence` (وزن 10)

المعادلة المستخدمة:

```text
success_rate = (passed_weight / total_weight) * 100
failure_rate = 100 - success_rate
```

بوابة القبول (gate) تنجح فقط إذا تحقق الشرطان معًا:

```text
success_rate >= MIN_SUCCESS_RATE   (الافتراضي: 98)
failure_rate <= MAX_FAILURE_RATE   (الافتراضي: 2)
```

عند عدم تحقق البوابة، يخرج السكربت بـ `exit code = 1` ويطبع تقرير JSON نهائيًا يتضمن كل check مع وزنه وحالته.

مثال تشغيل:

```bash
VERCEL_TOKEN=... VERCEL_PROJECT_ID=... \
MIN_SUCCESS_RATE=98 MAX_FAILURE_RATE=2 \
node scripts/verify-recovery-state.mjs
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
