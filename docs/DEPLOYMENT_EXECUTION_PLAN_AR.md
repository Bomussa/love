# خطة تنفيذ مؤكدة لاستعادة النشر (Frontend + Supabase Integration)

## 1) النطاق الفعلي
- **Frontend**: مستودع `love` على Vercel (`prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM`).
- **Backend Runtime**: Supabase Functions المشار إليها من `vercel.json` عبر rewrite `/api/(.*)`.

## 2) خطة التنفيذ الدقيقة (Timeline)
1. **T0-T10m (Audit سريع إلزامي)**
   - التحقق من `vercel.json` محليًا.
   - التحقق من إعدادات المشروع على Vercel عبر API (`--check`).
2. **T10-T20m (Apply)**
   - فرض إعدادات الاستعادة عبر API (`--apply`).
3. **T20-T35m (Deploy + Monitor)**
   - إطلاق Production deployment (`--redeploy --wait`).
4. **T35-T50m (Smoke Tests)**
   - التحقق من الدومين الأساسي و`www`.
   - التحقق من `/api/api-v1-status`.
5. **T50-T60m (Closure)**
   - توثيق النتيجة + نقطة rollback الجاهزة.

## 3) احتمالات الفشل + التعامل
- **فشل اتصال API (Network/Proxy)**: إعادة التشغيل من بيئة CI مع اتصال مباشر.
- **غياب ربط Git في Vercel project.link**: تنفيذ Redeploy يدوي من Dashboard بعد `--apply`.
- **فشل Deployment**: جمع logs من deployment ID وتصحيح build/runtime ثم إعادة النشر.

## 4) Rollback points
1. قبل `--apply`: snapshot لإعدادات المشروع الحالية.
2. بعد `--apply` وقبل `--redeploy`: إمكانية العودة للإعدادات السابقة فورًا عبر PATCH.
3. بعد نشر production: إن فشل smoke/UAT يتم Promote لآخر deployment جاهز.

## 5) اختبارات ما قبل/بعد النشر
- Build محلي: `npm run build --workspace frontend`.
- تحقق الإعدادات: `node scripts/vercel-recover-deploy.mjs --check`.
- تحقق إنتاجي:
  - `curl -I https://mmc-mms.com`
  - `curl -I https://www.mmc-mms.com`
  - `curl https://mmc-mms.com/api/api-v1-status`

## 6) معايير الإغلاق
- لا mismatch في إعدادات Vercel الأساسية.
- deployment production بحالة `READY`.
- استجابة النطاقين سليمة، و`www` يطابق مسار العرض المتفق.
- endpoint الصحي لا يرجع 5xx.
