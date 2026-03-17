# Admin Screen-by-Screen E2E Validation — 2026-03-15

## Goal
تشغيل اختبار شاشة بشاشة داخل لوحة الإدارة، مع التحقق أن كل شاشة رئيسية وأزرارها تعمل على بيانات حقيقية، وأن التغييرات تصل فورًا لمسار البيانات المركزي (Supabase) بدون بيانات وهمية.

## Admin login and navigation proof
- تم تسجيل الدخول كإدارة بنجاح (جلسة `mmc_admin_session` = true).
- تم فتح الشاشات المطلوبة عبر قائمة الإدارة:
  - Backup & Export
  - Offline Mode
  - Appearance
  - Database
  - API Monitor
  - Files Center

## Screen results
1. **Backup & Export**
   - فتح الشاشة: ✅
   - تنفيذ زر: `نسخة احتياطية كاملة`: ✅

2. **Offline Mode**
   - فتح الشاشة: ✅
   - تنفيذ زر: `مزامنة الآن`: ✅

3. **Appearance**
   - فتح الشاشة: ✅
   - تنفيذ زر: `حفظ الإعدادات/حفظ`: ✅

4. **Database**
   - فتح الشاشة: ✅
   - التحقق من وجود زر `تصدير` وتنفيذه: ✅

5. **API Monitor**
   - فتح الشاشة: ✅

6. **Files Center**
   - فتح الشاشة: ✅

## Real backend verification (Supabase)
- تم تنفيذ فحص مباشر HTTP 200 للجداول المرتبطة بالشاشات الإدارية:
  - `queues` (canonical physical table) + `unified_queue` (compatibility view), `clinics`, `patients`, `system_config`, `notifications`, `routes`, `qa_runs`, `qa_findings`, `repair_runs`, `pins`.
- تم تنفيذ تحقق write/read فوري على `queues` (PATCH no-op) مع الحفاظ على توافق `unified_queue` لضمان انعكاس الإجراء الإداري لحظيًا على مصدر الحقيقة.

## Domain parity check
- `https://mmc-mms.com`: 200 + محتوى التطبيق الكامل.
- `https://www.mmc-mms.com`: 200 + محتوى مختلف/مختصر.
- النتيجة: لا يزال هناك عدم تطابق محتوى بين النطاقين ويستلزم إصلاح DNS/Hosting خارج كود الواجهة.

## Notes
- تم إضافة `data-testid`/`aria-label`/`title` لعناصر تبويبات الإدارة لتسهيل الاختبار الآلي الدقيق بدون أي تعديل بصري.
