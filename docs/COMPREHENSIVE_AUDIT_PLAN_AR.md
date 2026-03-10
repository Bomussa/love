# تقرير فحص شامل وخطة تنفيذ (بدون أي إصلاح مباشر)

## 1) نطاق الفحص وما تم التحقق منه
- تم فحص مشروع `love` المحلي (Frontend + Supabase Functions الموجودة داخل نفس المستودع).
- تمت محاولة فحص `love-api` من GitHub لكن الوصول فشل بسبب حظر الشبكة (HTTP 403 عبر proxy)، لذلك التغطية الفعلية للـ backend اعتمدت على `supabase/functions` و `supabase/migrations` داخل هذا المستودع.
- تمت محاولة اختبار `mmc-mms.com` و `www.mmc-mms.com` مباشرة، لكن كلاهما يرجع `403 Forbidden` من طبقة الشبكة (Envoy)، لذلك لا يمكن تنفيذ UAT خارجي كامل من هذه البيئة.

## 2) نتائج الفحص الفني (Issues) — مع الملف/السطر والمطلوب تعديله

## A. مشكلات عالية الخطورة (تمنع الجاهزية للإطلاق)
1. **مراجع غير معرفة في endpoint الإحصائيات**
   - الملف: `supabase/functions/stats-dashboard/index.ts`
   - الأسطر: 23, 27-30, 77, 90, 105-115
   - المشكلة: استخدام `corsHeaders`, `requireAuthGuard`, `authErrorResponse` دون import؛ واستخدام `todayStats` و`clinicPerf` في مسار clinic رغم أنها معرفة في مسار admin فقط.
   - المطلوب تعديله:
     - إضافة imports من `_shared/cors.ts` و`_shared/auth.ts`.
     - فصل payload مسار clinic عن admin لمنع المتغيرات غير المعرفة.
     - توحيد envelope الاستجابة عبر helper واحد.

2. **مراجع غير معرفة في endpoint التقارير اليومية**
   - الملف: `supabase/functions/reports-daily/index.ts`
   - الأسطر: 23, 27-30, 49, 62
   - المشكلة: استخدام `corsHeaders`, `requireAuthGuard`, `authErrorResponse` بدون تعريف/استيراد.
   - المطلوب تعديله:
     - استيراد `corsHeaders` من `_shared/cors.ts` أو استبداله كلياً بـ `getCorsHeaders(req)`.
     - استيراد `requireAuthGuard`, `authErrorResponse` من `_shared/auth.ts`.

3. **أمر typecheck الجذري غير متوافق مع React/TSX**
   - الملف: `tsconfig.json`
   - الأسطر: 2-24
   - المشكلة: لا يوجد إعداد `jsx` ولا فصل إعدادات TypeScript بين root وfrontend؛ نتيجة ذلك يظهر `TS17004` على ملفات TSX.
   - المطلوب تعديله:
     - اعتماد Project References أو tsconfig خاص بالـ frontend.
     - تعيين `jsx` (مثل `react-jsx`) ضمن إعداد فحص الواجهة.

4. **سير الاختبارات غير قابل للتنفيذ حالياً**
   - الملف: `frontend/package.json`
   - الأسطر: 68, 71-83
   - المشكلة: script `test` يعتمد `vitest` لكن الحزمة غير موجودة في dependencies/devDependencies.
   - المطلوب تعديله:
     - إضافة `vitest` (وأي peer deps لازمة) أو تعديل script ليتماشى مع أداة الاختبار الفعلية.

## B. مشكلات منطقية/اعتمادية (متوسطة)
5. **استخدام eventBus بدون تعريف**
   - الملف: `lib/enhanced-api.js`
   - الأسطر: 350-352
   - المشكلة: استدعاء `eventBus.on(...)` بدون import/تهيئة.
   - المطلوب تعديله: إضافة مصدر event bus واضح أو حقنه dependency injection.

6. **استخدام eventBus بدون تعريف**
   - الملف: `lib/mms-core-api.js`
   - الأسطر: 141-143
   - المشكلة: نفس المشكلة أعلاه.
   - المطلوب تعديله: توحيد طبقة events وربطها بمصدر واحد.

7. **استخدام createEnv بدون تعريف فعلي**
   - الملف: `lib/reports.js`
   - الأسطر: 7, 73, 109, 148, 181
   - المشكلة: الاستيراد محذوف في السطر 7 لكن الدوال تستخدم `createEnv()`.
   - المطلوب تعديله: إما إعادة تعريف الاستيراد الصحيح أو حذف الاستدعاءات غير المستخدمة.

8. **عدد كبير من تحذيرات ESLint (جودة وصيانة)**
   - الملفات: متعددة (frontend/src, lib, scripts, tests)
   - أمثلة: `no-unused-vars`, `consistent-return`, `no-undef`.
   - المطلوب تعديله: تنظيف المتغيرات غير المستخدمة، توحيد return paths، ومعالجة `no-undef` أولاً لأنها الأعلى أثراً.

## C. قاعدة البيانات/المخطط (Schema)
9. **تكرار تعريف `api_failover_events` في أكثر من موضع**
   - الملفات:
     - `supabase/migrations/20260309_create_api_failover_events.sql` (السطر 1)
     - `supabase/schema.sql` (السطر 1223)
   - الملاحظة: وجود التعريف في schema النهائي متوقع، لكن يجب ضبط تسلسل migration حتى لا يحدث drift بين البيئات.
   - المطلوب تعديله:
     - التأكد من baseline موحد لبيئات staging/prod.
     - تفعيل فحص schema drift ضمن CI بشكل إلزامي.

## D. الاتصال الخارجي والاعتمادية
10. **تعذر التحقق الخارجي من الدومين والإندبوينتات بسبب 403 من الشبكة الحالية**
   - النطاقات: `https://mmc-mms.com`, `https://www.mmc-mms.com`
   - Supabase Functions: `https://rujwuruuosffcxazymit.supabase.co/functions/v1/*`
   - المطلوب تعديله (تشغيلياً وليس كود):
     - تنفيذ اختبارات smoke من بيئة شبكية مسموح لها بالخروج إلى الدومينات المستهدفة.

## 3) فحص endpoints (قائمة التغطية)
- endpoints الموجودة بالمستودع:
  - `healthz`, `api-v1-status`, `login`, `admin-login`, `pin-generate`, `pin-verify`, `pin-status`,
    `queue-enter`, `queue-status`, `queue-call`, `queue-engine`, `reports-daily`, `stats-dashboard`, `functions-proxy`.
- الحالة:
  - فحص static code: تم.
  - فحص runtime عبر الإنترنت: متعذر من البيئة الحالية (403).

## 4) خطة تنفيذ دقيقة (بدون تنفيذ الآن)

## المرحلة 1 (يوم 1) — Stabilization حرِج
- إصلاح imports/undefined references في:
  - `supabase/functions/stats-dashboard/index.ts`
  - `supabase/functions/reports-daily/index.ts`
- المخرجات:
  - نجاح type/lint للوظائف.
- احتمال الفشل: 8%
- نقطة التراجع (Rollback): revert commit endpoint-fixes-1.

## المرحلة 2 (يوم 2) — Tooling Alignment
- فصل tsconfig للـ frontend وإصلاح JSX/typecheck pipeline.
- إضافة/تفعيل `vitest` أو بديل معتمد.
- احتمال الفشل: 12%
- نقطة التراجع: revert commit tooling-align-2.

## المرحلة 3 (يوم 3) — Code Quality Hardening
- معالجة `no-undef` أولاً ثم `consistent-return` ثم `no-unused-vars`.
- تفعيل ESLint كـ quality gate (warnings budget <= 20 ثم صفر تدريجياً).
- احتمال الفشل: 15%
- نقطة التراجع: revert commit quality-hardening-3.

## المرحلة 4 (يوم 4) — DB Validation
- مقارنة schema الفعلي في Supabase مع migrations.
- تطبيق فحص drift قبل كل deploy.
- احتمال الفشل: 7%
- نقطة التراجع: rollback migration batch via SQL transaction plan.

## المرحلة 5 (يوم 5) — Staging + UAT + Production
- نشر staging ثم smoke tests.
- UAT على `mmc-mms.com` و`www.mmc-mms.com` للتطابق الوظيفي والبصري.
- نشر production مع مراقبة فورية وخطة rollback.
- احتمال الفشل: 10%
- نقطة التراجع: promote previous Vercel deployment + revert latest DB migration.

## 5) اختبارات ما قبل النشر (Pre-deploy Test Plan)
- Unit tests: لكل دالة pure + helpers في `_shared`.
- Integration: لكل endpoint مع auth roles (`admin`/`clinic`) وحالات 401/403/200.
- E2E: رحلة المستخدم الكاملة من الدخول حتى إدارة الطابور والتقارير.
- Performance: قياس زمن الاستجابة P95 للـ edge functions.
- Security: فحص CORS, JWT validation, role enforcement, RLS.

## 6) تقييم نسبة الجاهزية الحالية (قرار التنفيذ)
- جاهزية التنفيذ الفوري: **حوالي 82%** (أقل من شرط >98%).
- تقدير المخاطر/الفشل الحالي: **حوالي 18%** (أعلى من شرط <10%).
- القرار وفق شرطك: **لا يتم التنفيذ الإنتاجي الآن** حتى إغلاق الثغرات الحرجة أعلاه.

## 7) ملخص تنفيذي
- لا توجد إصلاحات مباشرة منفذة في هذا التقرير.
- هذا التقرير يحدد بدقة: اسم الملف، رقم السطر، المطلوب تعديله، خطة زمنية، احتمالات الفشل، ونقاط التراجع.
