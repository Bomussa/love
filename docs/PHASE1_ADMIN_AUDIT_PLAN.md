# خطة العمل المرحلية – إصلاح شاشات الإدارة (Phase 1)

## النطاق الحالي (منجز في هذا الـ PR)
1. **شاشة الدخول/الإدارة**
   - إصلاح تمرير بيانات دخول الإدارة لتكون كائنًا واضحًا (`username`, `password`) بدل سلسلة مركبة.
   - دعم backward compatibility في التطبيق لقبول الصيغة القديمة بدون كسر.

2. **المسارات الديناميكية**
   - احترام إعداد `ALLOW_DYNAMIC_ROUTES` من `system_settings` قبل توليد المسار.
   - إيقاف التوليد الديناميكي عند تعطيل الإعداد بدل توليد مسارات غير متوافقة.

3. **العمل أوفلاين**
   - إضافة دالة موحدة `sendToServer` في `offline-first-system` لتوحيد عمليات المزامنة (`create/update/delete`) عبر واجهة واحدة.

## تقرير دوري مختصر (الشاشات)
- ✅ الدخول والإدارة: تم إصلاح آلية تمرير بيانات الدخول لتجنب أخطاء parsing.
- ✅ المسارات: تم ربطها بإعداد النظام الحقيقي `ALLOW_DYNAMIC_ROUTES`.
- ✅ أوفلاين (البنية): تم إضافة واجهة مزامنة قياسية قابلة لإعادة الاستخدام.
- ⏳ باقي الشاشات المذكورة (الطوابير، الإشعارات، التقارير، العيادات، الإعدادات، المستخدمين، API Monitor، مركز الملفات...): في خطة PRs لاحقة مستقلة لكل شاشة.

## خطة PRs اللاحقة (لكل شاشة PR منفصل)
1. Dashboard / Admin Controls
2. Queue Management + Secret Numbers
3. Notifications + Routes
4. Reports + Clinics
5. System Status + Settings
6. User Management + Permissions
7. QA/Repair + Smart System
8. Backup/Export + Offline
9. Theme + Database/Data Control
10. API Monitoring + Files Center

## معايير المرور إلى التنفيذ لكل شاشة
- ربط كامل بـ endpoints الحقيقية.
- إزالة أي mock data ظاهر للمستخدم.
- نجاح اختبارات smoke للعمليات الأساسية (إضافة/تعديل/حذف/حفظ/إيقاف).
- فشل أقل من 10% قبل النشر.
