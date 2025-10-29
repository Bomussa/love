# مجلد Manus - الملفات المعزولة

هذا المجلد يحتوي على الملفات التي تم عزلها من المستودع الرئيسي أثناء عملية التنظيف والدمج.

## المحتويات

### 1. old-api/
**الملفات المكررة القديمة للـ API Proxy:**
- `api/` - مجلد API القديم (Edge Runtime)
- `route_old.ts` - نسخة من الـ route القديم

**السبب:** تم دمج هذه الملفات في ملف واحد محسّن `app/api/v1/[...path]/route.ts` يجمع:
- سرعة Edge Runtime
- CORS محسّن ومضبوط
- معالجة أخطاء شاملة
- دعم جميع HTTP methods

### 2. temporary-frontend/
**صفحات Frontend المؤقتة:**
- `page.tsx` - الصفحة الرئيسية
- `layout.tsx` - Layout
- `clinics/` - صفحة العيادات
- `visitor/` - صفحة المراجع

**السبب:** هذه الصفحات كانت placeholders مؤقتة للاختبار. الواجهة الأصلية موجودة على https://mmc-mms.com

### 3. broken-tests/
**اختبارات غير مكتملة:**
- `tests/regression/critical-path.test.js` - يختبر endpoints غير موجودة
- `scripts/test/vercel-health-check.mjs` - يستخدم require() في .mjs

**السبب:** هذه الاختبارات تحتاج إلى إعادة كتابة لتتوافق مع الـ endpoints الحقيقية.

### 4. broken-workflows/
**GitHub Actions workflows غير مكتملة:**
- `.github/workflows/repo-structure.yml` - يشير لملف غير موجود
- `.github/workflows/testing-monitoring.yml` - يشير لاختبارات غير موجودة

**السبب:** تحتاج إلى تحديث لتتوافق مع الهيكل الجديد.

### 5. utilities/
**أدوات مساعدة:**
- `tools/fix-api-paths.js` - أداة لإصلاح مسارات API

**السبب:** أداة utility لمرة واحدة، تم الاحتفاظ بها للرجوع إليها.

## ملاحظات مهمة

- ✅ **لم يتم حذف أي ملف** - جميع الملفات محفوظة هنا
- ✅ **يمكن استرجاع أي ملف** عند الحاجة
- ✅ **التنظيف كان للدمج والتحسين** وليس للحذف
- ✅ **الملف المحسّن** يجمع أفضل ما في الملفات القديمة

## كيفية استرجاع ملف

إذا احتجت لاسترجاع أي ملف:
```bash
# مثال: استرجاع الـ layout القديم
cp manus/temporary-frontend/layout.tsx app/layout.tsx
```

## التاريخ

تم إنشاء هذا المجلد في: 2025-10-29
الهدف: تنظيف وتحسين مستودع love مع الحفاظ على جميع الملفات
