# 🎯 دليل توجيه نقطة الاتصال (Endpoint Mapping Guide)

**النسخة:** 3.0.0  
**التاريخ:** 30 أكتوبر 2025  
**الحالة:** ✅ Production Ready

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [البنية المعمارية](#البنية-المعمارية)
3. [خطوات التوجيه](#خطوات-التوجيه)
4. [الإعدادات المطلوبة](#الإعدادات-المطلوبة)
5. [التحقق من الإعدادات](#التحقق-من-الإعدادات)
6. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## 🎯 نظرة عامة

يشرح هذا الدليل كيفية توجيه طلبات API من Frontend (Vercel) إلى Backend (Supabase) باستخدام عنوان النطاق العام HTTPS.

### المفهوم الأساسي

```
User Browser → Frontend (mmc-mms.com) → Vercel Proxy → Supabase Edge Functions
```

**الهدف:** التأكد من أن جميع طلبات API تصل إلى Supabase بشكل صحيح عبر النطاق العام.

---

## 🏗️ البنية المعمارية

### 1. Frontend (Vercel)
- **النطاق:** `https://mmc-mms.com`
- **Framework:** Vite + React 18
- **API Client:** `/src/lib/api.js`

### 2. Vercel Proxy Layer
- **الملف:** `vercel.json`
- **الوظيفة:** إعادة توجيه `/api/v1/*` إلى Supabase

### 3. Backend (Supabase)
- **النطاق:** `https://rujwuruuosffcxazymit.supabase.co`
- **Edge Functions:** 24 function
- **المسار:** `/functions/v1/{function-name}`

---

## 🔄 خطوات التوجيه

### الخطوة 1: إعداد Frontend API Client

**الملف:** `/src/lib/api.js`

```javascript
// تحديد API Base URLs
function resolveApiBases() {
  const bases = []
  
  // 1. من Environment Variables (أولوية عالية)
  const envBase = (import.meta.env.VITE_API_BASE || '').trim()
  if (envBase) bases.push(envBase)
  
  // 2. أثناء التطوير (localhost)
  if (import.meta.env.DEV) {
    bases.push('http://localhost:3000')
  }
  
  // 3. الإنتاج (نفس النطاق)
  bases.push(window.location.origin)
  
  return Array.from(new Set(bases))
}

const API_BASES = resolveApiBases()
```

**النتيجة:**
- **Development:** `http://localhost:3000` أو `http://localhost:5173`
- **Production:** `https://mmc-mms.com`

---

### الخطوة 2: تحويل Endpoint إلى Function Name

**الملف:** `/src/lib/api.js`

```javascript
async request(endpoint, options = {}) {
  // تحويل المسار القديم إلى Supabase Function name
  // مثال: /patient/login → patient-login
  const functionName = endpoint.replace(/^\//, '').replace(/\//g, '-')
  
  // إضافة Supabase Authorization header
  const authHeaders = {}
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (supabaseKey) {
    authHeaders['Authorization'] = `Bearer ${supabaseKey}`
  }
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers
    },
    ...options
  }
  
  // بناء URL النهائي
  for (const base of API_BASES) {
    const isSupabase = base.includes('supabase.co')
    const path = isSupabase ? `/${functionName}` : endpoint
    const url = `${base}${path}`
    
    try {
      const response = await fetch(url, config)
      // ... معالجة الاستجابة
    } catch (err) {
      // ... معالجة الأخطاء
    }
  }
}
```

**أمثلة على التحويل:**

| Endpoint القديم | Function Name | URL النهائي |
|-----------------|---------------|-------------|
| `/patient/login` | `patient-login` | `https://mmc-mms.com/api/v1/patient-login` |
| `/queue/enter` | `queue-enter` | `https://mmc-mms.com/api/v1/queue-enter` |
| `/pin/generate` | `pin-generate` | `https://mmc-mms.com/api/v1/pin-generate` |
| `/stats/dashboard` | `stats-dashboard` | `https://mmc-mms.com/api/v1/stats-dashboard` |

---

### الخطوة 3: إعداد Vercel Proxy

**الملف:** `vercel.json`

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/v1/(.*)",
      "destination": "https://rujwuruuosffcxazymit.supabase.co/functions/v1/$1"
    }
  ],
  "headers": [
    {
      "source": "/api/v1/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" },
        { "key": "Connection", "value": "keep-alive" }
      ]
    }
  ]
}
```

**الشرح:**

1. **`rewrites`:** إعادة توجيه جميع الطلبات من `/api/v1/*` إلى Supabase
2. **`$1`:** يمثل الجزء المتغير من URL (function name)
3. **`headers`:** إضافة headers لتحسين الأداء

**مثال على التوجيه:**

```
طلب من المتصفح:
https://mmc-mms.com/api/v1/patient-login

↓ Vercel Proxy يحوله إلى:

https://rujwuruuosffcxazymit.supabase.co/functions/v1/patient-login
```

---

### الخطوة 4: إعداد Environment Variables

**ملف:** `.env.local` (للتطوير)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# API Base (اختياري - للتطوير فقط)
VITE_API_BASE=http://localhost:3000
```

**على Vercel (Production):**

1. اذهب إلى: `Vercel Dashboard → Project → Settings → Environment Variables`
2. أضف:
   - `VITE_SUPABASE_URL` = `https://rujwuruuosffcxazymit.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your_anon_key_here`

---

## ✅ الإعدادات المطلوبة

### 1. Frontend (`src/lib/api.js`)

✅ **تحديد API_BASES بشكل صحيح**
```javascript
const API_BASES = resolveApiBases()
// Production: ['https://mmc-mms.com']
```

✅ **تحويل Endpoint إلى Function Name**
```javascript
const functionName = endpoint.replace(/^\//, '').replace(/\//g, '-')
```

✅ **إضافة Authorization Header**
```javascript
authHeaders['Authorization'] = `Bearer ${supabaseKey}`
```

---

### 2. Vercel Configuration (`vercel.json`)

✅ **Framework صحيح**
```json
"framework": "vite"
```

✅ **Output Directory صحيح**
```json
"outputDirectory": "dist"
```

✅ **Rewrites صحيحة**
```json
"rewrites": [
  {
    "source": "/api/v1/(.*)",
    "destination": "https://rujwuruuosffcxazymit.supabase.co/functions/v1/$1"
  }
]
```

---

### 3. Environment Variables

✅ **على Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

✅ **في `.env.local` (للتطوير):**
```bash
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=your_key
```

---

## 🔍 التحقق من الإعدادات

### 1. اختبار محلي (Development)

```bash
# 1. تشغيل Frontend
npm run dev

# 2. فتح المتصفح
# http://localhost:5173

# 3. فتح Console
# F12 → Console

# 4. مراقبة Network Requests
# F12 → Network → XHR
```

**ما يجب أن تراه:**

```
Request URL: https://mmc-mms.com/api/v1/patient-login
Request Method: POST
Status Code: 200 OK
```

---

### 2. اختبار الإنتاج (Production)

```bash
# 1. فتح الموقع
https://mmc-mms.com

# 2. فتح Console
F12 → Console

# 3. اختبار API
fetch('https://mmc-mms.com/api/v1/health')
  .then(r => r.json())
  .then(d => console.log(d))
```

**النتيجة المتوقعة:**

```json
{
  "success": true,
  "status": "healthy",
  "backend": "up",
  "platform": "supabase",
  "timestamp": "2025-10-30T...",
  "version": "3.0.0"
}
```

---

### 3. اختبار مباشر من Supabase

```bash
# اختبار مباشر (بدون Vercel Proxy)
curl https://rujwuruuosffcxazymit.supabase.co/functions/v1/health \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**النتيجة المتوقعة:**

```json
{
  "success": true,
  "status": "healthy",
  "backend": "up"
}
```

---

## 🐛 استكشاف الأخطاء

### المشكلة 1: 404 Not Found

**الأعراض:**
```
GET https://mmc-mms.com/api/v1/patient-login → 404
```

**الأسباب المحتملة:**

1. ❌ **Vercel rewrites غير صحيحة**
   ```json
   // خطأ
   "source": "/api/(.*)"
   
   // صحيح
   "source": "/api/v1/(.*)"
   ```

2. ❌ **Function name غير صحيح**
   ```javascript
   // خطأ
   /patient/login → patient/login
   
   // صحيح
   /patient/login → patient-login
   ```

**الحل:**

1. تحقق من `vercel.json`
2. تحقق من تحويل Function name في `api.js`
3. أعد النشر على Vercel

---

### المشكلة 2: 500 Internal Server Error

**الأعراض:**
```
POST https://mmc-mms.com/api/v1/queue-enter → 500
```

**الأسباب المحتملة:**

1. ❌ **Edge Function غير منشورة على Supabase**
2. ❌ **Database Schema غير موجود**
3. ❌ **Authorization header مفقود**

**الحل:**

```bash
# 1. تحقق من Edge Functions
# اذهب إلى: https://supabase.com/dashboard/project/rujwuruuosffcxazymit/functions

# 2. تحقق من Database
# اذهب إلى: https://supabase.com/dashboard/project/rujwuruuosffcxazymit/editor

# 3. تحقق من Authorization
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
```

---

### المشكلة 3: CORS Error

**الأعراض:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**الحل:**

تأكد من وجود CORS headers في Edge Functions:

```typescript
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}
```

---

## 📊 خريطة التوجيه الكاملة

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ https://mmc-mms.com
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Vercel)                              │
│  • React App                                                │
│  • API Client (src/lib/api.js)                              │
│  • Calls: /api/v1/patient-login                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Vercel Proxy (vercel.json rewrites)
                     │ /api/v1/* → Supabase
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              VERCEL PROXY LAYER                             │
│  • Rewrites: /api/v1/(.*) → Supabase                        │
│  • Adds Headers                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ https://rujwuruuosffcxazymit.supabase.co
                     │ /functions/v1/patient-login
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Supabase)                             │
│  • Edge Function: patient-login                             │
│  • Processes Request                                        │
│  • Returns JSON Response                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Response
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Vercel)                              │
│  • Receives Response                                        │
│  • Updates UI                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 الخلاصة

### ✅ الإعدادات الصحيحة

1. **Frontend API Client** يستخدم `window.location.origin` في Production
2. **Vercel rewrites** توجه `/api/v1/*` إلى Supabase
3. **Environment Variables** محددة بشكل صحيح
4. **Edge Functions** منشورة على Supabase
5. **CORS headers** موجودة في جميع Functions

### 🔄 تدفق البيانات

```
User → Frontend → Vercel Proxy → Supabase → Response → Frontend → User
```

### 📝 نقاط مهمة

- ✅ استخدام HTTPS في Production
- ✅ استخدام Authorization header لـ Supabase
- ✅ تحويل Endpoint إلى Function Name بشكل صحيح
- ✅ Vercel rewrites تعمل تلقائياً (لا حاجة لتعديل Frontend)
- ✅ جميع الطلبات تمر عبر `https://mmc-mms.com/api/v1/*`

---

**آخر تحديث:** 30 أكتوبر 2025  
**الإصدار:** 3.0.0  
**الحالة:** ✅ Production Ready
