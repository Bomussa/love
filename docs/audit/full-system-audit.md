# التدقيق المركزي الشامل للنظام (love + love-api)

> تاريخ الإصدار: 2026-03-15  
> المستودع الذي تم تدقيقه مباشرة: `love`  
> حالة `love-api`: غير موجود محليًا في بيئة العمل الحالية، لذلك تم الاعتماد على الوثائق المتاحة داخل `love/docs` فقط.

## 1) نطاق التدقيق ومنهجية الفحص

- تم فحص شجرة المشروع الحالية (`love`) على مستوى:
  - المجلدات الأساسية.
  - Endpoints المعرفة داخل Supabase Edge Functions.
  - جداول قاعدة البيانات من `supabase/schema.sql` وملفات migrations.
  - الوحدات/الدوال الحرجة (frontend + backend adapters).
- تم إعداد سجل مشكلات موحد قابل للإغلاق عبر PR مستقل لكل بند.
- القيود المعتمدة:
  - لا تعديل للهوية البصرية إلا عند الحاجة الإصلاحية.
  - عدم إدخال API خارجي باسم `love`.
  - الحفاظ على الثيم الطبي.
  - التعديلات للإصلاح والتطوير فقط.

---

## 2) المجلدات الأساسية (Core Directories Inventory)

### A) داخل مستودع `love`

| المسار | التصنيف | الملاحظات |
|---|---|---|
| `/workspace/love/frontend/src` | Frontend Source | المصدر الأساسي للواجهات والمنطق على العميل |
| `/workspace/love/src` | Frontend Legacy/Secondary | يحتوي نسخة/طبقة إضافية قد تسبب ازدواجية |
| `/workspace/love/supabase/functions` | Backend (Edge Functions) | نقاط API الفعلية المبنية على Supabase |
| `/workspace/love/supabase/migrations` | Database Migrations | تعريفات الجداول والسياسات والتعديلات |
| `/workspace/love/supabase/schema.sql` | Base Schema | مخطط مرجعي للجداول الأساسية |
| `/workspace/love/functions` | Serverless Helper Layer | تكامل Supabase من طرف آخر |
| `/workspace/love/tests` | Automated Tests | موجودة لكن تحتاج توسيع تغطية وربط CI |
| `/workspace/love/scripts` | QA/Automation Scripts | أدوات فحص وتحقق وتشغيلات دعم |
| `/workspace/love/docs` | Documentation | توثيق شامل لكن يحتاج مركزية وربط PRs |

### B) مشروع `love-api` (حسب الوثائق فقط)

| المسار (توثيقي) | الحالة |
|---|---|
| `/home/ubuntu/love-api/api` | غير متاح محليًا حاليًا، موثق في `docs/TRUTH_TREE_LOVE_API.md` |
| `/home/ubuntu/love-api/migrations` | غير متاح محليًا حاليًا، يلزم clone مباشر لاستكمال تدقيق كودي 100% |

---

## 3) جرد الـ Endpoints

## 3.1 Endpoints الفعلية عبر Supabase Functions (من كود المشروع)

| Endpoint Function | المسار الكامل | الغرض |
|---|---|---|
| `api-v1-status` | `/workspace/love/supabase/functions/api-v1-status/index.ts` | فحص/ملخص حالة API |
| `functions-proxy` | `/workspace/love/supabase/functions/functions-proxy/index.ts` | Proxy للوصول الوظيفي |
| `healthz` | `/workspace/love/supabase/functions/healthz/index.ts` | Health check |
| `login` | `/workspace/love/supabase/functions/login/index.ts` | تسجيل دخول الإدارة/الأنظمة |
| `pin-generate` | `/workspace/love/supabase/functions/pin-generate/index.ts` | إنشاء PIN |
| `pin-status` | `/workspace/love/supabase/functions/pin-status/index.ts` | حالة PIN |
| `pin-verify` | `/workspace/love/supabase/functions/pin-verify/index.ts` | التحقق من PIN |
| `queue-call` | `/workspace/love/supabase/functions/queue-call/index.ts` | استدعاء الدور |
| `queue-engine` | `/workspace/love/supabase/functions/queue-engine/index.ts` | محرك إدارة الطوابير |
| `queue-enter` | `/workspace/love/supabase/functions/queue-enter/index.ts` | انضمام للطابور |
| `queue-status` | `/workspace/love/supabase/functions/queue-status/index.ts` | حالة المريض/الطابور |
| `reports-daily` | `/workspace/love/supabase/functions/reports-daily/index.ts` | تقارير يومية |
| `stats-dashboard` | `/workspace/love/supabase/functions/stats-dashboard/index.ts` | إحصاءات لوحة التحكم |

## 3.2 Endpoints التعاقدية (Contract) من الوثائق

تم رصد قائمة REST v1 في `docs/API_V1_ENDPOINTS.md` (Admin/Clinics/Queue/Reports/Settings/Patients/Events/Notifications/Health).  
**فجوة تدقيق:** يلزم ربط كل Endpoint موثق بمسار تنفيذ فعلي (Edge Function أو API route) + اختبار Contract آلي.

---

## 4) جرد جداول Supabase (مركزي)

> المصدر المركب: `supabase/schema.sql` + `supabase/migrations/*.sql`.

| الجدول | المصدر الأساسي | ملاحظة التدقيق |
|---|---|---|
| `clinics` | `schema.sql`, migrations | موجود بنسخ تعريف متعددة عبر migrations |
| `patients` | `schema.sql`, migrations | يحتاج توحيد القيود عبر كل المراحل |
| `pathways` | `schema.sql`, migrations | تكرار تعريف في أكثر من migration |
| `queues` | `schema.sql`, migrations | جدول حرج مع تاريخ تغييرات متكرر |
| `queue_history` | `schema.sql` | يلزم مراجعة retention/partitioning |
| `notifications` | `schema.sql`, migrations | اختلافات محتملة بين تعريفات قديمة/حديثة |
| `system_settings` | `schema.sql` | يجب التحقق من صلاحيات التعديل |
| `pins` | `002_add_pins_and_reports.sql` | أمنيًا: TTL + rate limit + hashing |
| `qa_runs` | `20260314_add_qa_repair_tables.sql` | جدول تشغيل QA |
| `qa_findings` | `20260314_add_qa_repair_tables.sql` | نتائج QA وتتبّع الثغرات |
| `repair_runs` | `20260314_add_qa_repair_tables.sql` | تتبّع الإصلاحات |
| `login_audit` | `20251102_login_audit.sql` | تدقيق أمني للمصادقة |
| `admin_users` | عدة migrations | مخاطر drift لهيكل جدول المستخدمين |
| `reports` | `20251105_initial_schema.sql` | تقارير تشغيل |
| `audit_log` | عدة migrations | يوجد تعريفات متعددة يلزم دمجها |
| `exam_types` | `create_missing_tables.sql`, `create_exam_types.sql` | تكرار تعريفات |
| `roles` | `critical_additions.sql` | أساس RBAC |
| `system_config` | `critical_additions.sql` | يحتاج governance واضح |
| `clinic_counters` | `2025-11-07_queue_core.sql` | مهم لتسلسل النداء |

---

## 5) الوحدات/الدوال الحرجة (Critical Modules / Functions)

| الوحدة | المسار الكامل | سبب الأهمية |
|---|---|---|
| `api-unified` | `/workspace/love/frontend/src/lib/api-unified.js` | طبقة موحّدة لكل نداءات API |
| `supabase-api` | `/workspace/love/frontend/src/lib/supabase-api.js` | نقطة تكامل رئيسية مع Supabase |
| `queueManager` | `/workspace/love/frontend/src/lib/queueManager.js` | منطق الطابور على العميل |
| `realtime-sync-manager` | `/workspace/love/frontend/src/lib/realtime-sync-manager.js` | الاتساق اللحظي بين الواجهات |
| `auth-service` | `/workspace/love/frontend/src/lib/auth-service.js` | التوثيق/الجلسات |
| `service-resilience` | `/workspace/love/frontend/src/lib/service-resilience.js` | التعافي من الأعطال والاعتمادية |
| `login function` | `/workspace/love/supabase/functions/login/index.ts` | نقطة أمنية حساسة |
| `queue-engine function` | `/workspace/love/supabase/functions/queue-engine/index.ts` | القلب التشغيلي للطابور |
| `queue-enter function` | `/workspace/love/supabase/functions/queue-enter/index.ts` | مسار دخول المريض |
| `pin-verify function` | `/workspace/love/supabase/functions/pin-verify/index.ts` | حساسية عالية للسلامة والخصوصية |

---

## 6) سجل المشكلات المركزي (Issue Register)

> الصيغة المطلوبة: المسار الكامل + وصف الخلل + التأثير + أولوية الإصلاح + رابط commit/PR للإغلاق.

| ID | المسار الكامل | وصف الخلل | التأثير | الأولوية | رابط الإغلاق (Commit/PR) |
|---|---|---|---|---|---|
| AUD-001 | `/workspace/love/src` و`/workspace/love/frontend/src` | ازدواجية طبقات Frontend (مصدران متداخلان) | تضارب إصلاحات، أخطاء build/deploy، صعوبة التتبع | P0 | `TBD-PR-AUD-001` |
| AUD-002 | `/workspace/love/frontend/src/**/*.conflict_backup` و`*.old` و`*.backup` | ملفات تعارض/نسخ احتياطية داخل الشجرة الحية | احتمال استيراد غير مقصود + تضخم المستودع | P1 | `TBD-PR-AUD-002` |
| AUD-003 | `/workspace/love/supabase/migrations/*.sql` | تكرار/تداخل تعريفات جداول (`queues`, `pathways`, `admin_users`, `audit_log`, `exam_types`) | schema drift وصعوبة الترحيل البيئي | P0 | `TBD-PR-AUD-003` |
| AUD-004 | `/workspace/love/docs/API_V1_ENDPOINTS.md` مقابل `/workspace/love/supabase/functions/*` | فجوة بين Contract الموثق والتنفيذ الفعلي | اختبارات API غير مكتملة + مخاطر تكامل | P0 | `TBD-PR-AUD-004` |
| AUD-005 | `/workspace/love/frontend/src/lib/auth-service.js` + `/workspace/love/supabase/functions/login/index.ts` | مسار المصادقة يحتاج توحيد سياسة lockout/audit/rate limit | خطر أمني/تجاوزات brute-force | P0 | `TBD-PR-AUD-005` |
| AUD-006 | `/workspace/love/frontend/src/lib/realtime-sync-manager.js` + `/workspace/love/frontend/src/lib/persistent-connection.js` | احتمالات race conditions وإعادة اتصال متكررة بدون سياسة واضحة | حالات واجهة غير متسقة وتذبذب بيانات | P1 | `TBD-PR-AUD-006` |
| AUD-007 | `/workspace/love/tests` و`/workspace/love/scripts/e2e` | تغطية اختبار غير موحدة (Unit/Integration/E2E/Performance/Security) | انخفاض الثقة قبل النشر | P0 | `TBD-PR-AUD-007` |
| AUD-008 | `/workspace/love/docs` (مستندات متعددة غير مرتبطة بمؤشر مركزي) | التوثيق مشتت وغير مرتبط بمالكي البنود | بطء الإغلاق وصعوبة التحقق | P2 | `TBD-PR-AUD-008` |
| AUD-009 | `/workspace/love/docs/TRUTH_TREE_LOVE_API.md` فقط | كود `love-api` غير متاح محليًا للتدقيق الكامل | تدقيق backend غير مكتمل عمليًا | P0 | `TBD-PR-AUD-009` |
| AUD-010 | `/workspace/love/frontend/src/lib/supabase-client.js` وملفات config | خطر انكشاف/سوء إدارة الأسرار بين البيئات | مخاطر أمان وامتثال | P0 | `TBD-PR-AUD-010` |

---

## 7) خطة تنفيذ زمنية واقعية + Rollback Points

## المرحلة A (أيام 1-2): Baseline & Freeze
- المهام:
  - قفل baseline للإنتاج (hashes, schema snapshot, env snapshot).
  - تعريف معايير النجاح الكمية (SLO/SLA + error budget).
- مخاطر الفشل: baseline غير مكتمل أو بيانات غير متسقة.
- Rollback Point A1:
  - الرجوع إلى commit baseline المعتمد.
  - إعادة نشر آخر نسخة مستقرة على Vercel + إعادة ربط Edge Functions السابقة.

## المرحلة B (أيام 3-5): توحيد المسارات والبنية
- المهام:
  - حل AUD-001 وAUD-002 (مصدر Frontend واحد + تنظيف نسخ التعارض).
  - تحديث CI لمنع إعادة إدخال ملفات backup/conflict.
- مخاطر الفشل: كسر imports/paths.
- Rollback Point B1:
  - feature flag للبنية الجديدة.
  - الرجوع الفوري لهيكل المسارات السابق عند فشل smoke tests.

## المرحلة C (أيام 6-9): استقرار قاعدة البيانات
- المهام:
  - حل AUD-003 عبر migration consolidation.
  - إنتاج Schema Canonical واحد + migration dry-run على staging.
- مخاطر الفشل: فقدان توافق migration أو توقف كتابة مؤقت.
- Rollback Point C1:
  - Point-in-time recovery (Supabase) قبل التطبيق.
  - rollback migration script مع تحقق checksum.

## المرحلة D (أيام 10-12): Contract/API Security Hardening
- المهام:
  - حل AUD-004 وAUD-005 وAUD-010.
  - توحيد contract tests + auth hardening + secret scanning.
- مخاطر الفشل: رفض طلبات صحيحة بسبب tightening زائد.
- Rollback Point D1:
  - إعادة policy rules السابقة.
  - تخفيض القيود تدريجيًا مع مراقبة معدل الفشل.

## المرحلة E (أيام 13-15): Reliability & Test Expansion
- المهام:
  - حل AUD-006 وAUD-007.
  - رفع تغطية Unit/Integration/E2E + performance/security checks.
- مخاطر الفشل: اختبارات flaky أو زمن CI مرتفع.
- Rollback Point E1:
  - إبقاء suite الأساسية فقط كـ required checks مؤقتًا.
  - تشغيل بقية الاختبارات بشكل non-blocking لحين الاستقرار.

## المرحلة F (أيام 16-17): Documentation Closure & Governance
- المهام:
  - حل AUD-008 وAUD-009.
  - توحيد توثيق المشروعين مع روابط PRs النهائية.
- مخاطر الفشل: gap مستمر في مشروع `love-api`.
- Rollback Point F1:
  - وسم البنود غير المغلقة كـ blocked رسميًا.
  - عدم الانتقال إلى “100% complete” حتى إتاحة تدقيق `love-api` فعليًا.

---

## 8) ربط كل بند Audit بـ PR مستقل (شاشة/وحدة لكل PR)

| بند التدقيق | PR مستقل مقترح | النطاق (Screen/Module) | معيار الإغلاق |
|---|---|---|---|
| AUD-001 | `PR-01-frontend-structure-unification` | App Shell + routing/bootstrap | build نظيف + عدم وجود ازدواجية src |
| AUD-002 | `PR-02-remove-conflict-artifacts` | Code hygiene across frontend | صفر ملفات `*.backup/*.old/*.conflict_backup` |
| AUD-003 | `PR-03-db-migration-consolidation` | Supabase migrations/schema | schema diff = 0 بين staging/prod baseline |
| AUD-004 | `PR-04-api-contract-alignment` | API docs + function mapping | كل endpoint موثق ↔ منفذ ↔ مختبر |
| AUD-005 | `PR-05-auth-security-hardening` | Login/Admin/Auth modules | lockout + audit + rate limiting مفعّلة |
| AUD-006 | `PR-06-realtime-reliability` | Realtime sync/connectivity modules | انخفاض reconnect storms + consistency pass |
| AUD-007 | `PR-07-test-pyramid-enforcement` | tests + CI workflows | Unit/Integration/E2E gates واضحة |
| AUD-008 | `PR-08-central-docs-index` | docs governance | فهرس مركزي + owners + traceability |
| AUD-009 | `PR-09-love-api-full-code-audit` | backend `love-api` modules | تدقيق كودي فعلي بدل توثيقي |
| AUD-010 | `PR-10-secrets-config-hardening` | env/config/supabase client | لا أسرار مكشوفة + policy pass |

> **قاعدة تنفيذ:** لا يتم إغلاق بند Audit إلا بوجود رابط PR + رابط commit دمج نهائي + دليل اختبار مرتبط بالبند.

---

## 9) سياسة القرار المرتبطة بنسبة النجاح

- يتم السماح بالتنفيذ الإنتاجي فقط إذا كانت نسبة النجاح في التحقق الشامل `>= 98%`.
- إذا تجاوزت نسبة الفشل `10%` يتم الإيقاف وعدم التنفيذ الإنتاجي.
- هدف الدفعة النهائية التشغيلي: `>= 99%` نجاح اختبارات الإصلاحات الحرجة قبل الإطلاق النهائي.

---

## 10) ما يلزم لاستكمال 100% فعليًا

1. Clone مباشر لمستودع `love-api` داخل نفس بيئة التدقيق.
2. تشغيل اختبارات endpoint-to-endpoint على النطاقين:
   - `https://mmc-mms.com`
   - `https://www.mmc-mms.com`
3. تحديث هذا الملف بعد كل PR بإضافة:
   - رابط PR الفعلي.
   - رابط commit الدمج.
   - نتيجة الاختبارات المرتبطة بالبند.

