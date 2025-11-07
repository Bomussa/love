# مجلد الملفات المعزولة (_ARCHIVED)

تم إنشاء هذا المجلد لعزل جميع الملفات القديمة والمعطلة بعيداً عن التطبيق الرئيسي لتجنب التضارب.

## البنية التنظيمية:

### 1. `conflict-backups/`
نسخ احتياطية من الملفات التي كانت تحتوي على Git merge conflicts قبل الإصلاح.

**الملفات:**
- `AdminPage.jsx` - شاشة الإدارة (قبل حل الـ conflicts)
- `PatientPage.jsx` - شاشة المريض (قبل حل الـ conflicts)
- `event-bus.js` - نظام الأحداث (قبل حل الـ conflicts)
- `dynamic-pathways.js` - المسارات الديناميكية (قبل حل الـ conflicts)

**السبب:** كانت تحتوي على علامات `<<<<<<< HEAD` و `=======` و `>>>>>>>` التي تمنع عمل التطبيق.

**الحل:** تم حل جميع الـ conflicts بذكاء واختيار أفضل كود من كل نسخة.

---

### 2. `old-api-clients/`
API clients القديمة التي كانت تتصل مباشرة بـ Supabase بدلاً من استخدام Vercel API layer.

**الملفات:**
- `supabase-backend-api.js` - كان يتصل مباشرة بـ Supabase Client
- `local-api.js` - كان يستخدم localStorage (للتطوير فقط)

**السبب:** 
- لا تمر عبر `/api/v1/` endpoints في Vercel
- تتجاوز API proxy layer
- لا تستفيد من caching و monitoring

**الحل:** تم استبدالها بـ `vercel-api-client.js` الذي يستخدم `/api/v1/` endpoints بشكل صحيح.

---

### 3. `deprecated-files/`
ملفات قديمة لم تعد مستخدمة في التطبيق.

**الملفات:**
- `index.js.backup` - نسخة قديمة من API index
- `queue-engine.backup.js` - نسخة قديمة من Queue engine
- `package.json.backup` - نسخة قديمة من package.json

**السبب:** تم استبدالها بنسخ محدثة ومحسنة.

---

### 4. `replaced-components/`
مكونات React تم استبدالها بنسخ محسنة.

**حالياً فارغ** - سيتم إضافة المكونات المستبدلة هنا مستقبلاً.

---

## ملاحظات مهمة:

1. **لا تحذف هذا المجلد** - يحتوي على نسخ احتياطية مهمة للرجوع إليها عند الحاجة.

2. **لا تستخدم الملفات من هذا المجلد** - هذه الملفات معطلة أو قديمة ولا تعمل بشكل صحيح.

3. **للمطورين فقط** - إذا كنت بحاجة لفهم كيف كان التطبيق يعمل سابقاً، يمكنك الرجوع لهذه الملفات.

4. **التاريخ:** تم إنشاء هذا المجلد في 2025-11-07 أثناء إصلاح شامل للتطبيق.

---

## الملفات النشطة الحالية:

### API Client (النشط):
- `frontend/src/lib/vercel-api-client.js` ✅ يستخدم `/api/v1/` endpoints
- `frontend/src/lib/api-unified.js` ✅ wrapper موحد يستخدم vercel-api-client

### Components (النشطة):
- `frontend/src/components/AdminPage.jsx` ✅ بدون conflicts
- `frontend/src/components/PatientPage.jsx` ✅ بدون conflicts

### Core (النشط):
- `frontend/src/core/event-bus.js` ✅ بدون conflicts
- `frontend/src/lib/dynamic-pathways.js` ✅ بدون conflicts

---

## للصيانة المستقبلية:

عند إصلاح أي ملف:
1. انسخ النسخة القديمة إلى المجلد المناسب في `_ARCHIVED/`
2. أضف تعليق في هذا الملف يشرح السبب والتاريخ
3. لا تحذف الملف القديم - فقط اعزله

---

**آخر تحديث:** 2025-11-07
**المهندس المسؤول:** Manus AI Agent
**الهدف:** ضمان استقرار التطبيق بنسبة 100% بدون تضارب
