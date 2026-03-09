# خطة الفحص الشامل والتنفيذ الآمن — مشروع LOVE (Frontend + Backend)

> **النطاق المنفذ في هذا المستودع:** `love` (الواجهة + وظائف Supabase الموجودة داخله).
> **النطاق غير المتاح داخل البيئة الحالية:** مستودع `love-api` الخارجي على GitHub (يتطلب استنساخ/ربط مباشر بالمستودع الثاني قبل الإغلاق الكامل لجميع بنود الفحص).

## 1) ملخص تنفيذي

تم تجهيز خطة تنفيذ عملية على 5 مراحل، متوافقة مع قيودك:

- عدم تغيير الهوية البصرية إلا عند الضرورة الإصلاحية فقط.
- منع أي اعتماد على API خارجي باسم `love`.
- الحفاظ على الثيم الطبي الحالي.
- التعديل للإصلاح والتطوير فقط.

كما تم تحويل المتطلبات إلى **Checklist تشغيلية قابلة للقياس** مع نقاط فشل/تراجع (Rollback) واضحة قبل أي نشر.

---

## 2) نتائج فحص أولية (داخل repo: love)

### 2.1 الواجهة الأمامية

- مشروع React/Vite في `frontend/` مع إعدادات نشر Vercel منفصلة.
- وجود مواد تشغيلية وتوثيق سابق للفحص والنشر والاختبارات في `docs/` و`scripts/`.
- وجود طبقة تكامل Supabase في:
  - `frontend/src/lib/supabase-api.js`
  - `frontend/src/lib/api-unified.js`
  - `frontend/src/lib/supabase-queries.js`

### 2.2 نقاط API/Edge Functions المكتشفة في نفس المستودع

تم رصد endpoints/Functions التالية:

- `supabase/functions/healthz`
- `supabase/functions/api-v1-status`
- `supabase/functions/functions-proxy`
- `supabase/functions/queue-enter`
- `supabase/functions/queue-status`
- `supabase/functions/queue-call`
- `supabase/functions/queue-engine`
- `supabase/functions/login`
- `supabase/functions/pin-generate`
- `supabase/functions/pin-verify`
- `supabase/functions/pin-status`
- `supabase/functions/stats-dashboard`
- `supabase/functions/reports-daily`

### 2.3 قاعدة البيانات (Snapshot موثّق)

وفق snapshot الموجود داخل التوثيق:

- schema `public` يحتوي **80 جدول**.
- جداول حرجة مذكورة: `admins`, `unified_queue`, `notifications`, `pins`, `patients`, `audit_logs`, `routes`, `route_steps`, `clinics`.
- تم توثيق RLS وسياسات عدة جداول تشغيلية.

> **ملاحظة:** الاكتمال 100% لبند "فحص كل جدول" يتطلب إعادة استخراج schema حي من Supabase runtime ومقارنته بالsnapshot الحالي قبل الإغلاق النهائي.

---

## 3) سجل المشاكل المحتملة (Issue Register) — صيغة تنفيذية

> الهدف هنا: قالب دقيق لتوثيق كل مشكلة مع مسارها الكامل، تأثيرها، وخطة علاجها.

### P0 (حرج — يوقف الإنتاج)

1. **تعطل test runner الافتراضي** في بيئة CI المحلية إذا لم تكن dependencies مثبتة أو إذا تم تشغيل اختبارات غير متوافقة مع Node test runner مباشرة.
   - مسار مرجعي: `scripts/smoke.test.ts`
   - الأثر: انقطاع بوابة الجودة قبل النشر.

2. **فجوة فحص مستودع backend الخارجي `love-api`** غير مغطاة من داخل repo الحالي.
   - الأثر: اكتمال الفحص الشامل عبر المشروعين غير محقق حتى يتم الربط بالمستودع الثاني.

### P1 (مرتفع)

3. **خطر انحراف بين DB snapshot والتغييرات الفعلية في Supabase** إذا لم يتم export حديث قبل التنفيذ.
   - مسارات مرجعية: `docs/00_TRUTH_LOCK/03_DB_SCHEMA_RLS_SNAPSHOT.md`, `scripts/export_supabase_schema.sh`.

4. **خطر drift في إعدادات Vercel/Domain** بين `mmc-mms.com` و`www` إذا لم يتم smoke test مزدوج بعد كل نشر.
   - مرجع: `scripts/verify_external_rewrite.sh`.

### P2 (متوسط)

5. **تشتت توثيق الإجراءات** بين عدة ملفات قد يسبب أخطاء تشغيل بشرية.
   - الأثر: تأخير الاستجابة للحوادث، صعوبة on-call handoff.

---

## 4) الخطة الدقيقة (Precise Planning) مع Timeline

## المرحلة A — Truth Lock (يوم 1)

- إعادة تصدير schema الحي من Supabase ومطابقته مع snapshot الحالي.
- تجميد baseline commit للواجهة (`love`) وتوثيق hash.
- استنساخ وربط مستودع `love-api` في نفس بيئة التدقيق.

**مخاطر الفشل:** عدم تطابق schema أو نقص صلاحيات.

**Rollback Point A:**
- العودة إلى baseline hash.
- إعادة تفعيل نسخة snapshot السابقة إلى أن تُحل الفروقات.

## المرحلة B — Comprehensive Audit (يوم 2–3)

- فحص كل endpoint في `love` + `love-api` (contract + auth + error modes).
- فحص كل module/dll function critical path:
  - login
  - queue lifecycle
  - notifications
  - reports
- توليد مصفوفة اعتماد (Dependency Map): Frontend ↔ Functions ↔ DB Tables.

**مخاطر الفشل:** endpoints مفقودة توثيقياً أو مسارات غير مستخدمة لكنها حرجة.

**Rollback Point B:**
- لا يتم دمج أي تغيير حتى اكتمال مصفوفة الاعتماد بنسبة 100%.

## المرحلة C — إصلاحات موجهة (يوم 4–6)

- تنفيذ الإصلاحات بالأولوية: P0 ثم P1 ثم P2.
- الالتزام بقيود UI/Theme الطبية.
- منع أي external API جديد باسم `love`.

**مخاطر الفشل:** regression غير ظاهر في تدفق المرضى/الطوابير.

**Rollback Point C:**
- Feature flags (إن وجدت) + revert commit فوري + إعادة نشر نسخة Staging المستقرة.

## المرحلة D — اختبار صارم متعدد الطبقات (يوم 7–8)

- Unit, Integration, E2E, Manual, Performance, Security.
- اعتماد بيانات تشغيل حقيقية (sanitized عند الحاجة).

**مخاطر الفشل:** تغطية اختبار غير كافية لمسارات edge-case.

**Rollback Point D:**
- منع الترقية للإنتاج إذا أي اختبار حرج أقل من حد النجاح.

## المرحلة E — نشر آمن ومراقبة (يوم 9)

- Staging → Smoke → UAT → Production.
- مراقبة فورية (errors/latency/business KPIs).
- خطة rollback جاهزة بزمن استجابة قصير.

**مخاطر الفشل:** أخطاء غير متوقعة في الإنتاج.

**Rollback Point E:**
- Rollback فوري لنسخة production السابقة + Postmortem خلال 24 ساعة.

---

## 5) خطة اختبارات ما قبل النشر (Pre-Deploy Test Plan)

## 5.1 Unit Tests

- تغطية الدوال المعزولة في:
  - validation helpers
  - queue state transitions
  - PIN generation/verification logic

**عتبة القبول:** ≥ 90% للوحدات الحرجة.

## 5.2 Integration Tests

- Frontend ↔ Supabase Functions.
- Functions ↔ DB (RLS, permissions, transactional integrity).

**عتبة القبول:** جميع حالات النجاح + الفشل المتوقع passing.

## 5.3 E2E

- رحلة مريض كاملة: دخول → رقم انتظار → نداء/تحديث حالة → إشعار.
- رحلة موظف/إدمن: login → queue operations → dashboard stats.

## 5.4 Performance & Security

- حمل على endpoints الحرجة (queue/status/call).
- فحوص rate-limit, auth bypass, PII leakage.

## 5.5 UAT + Smoke

- التحقق من النطاقين:
  - `https://mmc-mms.com`
  - `https://www.mmc-mms.com`
- التأكد من تطابق المحتوى والسلوك.

---

## 6) معايير النجاح القابلة للقياس

- **Success Rate:** > 98%
- **Failure Rate:** < 2%
- اختبار الموقع الأصلي: **إجباري**
- اختبار عملي لكل إصلاح: **إجباري**
- بيانات حقيقية: **إجباري**
- نشر نهائي: بعد تحقق كامل وتوقيع قبول.

---

## 7) المتطلبات التشغيلية لإغلاق البنود بالكامل

لإنهاء المتطلبات بنسبة 100% عبر المشروعين:

1. إتاحة checkout مباشر لمستودع `love-api` داخل نفس بيئة العمل الحالية.
2. توفير متغيرات البيئة التشغيلية (staging/prod-safe) لكلا المشروعين.
3. تنفيذ export حي من Supabase قبل وبعد الإصلاحات للمقارنة.
4. تشغيل pipeline اختبار موحد يغطي Frontend + Backend مع تقرير واحد.

---

## 8) قرار التنفيذ المقترح

**ابدأ فوراً بمرحلة A داخل `love`، ثم اربط `love-api` لإكمال الفحص الشامل ثنائي المستودع قبل أي نشر إنتاجي.**

بهذا نضمن الالتزام بقيودك الفنية، مع أعلى دقة توثيقية، وخطة rollback عملية قابلة للتنفيذ تحت الضغط.
