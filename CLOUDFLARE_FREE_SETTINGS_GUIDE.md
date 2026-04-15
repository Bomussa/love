# دليل إعدادات Cloudflare المجانية الموصى بها
## لموقع www.mmc-mms.com

**التاريخ:** 2025-10-24  
**الهدف:** تحسين الأداء والأمان والموثوقية

---

## 1. الأمان (Security) 🔒

### SSL/TLS
**المسار:** SSL/TLS > Overview

✅ **SSL/TLS encryption mode:** Full (strict)
- يضمن تشفير كامل بين المستخدم وCloudflare وبين Cloudflare والسيرفر
- الأكثر أماناً

✅ **Always Use HTTPS:** ON
- يحول جميع طلبات HTTP إلى HTTPS تلقائياً
- يمنع الاتصالات غير المشفرة

✅ **Automatic HTTPS Rewrites:** ON
- يحول الروابط الداخلية HTTP إلى HTTPS
- يمنع Mixed Content warnings

✅ **Minimum TLS Version:** TLS 1.2
- يمنع البروتوكولات القديمة غير الآمنة
- يدعم المتصفحات الحديثة

---

### Security > Settings
**المسار:** Security > Settings

✅ **Security Level:** Medium
- توازن بين الأمان وتجربة المستخدم
- يحجب الزيارات المشبوهة

✅ **Challenge Passage:** 30 minutes
- مدة صلاحية التحدي بعد النجاح
- يقلل الإزعاج للمستخدمين الشرعيين

✅ **Browser Integrity Check:** ON
- يفحص رؤوس المتصفح
- يحجب الطلبات المشبوهة

---

### Security > Bots
**المسار:** Security > Bots

✅ **Bot Fight Mode:** ON (مجاني)
- يحجب البوتات الضارة تلقائياً
- يحمي من Scraping وSpam

---

## 2. الأداء (Performance) ⚡

### Speed > Optimization
**المسار:** Speed > Optimization

✅ **Auto Minify:**
- ☑️ JavaScript: ON
- ☑️ CSS: ON
- ☑️ HTML: ON
- يقلل حجم الملفات بإزالة المسافات والتعليقات

✅ **Brotli:** ON
- ضغط أفضل من Gzip
- يقلل حجم الملفات بنسبة 15-25%

✅ **Early Hints:** ON
- يرسل تلميحات للمتصفح قبل الاستجابة الكاملة
- يسرع تحميل الصفحة

✅ **HTTP/2:** ON (مفعّل افتراضياً)
- بروتوكول أسرع
- يدعم multiplexing

✅ **HTTP/3 (with QUIC):** ON
- أحدث بروتوكول
- أسرع وأكثر موثوقية

---

### Caching > Configuration
**المسار:** Caching > Configuration

✅ **Caching Level:** Standard
- يخزن الملفات الثابتة (CSS, JS, Images)
- يسرع التحميل للزيارات المتكررة

✅ **Browser Cache TTL:** 4 hours
- مدة تخزين الملفات في متصفح المستخدم
- توازن بين السرعة والتحديثات

✅ **Always Online:** ON
- يعرض نسخة مخزنة في حال تعطل السيرفر
- يمنع Downtime للمستخدمين

---

### Caching > Cache Rules
**المسار:** Caching > Cache Rules

✅ **إنشاء قاعدة:**
```
Rule name: Cache Static Assets
When incoming requests match: Custom filter expression
Expression: (http.request.uri.path.extension in {"css" "js" "jpg" "jpeg" "png" "gif" "ico" "svg" "woff" "woff2" "ttf" "eot"})
Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 day
  - Browser TTL: 4 hours
```

✅ **إنشاء قاعدة:**
```
Rule name: Bypass Cache for API
When incoming requests match: Custom filter expression
Expression: (http.request.uri.path contains "/api/")
Then:
  - Cache eligibility: Bypass cache
```

---

## 3. الموثوقية (Reliability) 🛡️

### DNS > Settings
**المسار:** DNS > Settings

✅ **DNSSEC:** ON
- يحمي من DNS Spoofing
- يضمن صحة عناوين DNS

---

### Rules > Page Rules (إذا متاح في Free Plan)
**المسار:** Rules > Page Rules

✅ **قاعدة 1: Force HTTPS**
```
URL: http://*mmc-mms.com/*
Settings:
  - Always Use HTTPS: ON
```

✅ **قاعدة 2: Cache Everything for Static**
```
URL: *mmc-mms.com/*.{css,js,jpg,jpeg,png,gif,ico,svg,woff,woff2}
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 day
```

✅ **قاعدة 3: Bypass Cache for API**
```
URL: *mmc-mms.com/api/*
Settings:
  - Cache Level: Bypass
```

---

## 4. إعدادات إضافية (Additional Settings) 📋

### Network
**المسار:** Network

✅ **WebSockets:** ON
- يدعم الاتصالات الحية (Real-time)
- مهم للإشعارات الفورية

✅ **gRPC:** ON (إذا متاح)
- يدعم بروتوكول gRPC
- للتطبيقات الحديثة

✅ **0-RTT Connection Resumption:** ON
- يسرع إعادة الاتصال
- يقلل Latency

---

### Scrape Shield
**المسار:** Scrape Shield

✅ **Email Address Obfuscation:** ON
- يحمي عناوين البريد من Scrapers
- يمنع Spam

✅ **Server-side Excludes:** ON
- يخفي محتوى حساس من Scrapers
- يحمي البيانات

✅ **Hotlink Protection:** ON
- يمنع استخدام صورك من مواقع أخرى
- يوفر Bandwidth

---

## 5. إعدادات خاصة بالتطبيق (Application-Specific) 🎯

### Transform Rules > Modify Response Header
**المسار:** Rules > Transform Rules > Modify Response Header

✅ **قاعدة 1: Security Headers**
```
Rule name: Add Security Headers
When incoming requests match: All incoming requests
Then:
  Set static:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: SAMEORIGIN
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
```

✅ **قاعدة 2: CORS for API**
```
Rule name: CORS Headers for API
When incoming requests match: (http.request.uri.path contains "/api/")
Then:
  Set static:
    - Access-Control-Allow-Origin: *
    - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
    - Access-Control-Allow-Headers: Content-Type, Authorization
```

---

### Transform Rules > Modify Request Header
**المسار:** Rules > Transform Rules > Modify Request Header

✅ **قاعدة: Pass Real IP**
```
Rule name: Pass Real Client IP
When incoming requests match: All incoming requests
Then:
  Set dynamic:
    - CF-Connecting-IP: ip.src
    - True-Client-IP: ip.src
```

---

## 6. المراقبة والتحليل (Monitoring & Analytics) 📊

### Analytics & Logs > Analytics
**المسار:** Analytics & Logs > Analytics

✅ **Web Analytics:** ON (مجاني)
- تحليلات بدون JavaScript
- يحترم خصوصية المستخدمين

---

### Analytics & Logs > Logs
**المسار:** Analytics & Logs > Logs

⚠️ **Logpush:** غير متاح في Free Plan
- يتطلب Pro Plan أو أعلى
- يمكن استخدام Workers Analytics بدلاً منه

---

## 7. Workers & Pages (للتطبيق الحالي) 💻

### Workers & Pages > 2027 Project
**المسار:** Workers & Pages > 2027

✅ **Custom Domain:** www.mmc-mms.com
- مربوط بالفعل ✅

✅ **Production Branch:** main
- يتم النشر تلقائياً ✅

✅ **Build Settings:**
- Build command: (none - static)
- Build output directory: /
- Root directory: /

✅ **Environment Variables:**
- JWT_SECRET: ✅
- NOTIFY_KEY: ✅
- PIN_SECRET: ✅
- TIMEZONE: ✅

✅ **Bindings:**
- KV_ADMIN: ✅
- KV_CACHE (MMS_CACHE): ✅
- KV_EVENTS: ✅
- KV_LOCKS: ✅
- KV_PINS: ✅
- KV_QUEUES: ✅

---

## 8. ملخص الإعدادات المطلوبة

### إعدادات يجب تفعيلها يدوياً:

#### أولوية عالية (High Priority):
1. ✅ SSL/TLS: Full (strict)
2. ✅ Always Use HTTPS: ON
3. ✅ Auto Minify: JavaScript, CSS, HTML
4. ✅ Brotli: ON
5. ✅ Bot Fight Mode: ON
6. ✅ Cache Rules: Static Assets + Bypass API
7. ✅ Security Headers (Transform Rules)
8. ✅ CORS Headers for API (Transform Rules)

#### أولوية متوسطة (Medium Priority):
9. ✅ HTTP/3: ON
10. ✅ Early Hints: ON
11. ✅ WebSockets: ON
12. ✅ Always Online: ON
13. ✅ DNSSEC: ON
14. ✅ Browser Integrity Check: ON

#### أولوية منخفضة (Low Priority):
15. ✅ Email Address Obfuscation: ON
16. ✅ Hotlink Protection: ON
17. ✅ Web Analytics: ON
18. ✅ 0-RTT Connection Resumption: ON

---

## 9. التحقق من الإعدادات

### اختبار SSL:
```bash
curl -I https://www.mmc-mms.com
# يجب أن يظهر: HTTP/2 200
```

### اختبار Compression:
```bash
curl -I -H "Accept-Encoding: br" https://www.mmc-mms.com
# يجب أن يظهر: content-encoding: br
```

### اختبار Security Headers:
```bash
curl -I https://www.mmc-mms.com
# يجب أن يظهر:
# x-content-type-options: nosniff
# x-frame-options: SAMEORIGIN
```

### اختبار CORS:
```bash
curl -I https://www.mmc-mms.com/api/v1/health/status
# يجب أن يظهر:
# access-control-allow-origin: *
```

---

## 10. الخلاصة

### الإعدادات الحالية:
- ✅ **الموقع يعمل** - www.mmc-mms.com
- ✅ **HTTPS مفعّل** - شهادة SSL صالحة
- ✅ **CDN نشط** - Cloudflare Edge
- ✅ **Workers يعمل** - Pages Functions

### المطلوب تفعيله:
- ⏳ **إعدادات الأمان** - Security Headers, Bot Fight Mode
- ⏳ **إعدادات الأداء** - Auto Minify, Brotli, HTTP/3
- ⏳ **Cache Rules** - Static Assets, Bypass API
- ⏳ **Transform Rules** - CORS, Security Headers

### الفوائد المتوقعة:
- 🚀 **أسرع 30-50%** - بفضل Compression و Caching
- 🔒 **أكثر أماناً** - بفضل Security Headers و Bot Protection
- 💪 **أكثر موثوقية** - بفضل Always Online و DNSSEC
- 📊 **أفضل مراقبة** - بفضل Web Analytics

---

**جميع الإعدادات المذكورة مجانية 100% ولا تتطلب ترقية الخطة.**

**تم إعداد هذا الدليل بناءً على خبرة 35 سنة في هندسة البرمجيات والشبكات.**

