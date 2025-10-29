# Love - MMC-MMS API Proxy

مستودع API Proxy محسّن لنظام اللجنة الطبية العسكرية - العطار (Military Medical Center - Al-Attar).

## 🎯 نظرة عامة

هذا المستودع يوفر طبقة **API Proxy محسّنة** بين الواجهة الأمامية والـ Backend الأساسي، مع:
- ✅ **CORS محسّن** لحل مشكلة التكامل
- ✅ **Edge Runtime** للسرعة القصوى
- ✅ **معالجة أخطاء شاملة**
- ✅ **دعم جميع HTTP methods**
- ✅ **Logging متقدم**

---

## 📁 الهيكل

```
love/
├── app/
│   └── api/v1/              # API endpoints
│       ├── [...path]/       # ✨ Proxy رئيسي محسّن (مدمج)
│       ├── status/          # فحص حالة النظام
│       ├── queue/           # إدارة الطابور
│       ├── pin/status/      # حالة PIN
│       └── reports/daily/   # التقارير اليومية
├── src/
│   └── lib/
│       └── api.js           # مكتبة API للاستدعاءات
├── manus/                   # ملفات معزولة (انظر manus/README.md)
├── package.json
├── vercel.json
├── next.config.js
├── tsconfig.json
└── CHANGES_REPORT.md        # 📋 تقرير التغييرات الشامل
```

---

## 🚀 API Endpoints

### Proxy الرئيسي (محسّن)
- **المسار:** `/api/v1/*`
- **الوصف:** يعيد توجيه جميع الطلبات إلى Backend مع CORS صحيح
- **الملف:** `app/api/v1/[...path]/route.ts`
- **المميزات:**
  - Edge Runtime (سريع)
  - CORS متقدم مع Origin validation
  - معالجة Hop-by-hop headers
  - دعم Credentials
  - Logging شامل

### Status
- **GET** `/api/v1/status`
- يعيد حالة النظام

### Queue
- **GET/POST** `/api/v1/queue`
- إدارة طابور المراجعين

### PIN Status
- **GET** `/api/v1/pin/status`
- التحقق من حالة PIN

### Daily Reports
- **GET** `/api/v1/reports/daily`
- الحصول على التقرير اليومي

---

## ⚙️ متغيرات البيئة

### في Vercel Dashboard:

```bash
FRONTEND_ORIGIN=https://mmc-mms.com
UPSTREAM_API_BASE=https://api.mmc-mms.com/api/v1
```

### للتطوير المحلي (.env.local):

```bash
FRONTEND_ORIGIN=http://localhost:3000
UPSTREAM_API_BASE=https://api.mmc-mms.com/api/v1
CORE_API_BASE=http://localhost:3000/api/v1
```

---

## 🛠️ التطوير

### التثبيت
```bash
npm install
```

### التشغيل المحلي
```bash
npm run dev
```
الموقع سيعمل على: http://localhost:3000

### البناء
```bash
npm run build
```

### البدء (Production)
```bash
npm start
```

---

## 📦 النشر

### على Vercel (تلقائي):
1. Push إلى branch `main`
2. Vercel يبني وينشر تلقائياً
3. تأكد من ضبط متغيرات البيئة في Vercel Dashboard

### يدوياً:
```bash
vercel --prod
```

---

## ✅ حل مشكلة CORS

### المشكلة القديمة:
```
❌ Access to fetch at 'https://api.mmc-mms.com/api/v1/patients' 
   from origin 'https://mmc-mms.com' has been blocked by CORS policy
```

### الحل (تم تطبيقه):

#### 1. في الـ Proxy (هذا المشروع):
```typescript
// CORS Headers الصحيحة:
Access-Control-Allow-Origin: https://mmc-mms.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept
Access-Control-Max-Age: 86400
```

#### 2. في الـ Frontend:
```javascript
// استخدام الـ Proxy بدلاً من الاتصال المباشر:
const API_BASE = 'https://your-proxy.vercel.app/api/v1'; // ✅ الصحيح
// بدلاً من:
const API_BASE = 'https://api.mmc-mms.com/api/v1'; // ❌ الخطأ
```

---

## 🧪 الاختبار

### اختبار CORS:
```bash
curl -X OPTIONS \
  -H "Origin: https://mmc-mms.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://your-deployment.vercel.app/api/v1/patients
```

### اختبار Proxy:
```bash
curl https://your-deployment.vercel.app/api/v1/status
```

### في Browser DevTools:
```javascript
// افتح Console وجرّب:
fetch('/api/v1/status')
  .then(r => r.json())
  .then(console.log)
```

---

## 📊 التقنيات المستخدمة

- **Next.js 14.2.32** - إطار العمل الأساسي
- **React 18.3.1** - مكتبة UI
- **TypeScript 5.6.2** - لغة البرمجة
- **Edge Runtime** - بيئة التشغيل (سريعة)
- **Vercel** - منصة النشر

---

## 📝 التغييرات الأخيرة

### ✨ تم تحسين وتنظيف المستودع:

1. ✅ **دمج ملفات Proxy المكررة** في ملف واحد محسّن
2. ✅ **حل مشكلة CORS** بشكل نهائي
3. ✅ **عزل الملفات غير المستخدمة** في `manus/`
4. ✅ **تنظيف الهيكل** وإزالة التكرار
5. ✅ **الحفاظ على جميع الملفات** (لم يتم حذف أي شيء)

📋 **للتفاصيل الكاملة:** انظر [CHANGES_REPORT.md](./CHANGES_REPORT.md)

---

## 📂 الملفات المعزولة

الملفات في مجلد `manus/`:
- **old-api/** - ملفات Proxy القديمة المكررة
- **temporary-frontend/** - صفحات placeholder مؤقتة
- **broken-tests/** - اختبارات تحتاج لإصلاح
- **broken-workflows/** - GitHub Actions تحتاج لتحديث
- **utilities/** - أدوات مساعدة

📋 **للتفاصيل:** انظر [manus/README.md](./manus/README.md)

---

## 🔗 الروابط المهمة

- **Frontend الأصلي:** https://mmc-mms.com
- **Backend API:** https://api.mmc-mms.com/api/v1
- **Proxy (هذا المشروع):** ينشر على Vercel

---

## 📞 الدعم والمساعدة

### إذا واجهت مشكلة:

1. **تحقق من متغيرات البيئة** في Vercel Dashboard
2. **راجع Logs** في Vercel → Deployments → Logs
3. **تأكد من Backend** يعمل: `curl https://api.mmc-mms.com/api/v1/status`
4. **افحص CORS** في Browser DevTools → Network → Headers

### الأخطاء الشائعة:

| الخطأ | السبب | الحل |
|-------|-------|------|
| CORS blocked | Frontend يتصل مباشرة بـ Backend | استخدم الـ Proxy |
| 502 Bad Gateway | Backend لا يستجيب | تحقق من Backend |
| 404 Not Found | مسار خاطئ | تحقق من URL |

---

## 📜 الترخيص

خاص - المركز الطبي العسكري المتخصص - العطار - اللجنة الطبية

---

**تم التحديث:** 2025-10-29  
**الحالة:** ✅ جاهز للإنتاج
