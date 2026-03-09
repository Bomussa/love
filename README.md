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
