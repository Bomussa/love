# تحليل بنية Backend الحالي - مشروع Love

## المعلومات الأساسية

**المشروع:** love (Medical Committee System)  
**المنصة الحالية:** Cloudflare Pages + Vercel  
**الدومين:** mmc-mms.com  
**Framework:** Next.js + Vite  
**Node Version:** 18.17 - 20.x

---

## بنية Backend الحالية

### 1. API Endpoints (Cloudflare Pages Functions)

تم العثور على **22 ملف API** في مجلد `./functions/`:

#### API Routes الرئيسية:

**Admin APIs:**
- `/admin/login.js` - تسجيل دخول المدير
- `/api/v1/admin/set-call-interval.js` - تعيين فترة الاستدعاء
- `/api/v1/admin/status.js` - حالة النظام للمدير

**Queue Management APIs:**
- `/api/v1/queue/enter.js` - دخول الطابور
- `/api/v1/queue/position.js` - موقع المستخدم في الطابور
- `/api/v1/queue/status.js` - حالة الطابور
- `/api/v1/queue/call.js` - استدعاء المريض التالي
- `/api/v1/queue/done.js` - إنهاء خدمة المريض

**PIN Management APIs:**
- `/api/v1/pin/generate.js` - توليد رمز PIN
- `/api/v1/pin/status.js` - حالة رمز PIN

**Patient APIs:**
- `/api/v1/patient/login.js` - تسجيل دخول المريض

**Route Management APIs:**
- `/api/v1/route/create.js` - إنشاء مسار
- `/api/v1/route/get.js` - الحصول على مسار
- `/api/v1/path/choose.js` - اختيار مسار

**Statistics APIs:**
- `/api/v1/stats/dashboard.js` - إحصائيات لوحة التحكم
- `/api/v1/stats/queues.js` - إحصائيات الطوابير

**Health & Monitoring:**
- `/api/v1/health/status.js` - حالة صحة النظام
- `/api/v1/notify/status.js` - حالة الإشعارات
- `/api/v1/events/stream.js` - بث الأحداث (SSE)

**Configuration:**
- `/config/clinic-pins.js` - تكوين رموز العيادات

**Shared Utilities:**
- `/functions/_shared/utils.js` - أدوات مشتركة
- `/functions/_middleware.js` - Middleware عام

---

### 2. قاعدة البيانات - Cloudflare KV Storage

يستخدم النظام **6 KV Namespaces** مختلفة:

| Binding | ID | الاستخدام |
|---------|-----|-----------|
| `KV_ADMIN` | fd4470d6a7f34709b3486b1ab0ade4e7 | بيانات المدراء والإعدادات |
| `KV_PINS` | 7d71bfe9e606486f9124400a4f3c34e2 | رموز PIN للمرضى |
| `KV_QUEUES` | 046e391c8e6d4120b3619fa69456fc72 | بيانات الطوابير |
| `KV_EVENTS` | 250f2f79e4fe4d42b1db529123a3f5a1 | الأحداث والإشعارات |
| `KV_LOCKS` | 99b12b0fa33e4d57a8bd1447ab80236f | Locks للتزامن |
| `KV_CACHE` | 1d3d4e6c12174b7797b356234794e7e5 | Cache عام |

---

### 3. Middleware Features

**Global Middleware (`_middleware.js`):**
- ✅ WWW Redirect (301)
- ✅ Rate Limiting (60 req/min)
- ✅ CORS Headers
- ✅ Cache-Control Headers
- ✅ IP-based Rate Limiting

**معدل الطلبات:**
- 60 طلب/دقيقة لكل IP
- نافذة زمنية: 60 ثانية
- تنظيف تلقائي للذاكرة

---

### 4. Environment Variables

**المتغيرات المكونة:**
```
TIMEZONE = "Asia/Qatar"
JWT_SECRET = "ff8d89d5d43df95e470553e76f3c4ca18f651ad4fdc6ab86b256f4883e6aa220"
PIN_SECRET = "6a1f1a07787035f332b188d623a6395dc50de51bf90a62238ed25b5519ca3194"
NOTIFY_KEY = "https://notify.mmc-mms.com/webhook"
```

---

### 5. CRON Jobs (Scheduled Tasks)

**المهام المجدولة:**
1. `0 0 * * *` (00:00 Qatar time) - إعادة تعيين PINs اليومية
2. `*/1 * * * *` (كل دقيقة) - Notify poller
3. `59 23 * * *` (23:59 Qatar time) - النسخ الاحتياطي والتقارير اليومية

---

## التحديات والمشاكل المحتملة

### 1. **عدم وجود Circuit Breaker**
- لا يوجد نمط Circuit Breaker للخدمات الخارجية
- فشل خدمة واحدة قد يؤدي لانهيار النظام

### 2. **عدم وجود Data Consistency Mechanism**
- لا يوجد آلية لحذف Cache بعد التحديث
- احتمالية ظهور بيانات قديمة أو متناقضة

### 3. **عدم وجود Monitoring & Alerting**
- لا يوجد Prometheus/Grafana
- لا توجد تنبيهات على معدل الأخطاء (5xx)

### 4. **عدم وجود Rollback Strategy**
- لا توجد آلية تراجع تلقائية
- لا يوجد versioning للـ deployments

### 5. **In-Memory Rate Limiting**
- Rate limiting في الذاكرة فقط
- لا يعمل عبر multiple instances

---

## الخطوة التالية: النقل إلى Supabase

### ما سيتم نقله:

1. **API Endpoints** → Supabase Edge Functions
2. **KV Storage** → Supabase PostgreSQL + Redis (Upstash)
3. **Authentication** → Supabase Auth
4. **Real-time Events** → Supabase Realtime
5. **CRON Jobs** → Supabase pg_cron
6. **Rate Limiting** → Supabase + Redis

### ما لن يتم المساس به:

- ❌ Frontend (React/Vite)
- ❌ UI Components
- ❌ Styling (Tailwind)
- ❌ Static Assets

---

## الملاحظات الهامة

⚠️ **خط أحمر:** ممنوع منعاً باتاً العبث بالواجهة الأمامية أو تغييرها أو تعديلها.

✅ **النقل سيشمل فقط:**
- Backend APIs
- Database Layer
- Authentication
- Real-time Features
- Monitoring & Alerting
- Circuit Breaker Implementation
- Data Consistency Mechanisms
