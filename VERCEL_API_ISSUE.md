# مشكلة Vercel API - التشخيص والحلول

**التاريخ:** 25 أكتوبر 2025  
**المشروع:** love (MMC-MMS)  
**URL:** https://love-snowy-three.vercel.app

---

## 🔴 المشكلة

**Vercel لا يتعرف على مجلد `/api` ولا ينشر Serverless Functions**

### الأعراض:
- جميع طلبات `/api/*` تعيد `404: NOT_FOUND`
- حتى ملف الاختبار البسيط `/api/hello.js` لا يعمل
- الكود يعمل بشكل صحيح محلياً عند اختباره بـ Node.js

### الاختبارات التي تمت:
```bash
# ❌ فشل
curl https://love-snowy-three.vercel.app/api/v1/status
# النتيجة: 404 NOT_FOUND

# ❌ فشل
curl https://love-snowy-three.vercel.app/api/hello
# النتيجة: 404 NOT_FOUND

# ✅ نجح محلياً
node -e "import('./api/v1/status.js')..."
# النتيجة: Status 200 - يعمل بشكل صحيح
```

---

## 🔍 التشخيص

### 1. البنية الحالية
```
love/
├── api/                    ✅ موجود
│   ├── package.json       ✅ موجود (type: module)
│   ├── hello.js           ✅ موجود (ملف اختبار)
│   ├── lib/               ✅ موجود
│   │   ├── storage.js
│   │   ├── helpers.js
│   │   ├── routing.js
│   │   └── reports.js
│   └── v1/                ✅ موجود (21 endpoint)
├── vercel.json            ✅ موجود ومحدث
├── package.json           ✅ موجود
└── vite.config.js         ✅ موجود
```

### 2. vercel.json الحالي
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ]
}
```

### 3. الأسباب المحتملة

#### السبب الأكثر احتمالاً:
**Vercel لا ينشر مجلد `/api` عندما يكون المشروع Vite frontend**

عندما يكتشف Vercel أن المشروع هو Vite (frontend framework)، فإنه:
- يبني الـ frontend فقط (`npm run build` → `dist/`)
- يتجاهل مجلد `/api` تماماً
- لا يقوم بإنشاء Serverless Functions

#### أسباب أخرى محتملة:
1. **تعارض في التكوين:** `framework: "vite"` قد يمنع Vercel من رؤية `/api`
2. **مشكلة في Git:** الملفات قد لا تكون مدفوعة بشكل صحيح
3. **مشكلة في Vercel Deployment:** قد يحتاج إلى إعادة تكوين يدوي

---

## 💡 الحلول المقترحة

### الحل 1: إزالة `framework` من vercel.json (الأسرع)
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs20.x"
    }
  }
}
```

### الحل 2: استخدام `builds` بدلاً من `framework`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### الحل 3: نقل API إلى مشروع منفصل
- إنشاء مشروع Vercel منفصل للـ API
- استخدام subdomain: `api.love-snowy-three.vercel.app`
- تحديث CORS في الـ frontend

### الحل 4: استخدام Vercel CLI للنشر اليدوي
```bash
npm install -g vercel
vercel --prod
```

---

## 🎯 الحل الموصى به

**استخدام الحل 2** لأنه:
- يفصل بين بناء Frontend و Backend
- يخبر Vercel بشكل صريح بوجود Serverless Functions
- يحافظ على البنية الحالية

---

## 📝 خطوات التنفيذ

### الخطوة 1: تحديث vercel.json
```bash
# تطبيق الحل 2
```

### الخطوة 2: دفع التغييرات
```bash
git add vercel.json
git commit -m "fix: Use builds configuration for API functions"
git push origin main
```

### الخطوة 3: الانتظار والاختبار
```bash
# الانتظار 1-2 دقيقة
sleep 120

# اختبار
curl https://love-snowy-three.vercel.app/api/hello
curl https://love-snowy-three.vercel.app/api/v1/status
```

### الخطوة 4: إذا لم ينجح - استخدام Vercel CLI
```bash
# تثبيت Vercel CLI
npm install -g vercel

# تسجيل الدخول
vercel login

# ربط المشروع
vercel link

# النشر
vercel --prod
```

---

## 📊 الحالة الحالية

| المكون | الحالة | الملاحظات |
|---|---|---|
| **Frontend** | ✅ يعمل 100% | https://love-snowy-three.vercel.app |
| **API Files** | ✅ موجودة | 21 endpoint + 4 libraries |
| **API Deployment** | ❌ لا يعمل | 404 NOT_FOUND |
| **Local Testing** | ✅ يعمل | الكود صحيح 100% |
| **vercel.json** | ⚠️ يحتاج تعديل | يستخدم `framework` |

---

## 🔧 البدائل

إذا فشلت جميع الحلول أعلاه:

### البديل 1: استخدام Cloudflare Workers (الأصلي)
- المشروع كان يعمل على Cloudflare Workers
- الكود موجود في `infra/mms-api/src/index.js`
- يمكن العودة للنشر على Cloudflare

### البديل 2: استخدام Backend منفصل
- Node.js + Express
- نشر على Railway / Render / Fly.io
- استخدام الكود الموجود في `/api`

### البديل 3: Vercel Edge Functions
- تحويل الكود إلى Edge Functions
- استخدام `@vercel/edge`
- أسرع لكن يحتاج تعديلات

---

## 📌 الخلاصة

**المشكلة:** Vercel لا يتعرف على `/api` في مشاريع Vite  
**السبب:** تعارض بين `framework: "vite"` و Serverless Functions  
**الحل:** استخدام `builds` configuration بدلاً من `framework`  
**البديل:** Vercel CLI للنشر اليدوي

---

**الخطوة التالية:** تطبيق الحل 2 والاختبار

