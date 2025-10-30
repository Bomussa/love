# تحليل الملفات المكررة والزائدة

## 1. ملفات API المكررة

### المجموعة A: API Service Files
```
./src/lib/api.js                    ← الملف الرئيسي (615 سطر) ✅ KEEP
./src/lib/enhanced-api.js           ← نسخة محسنة (مكرر) ❌ MERGE or REMOVE
./src/lib/api-routes-map.js         ← خريطة المسارات ✅ KEEP (if used)
```

### المجموعة B: API Routes (Next.js style)
```
./app/api/v1/[...path]/route.ts     ← Next.js catch-all route ❌ REMOVE (not used in Vite)
./app/api/v1/pin/status/route.ts    ❌ REMOVE
./app/api/v1/queue/route.ts         ❌ REMOVE
./app/api/v1/reports/daily/route.ts ❌ REMOVE
./app/api/v1/status/route.ts        ❌ REMOVE
```

### المجموعة C: Pages API Routes
```
./src/pages/api/admin/settings.js   ❌ REMOVE (old Next.js style)
./src/pages/api/patient/enqueue.js  ❌ REMOVE
./src/pages/api/queue/call-next.js  ❌ REMOVE
./src/pages/api/queue/complete.js   ❌ REMOVE
./src/pages/api/queue/status.js     ❌ REMOVE
./src/pages/api/system/tick.js      ❌ REMOVE
```

### المجموعة D: Supabase Edge Functions (Local Copies)
```
./functions/api/v1/                 ⚠️  KEEP (for deployment to Supabase)
  - admin/set-call-interval.js
  - admin/status.js
  - events/stream.js
  - health/status.js
  - notify/status.js
  - path/choose.js
  - patient/login.js
  - pin/generate.js
  - pin/status.js
  - queue/call.js
  - queue/done.js
  - queue/enter.js
  - queue/position.js
  - queue/status.js
  - route/create.js
  - route/get.js
  - stats/dashboard.js
  - stats/queues.js
```

### المجموعة E: Infrastructure APIs
```
./infra/mms-api/                    ❓ CHECK PURPOSE
./infra/worker-api/                 ❓ CHECK PURPOSE
./middleware/                       ❓ CHECK PURPOSE
./mms-core/                         ❓ CHECK PURPOSE
```

---

## 2. خطة التنظيف

### Phase 1: إزالة الملفات الواضحة
- [x] نقل `./app/api/` إلى `archive/` (Next.js routes غير مستخدمة)
- [x] نقل `./src/pages/api/` إلى `archive/` (old style)

### Phase 2: دمج API Services
- [ ] مراجعة `enhanced-api.js` ودمج الميزات المفيدة في `api.js`
- [ ] حذف `enhanced-api.js` بعد الدمج

### Phase 3: تنظيف Infrastructure
- [ ] فحص `infra/mms-api/` - هل يستخدم؟
- [ ] فحص `infra/worker-api/` - هل يستخدم؟
- [ ] فحص `middleware/` - هل يستخدم؟
- [ ] فحص `mms-core/` - هل يستخدم؟

### Phase 4: التحقق من الاستخدام
- [ ] البحث في الكود عن imports من الملفات المكررة
- [ ] تحديث جميع الـ imports للإشارة إلى الملف الرئيسي فقط

---

## 3. الملفات التي يجب الاحتفاظ بها

### Frontend API Layer
```
✅ ./src/lib/api.js                 ← Main API service
✅ ./src/lib/api-routes-map.js      ← Route mapping (if used)
```

### Backend (Supabase Edge Functions)
```
✅ ./functions/api/v1/              ← All Edge Functions
```

### Configuration
```
✅ ./.env.production                ← Environment variables
✅ ./vite.config.js                 ← Build configuration
✅ ./package.json                   ← Dependencies
```

---

## 4. الإجراءات المطلوبة

1. ✅ إنشاء مجلد `archive/deprecated_2025-10-30/`
2. ⏳ نقل الملفات غير المستخدمة إلى archive
3. ⏳ تحديث imports في الكود
4. ⏳ اختبار التطبيق بعد التنظيف
5. ⏳ Commit & Push

