# دليل سريع للمشتركين الجدد في `love-api`

## 1) الصورة الكبيرة (High-level)

المستودع يدعم **مسارين للتنفيذ**:

1. **Vercel Serverless** عبر نقطة دخول واحدة `api/v1.js`.
2. **Supabase Edge Functions** عبر دوال مستقلة + Router (`supabase/functions/api-router`).

هذا يعني أن المنظومة حالياً **هجينة**: جزء مونوليثي (ملف API واحد) وجزء موزّع (Edge Functions).

---

## 2) الهيكل العام للمشروع

- `api/`
  - `v1.js`: معالج API الموحّد في مسار Vercel.
  - `health.js`, `maintenance.js`: نقاط مساعدة للحالة/الصيانة.
  - `lib/`: أدوات مساعدة خفيفة مخصصة لمسار `api/`.

- `supabase/functions/`
  - دوال Edge منفصلة حسب المجال (مثل `queue-enter`, `patient-login`, `queue-status`, `issue-pin`).
  - `api-router`: موجّه يقرأ المسار ويحوّله للدالة المناسبة.
  - `_shared/`: أكواد مشتركة (CORS / validation).

- `lib/`
  - منطق أعمال مشترك في TypeScript (مثل `queue.ts`).
  - طبقات تكامل Supabase (`supabase.ts` وغيرها).

- `supabase/migrations/` فقط (و`legacy/migrations/` للأرشفة فقط)
  - تطورات قاعدة البيانات وعمليات التصحيح/التحسين المتتالية.

- `docs/`
  - وثائق حالة المشروع والـ endpoints.

---


## 2.1) مجموعات الاختبارات (Test Suites)

لدينا الآن مجموعتان منفصلتان من الاختبارات ويجب التفريق بينهما:

- `test:unit`
  - يشغّل اختبارات **Vitest** الموجودة في `lib/*.test.ts`.
  - الهدف: التحقق من منطق الوحدات البرمجية المعزولة (خاصة الملفات المكتوبة/المدعومة بـ TypeScript داخل `lib`).

- `test:contracts`
  - يشغّل اختبارات **Node test runner** الحالية عبر `tests/*.test.js`.
  - الهدف: التحقق من عقود السلوك الحالية (Contracts) والسيناريوهات المتوافقة مع مسار الاختبارات القائم.

- `test`
  - يشغّل `test:unit` ثم `test:contracts` **بالتسلسل**.
  - هذا هو الأمر الأساسي قبل الدمج؛ أي Pull Request يجب أن يمرّ بالمجموعتين بنجاح.

> قبل الدمج (Merge): المطلوب نجاح `npm test` بالكامل، أو على الأقل نجاح كل من `npm run test:unit` و`npm run test:contracts` بدون فشل.

## 3) تدفق الطلب (Request Flow)

### مسار Vercel
Client → `/api/v1/*` → `vercel.json` rewrite → `api/v1.js`

### مسار Supabase Functions
Client → endpoint (أو `api-router`) → Edge Function متخصصة → RPC/Queries على Supabase

في `api-router` يتم تحويل المسارات مثل:
- `queue/enter` → `queue-enter`
- `patient/login` → `patient-login`
- `queue/status` → `queue-status`

---

## 4) أهم المجالات (Domains) التي يجب فهمها

1. **إدارة الطابور (Queue)**
   - إنشاء دخول للطابور عبر RPC آمن (`enter_queue_safe`) مع fallback.
   - قراءة الحالة الحالية للطابور وترتيب الأدوار.

2. **هوية المراجع/الجلسة (Patient + Session)**
   - تسجيل/إعادة استخدام المريض بالهوية العسكرية.
   - إنشاء Session token وتخزينه في `patient_sessions`.

3. **الـ PIN والعمليات الإدارية**
   - توجد دوال منفصلة لتوليد/التحقق من PIN وإدارة حالة النظام.

---

## 5) أمور مهمة جداً قبل أي تعديل

1. **لا تفترض أن وثائق `docs/` تمثل 100% الواقع الحالي**
   - بعض الوثائق تصف snapshot سابق؛ اعتمد دائماً على الكود الفعلي كمرجع نهائي.

2. **انتبه للازدواجية بين المسارات**
   - أي سلوك قد يكون موجوداً في `api/v1.js` وأيضاً في Edge Function موازية.
   - عند إصلاح Bug، تأكد إن كان يلزم التعديل في مسار واحد أو الاثنين.

3. **التعامل مع التوازي مهم جداً في الطوابير**
   - استخدم RPC/دوال قاعدة البيانات الآمنة في عمليات إدخال الطابور وتوليد الأرقام.

4. **الاعتماد على متغيرات البيئة**
   - `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` أساسيان.
   - أي بيئة ناقصة المفاتيح ستسبب أعطال سريعة.

---

## 6) خطة تعلم مقترحة للمشترك الجديد (أول أسبوع)

### اليوم 1–2: قراءة الخرائط
- اقرأ `vercel.json` + `api/v1.js` لفهم مسار Vercel.
- اقرأ `supabase/functions/api-router/index.ts` لفهم التوجيه.

### اليوم 3–4: فهم المجال الأساسي
- اقرأ `supabase/functions/queue-enter/index.ts` و`queue-status/index.ts`.
- اقرأ `supabase/functions/patient-login/index.ts`.

### اليوم 5: قاعدة البيانات
- راجع `docs/DB_SOURCE_OF_TRUTH.md` لمعرفة المصدر الرسمي.
- راجع أحدث ملفات `supabase/migrations/` لمعرفة التغييرات المعتمدة.

### اليوم 6–7: صيانة وتحسين
- اختر endpoint واحد واعمِل tracing كامل له من الطلب حتى الكتابة في DB.
- وثّق الفجوات بين `docs/` والكود الفعلي كـ TODOs صغيرة.

---

## 7) مقترحات تعلم متقدم بعد الإتقان الأساسي

1. **توحيد المعمارية**
   - تحديد مسار رسمي (Monolith في `api/v1.js` أو Edge-first) ثم تقليل الازدواجية.

2. **اختبارات تكامل**
   - تغطية السيناريوهات الحساسة للطابور (concurrency, idempotency, fallback behavior).

3. **Observability**
   - توحيد هيكل الـ logs وربط request IDs لمتابعة الأعطال.

4. **توثيق تشغيلي**
   - Runbook واضح: كيف تشغّل محلياً، كيف تتحقق من الصحة، كيف تتعامل مع rollback.

---

## 8) “أين أبدأ الآن؟”

لو أنت جديد تماماً:
1. شغّل endpoint صحة النظام.
2. اختبر login مراجع.
3. اختبر queue enter.
4. اختبر queue status.
5. ارسم sequence بسيط للتدفق واربطه بالجداول المتأثرة.

هذا المسار الصغير يعطيك 70% من الصورة العملية بسرعة.
