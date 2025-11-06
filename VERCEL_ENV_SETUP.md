# إعداد متغيرات البيئة في Vercel

## الخطوات المطلوبة

بعد دفع التغييرات إلى GitHub، يجب إضافة متغيرات البيئة التالية في Vercel:

### 1. الانتقال إلى إعدادات المشروع

1. افتح مشروعك في Vercel Dashboard
2. اذهب إلى **Settings** → **Environment Variables**

### 2. إضافة المتغيرات المطلوبة

أضف المتغيرات التالية:

#### API_ORIGIN
- **الاسم**: `API_ORIGIN`
- **القيمة**: `https://mmc-mms.com`
- **البيئات**: Production, Preview, Development (اختر الكل)

#### CORS_ALLOW_ORIGIN
- **الاسم**: `CORS_ALLOW_ORIGIN`
- **القيمة**: `https://www.mmc-mms.com,https://mmc-mms.com,https://love-git-fix-bomussa.vercel.app`
- **البيئات**: Production, Preview, Development (اختر الكل)

> **ملاحظة**: استبدل `love-git-fix-bomussa.vercel.app` بدومين Vercel الخاص بك

### 3. إعادة النشر

بعد إضافة المتغيرات:
1. اذهب إلى تبويب **Deployments**
2. اختر آخر deployment
3. اضغط على القائمة (⋮) واختر **Redeploy**
4. تأكد من تفعيل خيار **Use existing Build Cache** (اختياري)

## ما الذي تم إصلاحه؟

### 1. إزالة أخطاء 502
- تم إلغاء rewrites الخارجية في vercel.json
- تم استبدالها بدوال Proxy تستخدم `API_ORIGIN` من متغيرات البيئة
- دعم كامل لـ CORS و SSE

### 2. إصلاح خطأ TypeScript TS2835
- جميع الاستيرادات النسبية داخل `api/*` تستخدم الآن امتداد `.js`
- تم إنشاء ملفات المساعدة المطلوبة

### 3. تثبيت المسارات الرسمية
- `/api/*` يتحول داخليًا إلى `/api/v1/*`
- دعم endpoints:
  - `/api/v1/health/status`
  - `/api/v1/queue/status`
  - `/api/v1/events/stream` (SSE)

## النتائج المتوقعة في Logs

بعد إعادة النشر، يجب أن ترى:

✅ `GET /api/v1/health/status` → **200**
✅ `GET /api/v1/queue/status` → **200**
✅ `GET /api/v1/events/stream` → **200** (اتصال مفتوح)
✅ اختفاء أخطاء **TS2835** بالكامل
✅ اختفاء أخطاء **502**

## ملاحظة إضافية عن POST 405

إذا كنت لا تزال ترى `POST 405` على `/admin/login`، فهذا يعني أن الفورم في الواجهة الأمامية يرسل POST لنفس مسار الصفحة بدلاً من استدعاء الـ API.

### الحل:
تأكد من أن الفورم يستخدم `fetch` بدلاً من الإرسال الافتراضي:

```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const response = await fetch('/api/v1/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: formData.get('username'),
      password: formData.get('password'),
    }),
  });
  
  // معالجة الاستجابة...
});
```

## التحقق من التكامل

للتحقق من أن كل شيء يعمل بشكل صحيح:

1. افتح Developer Console في المتصفح
2. اذهب إلى تبويب **Network**
3. قم بتحديث الصفحة
4. تحقق من الطلبات إلى `/api/v1/*`
5. يجب أن تكون جميع الطلبات بحالة **200**

## الدعم

إذا واجهت أي مشاكل:
1. تحقق من أن متغيرات البيئة تم إضافتها بشكل صحيح
2. تأكد من إعادة النشر بعد إضافة المتغيرات
3. راجع logs في Vercel للحصول على تفاصيل الأخطاء
