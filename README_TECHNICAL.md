# توثيق نظام اللجنة الطبية العسكرية (MMC Medical Committee App)

## نظرة عامة
هذا النظام مصمم لإدارة طوابير الانتظار والعمليات الطبية في اللجنة الطبية العسكرية. يعتمد النظام على **React** للواجهة الأمامية و **Supabase** للباك اند.

## الهيكل التقني
- **الواجهة الأمامية (Frontend):** مستودع `love` مستضاف على Vercel.
- **الباك اند (Backend):** Supabase (Database, Auth, Edge Functions).
- **قاعدة البيانات:** PostgreSQL عبر Supabase.

## هيكل الملفات الرئيسي
- `/frontend/src/core`: يحتوي على المحركات الأساسية مثل `notification-engine.js` و `event-bus.js`.
- `/frontend/src/components`: المكونات القابلة لإعادة الاستخدام.
- `/frontend/src/pages`: صفحات التطبيق (الإدارة، المراجعين، العيادات).
- `/supabase/functions`: وظائف Edge Functions للعمليات المعقدة مثل إنشاء الـ PIN.

## مسارات الـ API (Supabase)
- **REST API:** `https://rujwuruuosffcxazymit.supabase.co/rest/v1/`
- **Edge Functions:** `https://rujwuruuosffcxazymit.supabase.co/functions/v1/`
  - `pin-generate`: لإنشاء رموز الدخول للعيادات.
  - `pin-status`: للتحقق من حالة الرموز.

## معايير القبول والتشغيل
1. **الإشعارات:** تعمل لحظياً عبر `RealtimeNotificationEngine`.
2. **اللغة:** دعم كامل للغتين العربية والإنجليزية مع تبديل لحظي.
3. **الإدارة:** شاشة إحصاءات وتقارير شاملة تظهر فقط للمخولين.
4. **الطباعة:** دعم طباعة التقارير الرسمية بالشعار والختم.

## الإصلاحات الأخيرة
- تم إصلاح خطأ في `notification-engine.js` كان يمنع بناء المشروع (Build Error).
- تم تحديث متغيرات البيئة لربط التطبيق بـ Supabase بشكل صحيح.
- تم التأكد من استقرار عملية البناء والنشر على Vercel.

---
**ملاحظة:** الكود يعتبر سرياً ومخصصاً للإدارة فقط. يمنع تغيير المنطق الأساسي دون إذن.
