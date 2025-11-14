# تعليمات Copilot لمشروع الواجهة `love/`

هذه الإرشادات مختصرة وعملية لتسريع إنتاجية الوكلاء داخل مجلد الواجهة `love/` وفق بنية Supabase + Vercel الحالية.

## النطاق والقواعد الأساسية
- ممنوع تعديل واجهة المستخدم أو الأصول: لا تغييرات على `src/styles/`, `src/components/ui/`, `public/`, `src/assets/` (محمية عبر Workflow).
- لا تُنشئ Functions على Vercel؛ كل الـ API عبر Supabase Edge Functions فقط.
- لا تُفصح عن مفاتيح الخدمة في الواجهة؛ استخدم فقط مفاتيح Supabase `anon`.
- إصدارات Node: `>=18.17 <21` (استخدم Node 20).

## الملفات المسموح تعديلها (frontend)
- `src/core/event-bus.js`: اتصال SSE واحد فقط، يُطلق أحداث: `sse:connected`, `sse:error`, `queue:update`, ...
- `src/lib/api-base.js`: الدالة `getApiBase()` تُرجع `${origin}/api/v1` مع احترام `VITE_API_BASE` أثناء التطوير.
- `vite.config.js`: بروكسي التطوير لتمرير `/api` و`/api/v1/events/stream` إلى `VITE_API_BASE` مع `Cache-Control: no-cache` للـ SSE.
- `vercel.json`: Rewrites من مسارات الواجهة إلى Functions في Supabase.
- `.env.local.example`: عرّف `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE` (للتطوير فقط).
- `scripts/test/vercel-health-check.js` وملفات CI ذات الصلة عند الحاجة.

## أنماط التكامل المهمة
- REST/SSE: ابنِ جميع العناوين على `getApiBase()`؛ لا تُصلّب الـ origin يدويًا.
- SSE: استخدم `new EventSource(`${getApiBase()}/events/stream`)` عبر `event-bus.js`؛ لا تفتح أكثر من اتصال.
- Rewrites (الإنتاج) في `vercel.json`:
  - `/api/v1/events/stream` → `https://<REF>.functions.supabase.co/events-stream`
  - `/api/v1/:path*` → `https://<REF>.functions.supabase.co/api-router?path=:path*`

## أوامر التطوير والاختبار (PowerShell)
```powershell
# تشغيل Vite (واجهة فقط)
cd love; pnpm install; pnpm dev:vite

# تطوير مع بروكسي إلى الـ API المحلي
cd love; $env:VITE_API_BASE="http://localhost:3000"; pnpm dev:vite

# البناء والمعاينة
cd love; pnpm build; pnpm preview

# فحص الصحة بعد التشغيل/النشر
cd love; $env:DEPLOY_URL="http://localhost:5173"; node scripts/test/vercel-health-check.js
```

## مراجع سريعة داخل المشروع
- إعداد rewrites: `love/vercel.json`
- بروكسي التطوير: `love/vite.config.js`
- ناقل الأحداث + SSE: `love/src/core/event-bus.js`
- مُحدد قاعدة الـ API: `love/src/lib/api-base.js`
- عملاء الـ API: `love/src/lib/api.js`, `love/src/lib/api-unified.js`

## ملاحظات أمان وسياسات
- أزلنا أي نص سابق يشير إلى تجاوز الصلاحيات أو السياسات. التزم دائمًا بسياسات المستودع وCI.
- لا تُدرج أسرارًا حقيقية في الشيفرة أو سجل التشغيل؛ استخدم نماذج `.env.local.example` بقيم Placeholder.

—
عند الحاجة لتوسع في أي جزء (ميزة/ملف/نقطة تكامل)، اذكر المطلوب بدقة وسنضيف تفاصيل تدفق العمل المناسبة.