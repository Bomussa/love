# دليل نشر API على Cloudflare Workers

**التاريخ:** 25 أكتوبر 2025  
**الوقت المتوقع:** 10-15 دقيقة  
**المستوى:** سهل ⭐⭐

---

## 🎯 لماذا Cloudflare Workers؟

✅ **مجاني:** حتى 100,000 طلب/يوم  
✅ **سريع:** استجابة أقل من 50ms  
✅ **موثوق:** uptime 99.99%  
✅ **الكود جاهز:** موجود في `infra/mms-api/src/index.js`  
✅ **يعمل مسبقاً:** المشروع كان يعمل على Cloudflare

---

## 📋 المتطلبات

- حساب Cloudflare (مجاني)
- Node.js مثبت على جهازك
- الوصول إلى Terminal/Command Line

---

## 🚀 خطوات النشر

### الخطوة 1: تثبيت Wrangler CLI

```bash
npm install -g wrangler
```

**التحقق من التثبيت:**
```bash
wrangler --version
```

---

### الخطوة 2: تسجيل الدخول

```bash
wrangler login
```

سيفتح متصفح للمصادقة. اضغط "Allow" للسماح بالوصول.

---

### الخطوة 3: إنشاء KV Namespaces

قم بتشغيل الأوامر التالية واحدة تلو الأخرى:

```bash
# 1. Admin data
wrangler kv:namespace create "KV_ADMIN"

# 2. PIN codes
wrangler kv:namespace create "KV_PINS"

# 3. Queue data
wrangler kv:namespace create "KV_QUEUES"

# 4. Events
wrangler kv:namespace create "KV_EVENTS"

# 5. Distributed locks
wrangler kv:namespace create "KV_LOCKS"

# 6. Cache
wrangler kv:namespace create "KV_CACHE"
```

**احفظ الـ IDs** التي ستظهر، ستحتاجها في الخطوة التالية.

---

### الخطوة 4: تحديث wrangler.toml

افتح ملف `infra/mms-api/wrangler.toml` وتأكد من أنه يحتوي على:

```toml
name = "mms-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "KV_ADMIN"
id = "YOUR_ADMIN_ID_HERE"

[[kv_namespaces]]
binding = "KV_PINS"
id = "YOUR_PINS_ID_HERE"

[[kv_namespaces]]
binding = "KV_QUEUES"
id = "YOUR_QUEUES_ID_HERE"

[[kv_namespaces]]
binding = "KV_EVENTS"
id = "YOUR_EVENTS_ID_HERE"

[[kv_namespaces]]
binding = "KV_LOCKS"
id = "YOUR_LOCKS_ID_HERE"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "YOUR_CACHE_ID_HERE"
```

**استبدل** `YOUR_XXX_ID_HERE` بالـ IDs من الخطوة السابقة.

---

### الخطوة 5: النشر

```bash
cd infra/mms-api
wrangler deploy
```

**انتظر** حتى يكتمل النشر (10-30 ثانية).

**النتيجة:**
```
✨ Success! Uploaded 1 file (2.3 sec)
Published mms-api (0.45 sec)
  https://mms-api.your-subdomain.workers.dev
```

---

### الخطوة 6: اختبار API

```bash
# اختبار health check
curl https://mms-api.your-subdomain.workers.dev/api/v1/status

# يجب أن تحصل على:
{
  "success": true,
  "status": "healthy",
  "mode": "online",
  "backend": "up",
  "platform": "cloudflare",
  "timestamp": "2025-10-24T..."
}
```

---

### الخطوة 7: تحديث Frontend

الآن يجب تحديث Frontend ليستخدم Worker URL الجديد.

#### الطريقة 1: تحديث ملف الإعدادات

إذا كان هناك ملف `src/config/api.js` أو مشابه:

```javascript
// src/config/api.js
export const API_BASE_URL = 'https://mms-api.your-subdomain.workers.dev';
```

#### الطريقة 2: استخدام Environment Variables

أضف في `.env`:
```
VITE_API_URL=https://mms-api.your-subdomain.workers.dev
```

ثم في الكود:
```javascript
const API_URL = import.meta.env.VITE_API_URL;
```

#### الطريقة 3: البحث والاستبدال

ابحث في جميع ملفات `src/` عن:
- `/api/v1/`
- `localhost`
- أي URL للـ API

واستبدلها بـ:
```javascript
`https://mms-api.your-subdomain.workers.dev/api/v1/`
```

---

### الخطوة 8: إعادة نشر Frontend

```bash
git add .
git commit -m "feat: Connect frontend to Cloudflare Workers API"
git push origin main
```

Vercel سيقوم بإعادة النشر تلقائياً (1-2 دقيقة).

---

## ✅ التحقق النهائي

### 1. اختبار API مباشرة

```bash
# Health check
curl https://mms-api.your-subdomain.workers.dev/api/v1/status

# Patient login
curl -X POST https://mms-api.your-subdomain.workers.dev/api/v1/patient/login \
  -H "Content-Type: application/json" \
  -d '{"personalId":"1234567890","gender":"male"}'
```

### 2. اختبار Frontend

1. افتح https://love-snowy-three.vercel.app
2. سجل دخول برقم تجريبي
3. اختر نوع فحص
4. تحقق من ظهور المسار الطبي
5. جرب الدخول إلى عيادة

---

## 🔧 استكشاف الأخطاء

### خطأ: "KV namespace not found"

**الحل:**
```bash
# تحقق من KV namespaces
wrangler kv:namespace list

# تأكد من أن IDs في wrangler.toml صحيحة
```

### خطأ: "CORS error"

**الحل:**
الكود يحتوي على CORS headers بالفعل، لكن تأكد من:
```javascript
// في infra/mms-api/src/index.js
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

### خطأ: "Worker exceeded CPU time limit"

**الحل:**
```bash
# في wrangler.toml، أضف:
[limits]
cpu_ms = 50
```

---

## 📊 المراقبة

### عرض Logs

```bash
wrangler tail
```

### عرض Analytics

1. افتح Cloudflare Dashboard
2. اذهب إلى Workers & Pages
3. اختر `mms-api`
4. اضغط على "Analytics"

---

## 🎉 تم!

الآن لديك:
- ✅ API يعمل على Cloudflare Workers
- ✅ Frontend يعمل على Vercel
- ✅ نظام كامل ومتكامل

**URL Frontend:** https://love-snowy-three.vercel.app  
**URL API:** https://mms-api.your-subdomain.workers.dev

---

## 📝 ملاحظات مهمة

### الحدود المجانية
- 100,000 طلب/يوم
- 10ms CPU time لكل طلب
- 128MB memory

### للترقية (إذا لزم الأمر)
- Workers Paid: $5/شهر
- 10 مليون طلب/شهر
- لا حدود على CPU time

---

## 🆘 الدعم

إذا واجهت أي مشكلة:
1. راجع [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
2. تحقق من Logs: `wrangler tail`
3. راجع ملف `VERCEL_API_ISSUE.md` للمزيد من التفاصيل

---

**تم إعداده بواسطة:** Manus AI  
**التاريخ:** 25 أكتوبر 2025

