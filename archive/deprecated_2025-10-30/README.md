# ملفات مؤرشفة - 2025-10-30

## السبب
إصلاح الربط بين Frontend (Vercel) و Backend (Supabase)

## المشكلة الأساسية
كان التطبيق يستخدم `api-unified.js` الذي يعتمد على localStorage بدلاً من الاتصال بـ Supabase.

## الملفات المنقولة

### api-files/
1. **api-unified.js** - كان يستخدم localStorage بدلاً من Supabase (السطر 34: `this.useLocal = true`)
2. **api-adapter.js** - لم يكن مستخدماً في أي مكون
3. **api-selector.js** - لم يكن مستخدماً في أي مكون
4. **local-api.js** - لم يكن مستخدماً في أي مكون
5. **mms-core-api.js** - لم يكن مستخدماً في أي مكون

## الملفات النشطة المتبقية
1. **src/lib/api.js** - الملف الرئيسي للاتصال بـ Supabase
2. **src/lib/enhanced-api.js** - طبقة محسّنة مع Caching و Retry Logic

## التعديلات المطبقة
1. تعديل `src/App.jsx` السطر 10:
   - من: `import api from './lib/api-unified'`
   - إلى: `import api from './lib/api'`

## النتيجة المتوقعة
- التطبيق الآن يتصل بـ Supabase مباشرة
- جميع المميزات يجب أن تعمل:
  - نظام الطابور (Queue)
  - نظام PIN
  - المسارات الديناميكية
  - الإشعارات اللحظية
  - التقارير والإحصائيات
  - شاشات الإدارة

## تاريخ الأرشفة
2025-10-30

## المسؤول
تم بواسطة Manus AI Agent
