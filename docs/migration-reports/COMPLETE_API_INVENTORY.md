# جرد شامل لجميع API Endpoints - مشروع Love

**التاريخ:** 29 أكتوبر 2025  
**المشروع:** love (Medical Committee System)  
**المنصة الحالية:** Cloudflare Pages Functions + Vercel  
**الدومين:** mmc-mms.com

---

## ملخص تنفيذي

**إجمالي API Endpoints:** 41 endpoint  
**عدد الملفات:** 47 ملف  
**المواقع الرئيسية:**
1. `/functions/` - Cloudflare Pages Functions (22 ملف)
2. `/infra/mms-api/` - Worker API الرئيسي (1 ملف كبير - 1017 سطر)
3. `/infra/worker-api/` - Proxy Worker (1 ملف - 242 سطر)
4. `/app/api/` - Next.js API Routes (5 ملفات)
5. `/src/pages/api/` - Pages API Routes (5 ملفات)
6. `/mms-core/src/api/` - Core API Logic (4 ملفات)

---

## القسم 1: Cloudflare Pages Functions (`/functions/`)

### 1.1 Middleware
**الملف:** `/functions/_middleware.js`  
**الوظائف:**
- WWW Redirect (301 Permanent)
- Rate Limiting (60 req/min per IP)
- CORS Headers
- Cache-Control Headers

**الكود الرئيسي:**
```javascript
// Rate limiting: 60 requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
```

---

### 1.2 Shared Utilities
**الملف:** `/functions/_shared/utils.js`  
**الوظائف:**
- `jsonResponse(data, status)` - إنشاء JSON response
- `corsResponse(methods)` - إنشاء CORS response
- `validateRequiredFields(body, fields)` - التحقق من الحقول المطلوبة
- `checkKVAvailability(kv, name)` - التحقق من توفر KV

---

### 1.3 Admin APIs

#### 1.3.1 Admin Login
**الملف:** `/functions/admin/login.js`  
**المسار:** `POST /admin/login`  
**الوظيفة:** تسجيل دخول المدير  
**المدخلات:**
```json
{
  "username": "string",
  "password": "string"
}
```
**المخرجات:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": { "username": "admin" }
}
```
**KV المستخدم:** `KV_ADMIN`

---

#### 1.3.2 Admin Status
**الملف:** `/functions/api/v1/admin/status.js`  
**المسار:** `GET /api/v1/admin/status`  
**الوظيفة:** الحصول على حالة النظام للمدير  
**المخرجات:**
```json
{
  "success": true,
  "queues": {...},
  "stats": {...},
  "system": {...}
}
```
**KV المستخدم:** `KV_QUEUES`, `KV_CACHE`

---

#### 1.3.3 Set Call Interval
**الملف:** `/functions/api/v1/admin/set-call-interval.js`  
**المسار:** `POST /api/v1/admin/set-call-interval`  
**الوظيفة:** تعيين فترة الاستدعاء للعيادة  
**المدخلات:**
```json
{
  "clinic": "string",
  "interval": 300
}
```
**KV المستخدم:** `KV_ADMIN`

---

### 1.4 Queue Management APIs

#### 1.4.1 Queue Enter
**الملف:** `/functions/api/v1/queue/enter.js`  
**المسار:** `POST /api/v1/queue/enter`  
**الوظيفة:** دخول المريض إلى الطابور  
**المدخلات:**
```json
{
  "clinic": "lab",
  "user": "12345"
}
```
**المخرجات:**
```json
{
  "success": true,
  "clinic": "lab",
  "user": "12345",
  "number": 1,
  "status": "WAITING",
  "display_number": 1,
  "ahead": 0,
  "total_waiting": 1,
  "entry_time": "2025-10-29T12:00:00.000Z"
}
```
**KV المستخدم:** `KV_QUEUES`  
**المفاتيح:**
- `queue:list:{clinic}` - قائمة الطابور
- `queue:user:{clinic}:{user}` - بيانات المستخدم

---

#### 1.4.2 Queue Status
**الملف:** `/functions/api/v1/queue/status.js`  
**المسار:** `GET /api/v1/queue/status?clinic=lab`  
**الوظيفة:** الحصول على حالة الطابور  
**المخرجات:**
```json
{
  "success": true,
  "clinic": "lab",
  "list": [...],
  "current_serving": {...},
  "total_waiting": 5
}
```
**KV المستخدم:** `KV_QUEUES`

---

#### 1.4.3 Queue Position
**الملف:** `/functions/api/v1/queue/position.js`  
**المسار:** `GET /api/v1/queue/position?clinic=lab&user=12345`  
**الوظيفة:** الحصول على موقع المستخدم في الطابور  
**المخرجات:**
```json
{
  "success": true,
  "position": 3,
  "ahead": 2,
  "total_waiting": 5
}
```
**KV المستخدم:** `KV_QUEUES`

---

#### 1.4.4 Queue Call
**الملف:** `/functions/api/v1/queue/call.js`  
**المسار:** `POST /api/v1/queue/call`  
**الوظيفة:** استدعاء المريض التالي  
**المدخلات:**
```json
{
  "clinic": "lab"
}
```
**المخرجات:**
```json
{
  "success": true,
  "called": {
    "number": 1,
    "user": "12345",
    "status": "CALLED"
  }
}
```
**KV المستخدم:** `KV_QUEUES`

---

#### 1.4.5 Queue Done
**الملف:** `/functions/api/v1/queue/done.js`  
**المسار:** `POST /api/v1/queue/done`  
**الوظيفة:** إنهاء خدمة المريض  
**المدخلات:**
```json
{
  "clinic": "lab",
  "user": "12345"
}
```
**المخرجات:**
```json
{
  "success": true,
  "message": "Patient service completed"
}
```
**KV المستخدم:** `KV_QUEUES`

---

### 1.5 PIN Management APIs

#### 1.5.1 PIN Status
**الملف:** `/functions/api/v1/pin/status.js`  
**المسار:** `GET /api/v1/pin/status`  
**الوظيفة:** الحصول على حالة جميع PINs  
**المخرجات:**
```json
{
  "success": true,
  "pins": {
    "lab": "12",
    "xray": "34",
    ...
  },
  "generated_at": "2025-10-29T00:00:00.000Z"
}
```
**KV المستخدم:** `KV_PINS`

---

#### 1.5.2 PIN Generate
**الملف:** `/functions/api/v1/pin/generate.js`  
**المسار:** `POST /api/v1/pin/generate`  
**الوظيفة:** توليد PINs جديدة  
**المدخلات:**
```json
{
  "force": true
}
```
**المخرجات:**
```json
{
  "success": true,
  "pins": {...},
  "generated_at": "2025-10-29T12:00:00.000Z"
}
```
**KV المستخدم:** `KV_PINS`

---

### 1.6 Patient APIs

#### 1.6.1 Patient Login
**الملف:** `/functions/api/v1/patient/login.js`  
**المسار:** `POST /api/v1/patient/login`  
**الوظيفة:** تسجيل دخول المريض  
**المدخلات:**
```json
{
  "patientId": "123456789",
  "gender": "male"
}
```
**المخرجات:**
```json
{
  "success": true,
  "data": {
    "id": "session_id",
    "patientId": "123456789",
    "gender": "male",
    "loginTime": "2025-10-29T12:00:00.000Z",
    "status": "logged_in"
  }
}
```
**KV المستخدم:** `KV_CACHE`

---

### 1.7 Route Management APIs

#### 1.7.1 Route Create
**الملف:** `/functions/api/v1/route/create.js`  
**المسار:** `POST /api/v1/route/create`  
**الوظيفة:** إنشاء مسار للمريض  
**المدخلات:**
```json
{
  "patientId": "123456789",
  "clinics": ["lab", "xray", "vitals"]
}
```
**المخرجات:**
```json
{
  "success": true,
  "routeId": "route_123",
  "clinics": [...]
}
```
**KV المستخدم:** `KV_CACHE`

---

#### 1.7.2 Route Get
**الملف:** `/functions/api/v1/route/get.js`  
**المسار:** `GET /api/v1/route/get?routeId=route_123`  
**الوظيفة:** الحصول على مسار المريض  
**المخرجات:**
```json
{
  "success": true,
  "route": {
    "routeId": "route_123",
    "clinics": [...],
    "current": "lab",
    "completed": []
  }
}
```
**KV المستخدم:** `KV_CACHE`

---

#### 1.7.3 Path Choose
**الملف:** `/functions/api/v1/path/choose.js`  
**المسار:** `POST /api/v1/path/choose`  
**الوظيفة:** اختيار مسار المريض  
**المدخلات:**
```json
{
  "patientId": "123456789",
  "path": "male"
}
```
**KV المستخدم:** `KV_CACHE`

---

### 1.8 Statistics APIs

#### 1.8.1 Stats Dashboard
**الملف:** `/functions/api/v1/stats/dashboard.js`  
**المسار:** `GET /api/v1/stats/dashboard`  
**الوظيفة:** إحصائيات لوحة التحكم  
**المخرجات:**
```json
{
  "success": true,
  "total_patients": 100,
  "total_queues": 13,
  "active_queues": 5,
  "stats": {...}
}
```
**KV المستخدم:** `KV_QUEUES`, `KV_CACHE`

---

#### 1.8.2 Stats Queues
**الملف:** `/functions/api/v1/stats/queues.js`  
**المسار:** `GET /api/v1/stats/queues`  
**الوظيفة:** إحصائيات الطوابير  
**KV المستخدم:** `KV_QUEUES`

---

### 1.9 Health & Monitoring APIs

#### 1.9.1 Health Status
**الملف:** `/functions/api/v1/health/status.js`  
**المسار:** `GET /api/v1/health/status`  
**الوظيفة:** فحص صحة النظام  
**المخرجات:**
```json
{
  "success": true,
  "status": "healthy",
  "mode": "online",
  "backend": "up",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "kv": {
    "admin": true,
    "pins": true,
    "queues": true,
    "events": true,
    "locks": true,
    "cache": true
  }
}
```

---

#### 1.9.2 Notify Status
**الملف:** `/functions/api/v1/notify/status.js`  
**المسار:** `GET /api/v1/notify/status`  
**الوظيفة:** حالة نظام الإشعارات  
**KV المستخدم:** `KV_EVENTS`

---

### 1.10 Events & Real-time APIs

#### 1.10.1 Events Stream (SSE)
**الملف:** `/functions/api/v1/events/stream.js`  
**المسار:** `GET /api/v1/events/stream?clinic=lab`  
**الوظيفة:** بث الأحداث في الوقت الفعلي (Server-Sent Events)  
**النوع:** SSE (Server-Sent Events)  
**KV المستخدم:** `KV_EVENTS`

---

### 1.11 Configuration APIs

#### 1.11.1 Clinic PINs
**الملف:** `/functions/config/clinic-pins.js`  
**المسار:** `GET /config/clinic-pins`  
**الوظيفة:** الحصول على تكوين PINs للعيادات  
**KV المستخدم:** `KV_PINS`

---

## القسم 2: Worker API الرئيسي (`/infra/mms-api/`)

**الملف:** `/infra/mms-api/src/index.js` (1017 سطر)  
**الوصف:** Worker API شامل مع جميع الوظائف

### 2.1 الوظائف الإضافية في Worker API

#### 2.1.1 Clinic Exit
**المسار:** `POST /api/v1/clinic/exit`  
**الوظيفة:** خروج المريض من العيادة  
**المدخلات:**
```json
{
  "clinic": "lab",
  "user": "12345"
}
```
**الكود:** سطر 941-943

---

#### 2.1.2 Reports - Daily
**المسار:** `GET /api/v1/reports/daily?date=2025-10-29`  
**الوظيفة:** تقرير يومي  
**المخرجات:**
```json
{
  "success": true,
  "report": {
    "date": "2025-10-29",
    "total_patients": 100,
    "clinics": {...}
  }
}
```
**الكود:** سطر 962-966  
**الدالة:** `generateDailyReport(env, date)`

---

#### 2.1.3 Reports - Weekly
**المسار:** `GET /api/v1/reports/weekly?week=2025-10-22`  
**الوظيفة:** تقرير أسبوعي  
**الكود:** سطر 968-972  
**الدالة:** `generateWeeklyReport(env, weekStart)`

---

#### 2.1.4 Reports - Monthly
**المسار:** `GET /api/v1/reports/monthly?year=2025&month=10`  
**الوظيفة:** تقرير شهري  
**الكود:** سطر 974-978  
**الدالة:** `generateMonthlyReport(env, year, month)`

---

#### 2.1.5 Reports - Annual
**المسار:** `GET /api/v1/reports/annual?year=2025`  
**الوظيفة:** تقرير سنوي  
**الكود:** سطر 981-985  
**الدالة:** `generateAnnualReport(env, year)`

---

### 2.2 الوظائف المساعدة في Worker API

#### 2.2.1 Rate Limiting
**الدالة:** `checkRateLimit(env, clientId)`  
**الكود:** سطر 26-45  
**الحد:** 100 طلب/دقيقة  
**KV المستخدم:** `KV_CACHE`

---

#### 2.2.2 Distributed Lock
**الدوال:**
- `acquireLock(env, resource, timeout)` - سطر 50-69
- `releaseLock(env, resource, lockId)` - سطر 71-81
- `withLock(env, resource, fn)` - سطر 83-91

**KV المستخدم:** `KV_LOCKS`  
**الاستخدام:** منع race conditions في Queue operations

---

#### 2.2.3 Event Emission
**الدالة:** `emitQueueEvent(env, clinic, user, type, position)`  
**الكود:** سطر 130-146  
**KV المستخدم:** `KV_EVENTS`  
**TTL:** 3600 ثانية (ساعة واحدة)

---

### 2.3 Reports Module

**الملف:** `/infra/mms-api/src/reports.js`  
**الوظائف:**
- `generateDailyReport(env, date)`
- `generateWeeklyReport(env, weekStart)`
- `generateMonthlyReport(env, year, month)`
- `generateAnnualReport(env, year)`

---

## القسم 3: Proxy Worker (`/infra/worker-api/`)

**الملف:** `/infra/worker-api/src/index.ts` (242 سطر)  
**الوصف:** Worker للـ Proxy والـ Load Balancing

### 3.1 الوظائف الرئيسية

#### 3.1.1 Health Endpoint
**المسار:** `GET /health`  
**الوظيفة:** فحص صحة Worker والـ Backend  
**المخرجات:**
```json
{
  "ok": true,
  "worker": "up",
  "backend": "up",
  "ts": "2025-10-29T12:00:00.000Z"
}
```
**الكود:** سطر 110-117

---

#### 3.1.2 Dynamic Backend Resolution
**الدالة:** `resolveBackend(env)`  
**الكود:** سطر 44-60  
**الوظيفة:** اختيار Backend ديناميكياً مع Failover  
**Cache:** 60 ثانية

**ترتيب الأولوية:**
1. `BACKEND_ORIGIN`
2. `PRIMARY_ORIGIN`
3. `SECONDARY_ORIGIN`
4. `FALLBACK_ORIGIN`

---

#### 3.1.3 Rate Limiting
**الدالة:** `allowIp(env, ip, maxRequests, windowSeconds)`  
**الكود:** في `/infra/worker-api/src/ratelimit.ts`  
**الحد:** 60 طلب/60 ثانية  
**الكود:** سطر 121-126

---

#### 3.1.4 Admin Protection
**الكود:** سطر 129-160  
**الطرق:**
1. Basic Authentication
2. JWT Bearer Token (HS256)

**المسارات المحمية:** `/api/admin/*`

---

#### 3.1.5 Caching
**النوع:** Cloudflare Cache API  
**TTL:** 45 ثانية  
**الطرق:** GET requests فقط  
**الكود:** سطر 169-218

---

## القسم 4: Next.js API Routes (`/app/api/`)

### 4.1 Dynamic Catch-All Route
**الملف:** `/app/api/v1/[...path]/route.ts`  
**المسار:** `/api/v1/*`  
**الوظيفة:** Dynamic routing لجميع API calls

---

### 4.2 PIN Status Route
**الملف:** `/app/api/v1/pin/status/route.ts`  
**المسار:** `GET /api/v1/pin/status`

---

### 4.3 Queue Route
**الملف:** `/app/api/v1/queue/route.ts`  
**المسار:** `/api/v1/queue`

---

### 4.4 Daily Reports Route
**الملف:** `/app/api/v1/reports/daily/route.ts`  
**المسار:** `GET /api/v1/reports/daily`

---

### 4.5 Status Route
**الملف:** `/app/api/v1/status/route.ts`  
**المسار:** `GET /api/v1/status`

---

## القسم 5: Pages API Routes (`/src/pages/api/`)

### 5.1 Admin Settings
**الملف:** `/src/pages/api/admin/settings.js`  
**المسار:** `/api/admin/settings`

---

### 5.2 Patient Enqueue
**الملف:** `/src/pages/api/patient/enqueue.js`  
**المسار:** `POST /api/patient/enqueue`

---

### 5.3 Queue Call Next
**الملف:** `/src/pages/api/queue/call-next.js`  
**المسار:** `POST /api/queue/call-next`

---

### 5.4 Queue Complete
**الملف:** `/src/pages/api/queue/complete.js`  
**المسار:** `POST /api/queue/complete`

---

### 5.5 Queue Status
**الملف:** `/src/pages/api/queue/status.js`  
**المسار:** `GET /api/queue/status`

---

### 5.6 System Tick
**الملف:** `/src/pages/api/system/tick.js`  
**المسار:** `POST /api/system/tick`  
**الوظيفة:** CRON job للمهام الدورية

---

## القسم 6: Core API Logic (`/mms-core/src/api/`)

### 6.1 Events Routes
**الملف:** `/mms-core/src/api/routes/events.ts`  
**الوظيفة:** منطق الأحداث الأساسي

---

### 6.2 PIN Routes
**الملف:** `/mms-core/src/api/routes/pin.ts`  
**الوظيفة:** منطق PIN الأساسي

---

### 6.3 Queue Routes
**الملف:** `/mms-core/src/api/routes/queue.ts`  
**الوظيفة:** منطق Queue الأساسي

---

### 6.4 Route Routes
**الملف:** `/mms-core/src/api/routes/route.ts`  
**الوظيفة:** منطق Routing الأساسي

---

## القسم 7: KV Storage Schema

### 7.1 KV_ADMIN
**Binding ID:** `fd4470d6a7f34709b3486b1ab0ade4e7`  
**المفاتيح:**
- `admin:user:{username}` - بيانات المدير
- `admin:settings:{key}` - إعدادات النظام
- `admin:call-interval:{clinic}` - فترة الاستدعاء

---

### 7.2 KV_PINS
**Binding ID:** `7d71bfe9e606486f9124400a4f3c34e2`  
**المفاتيح:**
- `pins:daily:{date}` - PINs اليومية
- `pins:current` - PINs الحالية

---

### 7.3 KV_QUEUES
**Binding ID:** `046e391c8e6d4120b3619fa69456fc72`  
**المفاتيح:**
- `queue:list:{clinic}` - قائمة الطابور
- `queue:user:{clinic}:{user}` - بيانات المستخدم
- `queue:status:{clinic}` - حالة الطابور

---

### 7.4 KV_EVENTS
**Binding ID:** `250f2f79e4fe4d42b1db529123a3f5a1`  
**المفاتيح:**
- `event:{clinic}:{user}:{timestamp}` - الأحداث
**TTL:** 3600 ثانية

---

### 7.5 KV_LOCKS
**Binding ID:** `99b12b0fa33e4d57a8bd1447ab80236f`  
**المفاتيح:**
- `lock:{resource}` - Distributed locks
**TTL:** 60 ثانية (minimum)

---

### 7.6 KV_CACHE
**Binding ID:** `1d3d4e6c12174b7797b356234794e7e5`  
**المفاتيح:**
- `patient:{sessionId}` - بيانات المريض
- `ratelimit:{clientId}` - Rate limiting
- `route:{routeId}` - مسارات المرضى

---

## القسم 8: Environment Variables

```bash
TIMEZONE = "Asia/Qatar"
JWT_SECRET = "ff8d89d5d43df95e470553e76f3c4ca18f651ad4fdc6ab86b256f4883e6aa220"
PIN_SECRET = "6a1f1a07787035f332b188d623a6395dc50de51bf90a62238ed25b5519ca3194"
NOTIFY_KEY = "https://notify.mmc-mms.com/webhook"
```

---

## القسم 9: CRON Jobs

### 9.1 Daily PIN Reset
**الجدول:** `0 0 * * *` (00:00 Qatar time)  
**الوظيفة:** إعادة تعيين PINs اليومية

---

### 9.2 Notify Poller
**الجدول:** `*/1 * * * *` (كل دقيقة)  
**الوظيفة:** فحص الإشعارات

---

### 9.3 Daily Backup
**الجدول:** `59 23 * * *` (23:59 Qatar time)  
**الوظيفة:** النسخ الاحتياطي والتقارير اليومية

---

## القسم 10: قائمة شاملة بجميع API Endpoints

| # | Method | Path | الملف | الوظيفة |
|---|--------|------|-------|---------|
| 1 | GET | `/api/v1/health/status` | `/functions/api/v1/health/status.js` | فحص صحة النظام |
| 2 | GET | `/health` | `/infra/worker-api/src/index.ts` | فحص صحة Worker |
| 3 | POST | `/admin/login` | `/functions/admin/login.js` | تسجيل دخول المدير |
| 4 | GET | `/api/v1/admin/status` | `/functions/api/v1/admin/status.js` | حالة النظام للمدير |
| 5 | POST | `/api/v1/admin/set-call-interval` | `/functions/api/v1/admin/set-call-interval.js` | تعيين فترة الاستدعاء |
| 6 | POST | `/api/v1/patient/login` | `/functions/api/v1/patient/login.js` | تسجيل دخول المريض |
| 7 | POST | `/api/v1/queue/enter` | `/functions/api/v1/queue/enter.js` | دخول الطابور |
| 8 | GET | `/api/v1/queue/status` | `/functions/api/v1/queue/status.js` | حالة الطابور |
| 9 | GET | `/api/v1/queue/position` | `/functions/api/v1/queue/position.js` | موقع في الطابور |
| 10 | POST | `/api/v1/queue/call` | `/functions/api/v1/queue/call.js` | استدعاء المريض |
| 11 | POST | `/api/v1/queue/done` | `/functions/api/v1/queue/done.js` | إنهاء الخدمة |
| 12 | GET | `/api/v1/pin/status` | `/functions/api/v1/pin/status.js` | حالة PINs |
| 13 | POST | `/api/v1/pin/generate` | `/functions/api/v1/pin/generate.js` | توليد PINs |
| 14 | POST | `/api/v1/route/create` | `/functions/api/v1/route/create.js` | إنشاء مسار |
| 15 | GET | `/api/v1/route/get` | `/functions/api/v1/route/get.js` | الحصول على مسار |
| 16 | POST | `/api/v1/path/choose` | `/functions/api/v1/path/choose.js` | اختيار مسار |
| 17 | POST | `/api/v1/clinic/exit` | `/infra/mms-api/src/index.js` | خروج من العيادة |
| 18 | GET | `/api/v1/stats/queues` | `/functions/api/v1/stats/queues.js` | إحصائيات الطوابير |
| 19 | GET | `/api/v1/stats/dashboard` | `/functions/api/v1/stats/dashboard.js` | لوحة التحكم |
| 20 | GET | `/api/v1/events/stream` | `/functions/api/v1/events/stream.js` | بث الأحداث SSE |
| 21 | GET | `/api/v1/notify/status` | `/functions/api/v1/notify/status.js` | حالة الإشعارات |
| 22 | GET | `/api/v1/reports/daily` | `/infra/mms-api/src/index.js` | تقرير يومي |
| 23 | GET | `/api/v1/reports/weekly` | `/infra/mms-api/src/index.js` | تقرير أسبوعي |
| 24 | GET | `/api/v1/reports/monthly` | `/infra/mms-api/src/index.js` | تقرير شهري |
| 25 | GET | `/api/v1/reports/annual` | `/infra/mms-api/src/index.js` | تقرير سنوي |
| 26 | GET | `/config/clinic-pins` | `/functions/config/clinic-pins.js` | تكوين PINs |
| 27 | GET | `/api/admin/settings` | `/src/pages/api/admin/settings.js` | إعدادات المدير |
| 28 | POST | `/api/patient/enqueue` | `/src/pages/api/patient/enqueue.js` | إضافة للطابور |
| 29 | POST | `/api/queue/call-next` | `/src/pages/api/queue/call-next.js` | استدعاء التالي |
| 30 | POST | `/api/queue/complete` | `/src/pages/api/queue/complete.js` | إكمال الخدمة |
| 31 | GET | `/api/queue/status` | `/src/pages/api/queue/status.js` | حالة الطابور |
| 32 | POST | `/api/system/tick` | `/src/pages/api/system/tick.js` | CRON tick |
| 33 | * | `/api/v1/*` | `/app/api/v1/[...path]/route.ts` | Dynamic routing |
| 34 | GET | `/api/v1/pin/status` | `/app/api/v1/pin/status/route.ts` | حالة PIN |
| 35 | * | `/api/v1/queue` | `/app/api/v1/queue/route.ts` | Queue operations |
| 36 | GET | `/api/v1/reports/daily` | `/app/api/v1/reports/daily/route.ts` | تقرير يومي |
| 37 | GET | `/api/v1/status` | `/app/api/v1/status/route.ts` | حالة النظام |

---

## القسم 11: التحديات والمشاكل

### 11.1 عدم وجود Circuit Breaker
❌ لا يوجد نمط Circuit Breaker للخدمات الخارجية

### 11.2 عدم وجود Data Consistency
❌ لا توجد آلية لحذف Cache بعد التحديث

### 11.3 عدم وجود Monitoring
❌ لا يوجد Prometheus/Grafana  
❌ لا توجد تنبيهات على 5xx errors

### 11.4 عدم وجود Rollback Strategy
❌ لا توجد آلية تراجع تلقائية

### 11.5 In-Memory Rate Limiting
⚠️ Rate limiting في الذاكرة فقط (لا يعمل عبر instances)

---

## القسم 12: خطة النقل إلى Supabase

### 12.1 ما سيتم نقله

✅ **API Endpoints** → Supabase Edge Functions (37 endpoint)  
✅ **KV Storage** → PostgreSQL + Redis (Upstash)  
✅ **Authentication** → Supabase Auth  
✅ **Real-time Events** → Supabase Realtime  
✅ **CRON Jobs** → Supabase pg_cron  
✅ **Rate Limiting** → Redis-based  
✅ **Distributed Locks** → Redis-based  
✅ **Reports** → PostgreSQL Functions

### 12.2 ما لن يتم المساس به

❌ **Frontend** (React/Vite)  
❌ **UI Components**  
❌ **Styling** (Tailwind)  
❌ **Static Assets**

---

## الخلاصة

**إجمالي API Endpoints للنقل:** 37 endpoint فريد  
**إجمالي الملفات:** 47 ملف  
**إجمالي الأسطر البرمجية:** ~3000+ سطر  
**KV Namespaces:** 6  
**CRON Jobs:** 3  
**Environment Variables:** 4

**الحالة:** جاهز للنقل إلى Supabase ✅
