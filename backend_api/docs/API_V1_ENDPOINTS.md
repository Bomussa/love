# API_V1_ENDPOINTS.md — عقد الربط الرسمي بين الفرونت و `love-api`
> المصدر الفعلي: `api/v1.js` | آخر تحديث: 2026-04-08

هذا الملف يوضح **كل ما يحتاجه الفرونت** حتى يكون الاتصال مستقرًا، قابلًا للتعافي عند الانقطاع، ومتوافقًا مع المسارات المنفذة فعليًا.

---

## 1) Base URL والنسخ

- Production API Base: `https://mmc-mms.com/api/v1`
- يجب أن يعمل نفس المحتوى على: `https://www.mmc-mms.com/api/v1`
- Health probe: `GET /health`
- Deep check: `GET /qa/deep_run`

> أي تغيير في base URL يجب أن يكون عبر متغير بيئة في الفرونت، وليس hardcoded داخل المكونات.

---

## 2) Endpoints المعتمدة فعليًا (api/v1.js)

| Route | Method | الغرض | الحقول المطلوبة |
|---|---|---|---|
| `/health` | GET | فحص الصحة | لا يوجد |
| `/qa/deep_run` | GET | فحص جاهزية سريع | لا يوجد |
| `/patient/login` | POST | دخول المراجع | `patientId` أو `personalId`، ويفضل `gender` |
| `/queue/create` | POST | إنشاء دور أولي | `patientId`/`sessionId`، ويفضل `examType` + `gender` |
| `/clinics` | GET | جلب العيادات | لا يوجد |
| `/queue/status` | GET | حالة الأدوار | اختياري: `clinicId`/`clinic_id` أو `patientId`/`patient_id` |
| `/queue/position` | GET | ترتيب المراجع | `clinic` + `user` |
| `/queue/call` | POST | استدعاء المراجع التالي | `clinicId` أو `clinic_id`، واختياري `doctorId` |
| `/queue/start` | POST | بدء الفحص | `queueId`، واختياري `doctorId` |
| `/queue/advance` | POST | تمرير المراجع للعيادة التالية | `queueId` |
| `/queue/done` | POST | إكمال الدور يدويًا | `clinicId` + (`patientId` أو `userId`) |
| `/queue/enter` | POST | مسار legacy | `clinic` + `user` |
| `/admin/login` | POST | دخول إداري/طبيب | `username` + `password` |
| `/admins` | GET | جلب حسابات admins | لا يوجد |
| `/admin/bootstrap-doctors` | POST | إنشاء مستخدم طبيب لكل العيادات | اختياري: `defaultPassword`, `role` |
| `/settings` | GET | جلب الإعدادات | لا يوجد |
| `/stats/dashboard` | GET | إحصائيات عامة | لا يوجد |
| `/stats/queues` | GET | آخر 100 دور | لا يوجد |
| `/route/create` | POST | إنشاء مسار فحص | `patientId` + `examType` + `gender` |
| `/route/get` | GET | جلب آخر مسار للمريض | `patientId` |

---

## 3) Contract مهم جدًا للفرونت (حتى لا ينقطع التدفق)

### 3.1 حالات الدور
في `queue/status` سيعود:
- `status` (القيمة الأصلية من DB: مثل `waiting`)
- `normalized_status` (قيمة موحدة للفرونت):
  - `WAITING`
  - `CALLED`
  - `IN_PROGRESS`
  - `DONE`

**التوصية:** الفرونت يعتمد `normalized_status` في الـ UI والمنطق، ويعرض `status` فقط لأغراض debug.

### 3.2 نهاية فحص التجنيد / الشاشة الرابعة
عند `POST /queue/advance`:
- إذا يوجد عيادة لاحقة: `finished: false` + `nextClinicId`
- إذا انتهى المسار: `finished: true` + `screen: 4`

**التوصية:** الانتقال للشاشة الرابعة في الفرونت يكون بشرط:
```ts
if (response.data?.finished === true && response.data?.screen === 4) {
  navigate('/exam-complete');
}
```

### 3.3 تسجيل دخول الإدارة/الطبيب
`/admin/login` يعمل على جدولين:
1. `admins` (legacy)
2. `admin_users` (fallback)

هذا يقلل انقطاعات الدخول عند اختلاف المخطط بين البيئات.

---

## 4) حماية الاتصال من الانقطاع (Frontend Resilience Policy)

### 4.1 Retry policy
- Health endpoints: `maxRetries=3`, `backoff=500ms -> 1000ms -> 2000ms`
- Mutations (`queue/call`, `queue/start`, `queue/advance`):
  - retry مرة واحدة فقط عند `5xx` أو network timeout
  - **لا تعيد** عند `4xx`

### 4.2 Timeout policy
- GET: `8s`
- POST: `12s`
- عند timeout: اعرض حالة "إعادة المحاولة" بدل فشل صامت.

### 4.3 Circuit breaker (في الفرونت)
- إذا 5 محاولات فاشلة متتالية خلال 60 ثانية:
  - stop hammering API لمدة 30 ثانية
  - الاستمرار فقط على `GET /health`
  - إشعار المستخدم بأن الخدمة متدهورة مؤقتًا

### 4.4 Idempotency الحركي
لعمليات حساسة (`queue/call` / `queue/advance`):
- أرسل `X-Request-Id` UUID فريد لكل عملية
- خزنه في state لمدة قصيرة لمنع إعادة الإرسال المكرر من UI

---

## 5) بيانات الربط المطلوبة من الفرونت (Checklist)

- `NEXT_PUBLIC_API_BASE_URL` أو ما يكافئه (يشير إلى `/api/v1`)
- مفتاح فصل البيئات (`production`/`staging`)
- timeout + retry config ثابتة
- معالج موحد للأخطاء يعرض:
  - `message`
  - `error_ar` إن وجد
  - كود HTTP
- fallback UI عند فقد الاتصال

---

## 6) قوالب Request/Response جاهزة للفرونت

### 6.1 إنشاء الدور
```json
POST /queue/create
{
  "patientId": "1234567890",
  "examType": "recruitment",
  "gender": "male"
}
```

### 6.2 استدعاء مراجع
```json
POST /queue/call
{
  "clinicId": "XR",
  "doctorId": "doctor_xr"
}
```

### 6.3 تمرير للدور التالي
```json
POST /queue/advance
{
  "queueId": "<queue-uuid>"
}
```

---

## 7) إنشاء مستخدمي الأطباء لكل العيادات

للتجهيز السريع:
```json
POST /admin/bootstrap-doctors
{
  "defaultPassword": "do123",
  "role": "doctor"
}
```

الناتج يتضمن:
- `createdCount`
- `existedCount`
- قائمة الحسابات المنشأة

---

## 8) ملاحظة تشغيلية

لا يجب تمرير أي secrets (service role key) إلى الفرونت. الفرونت يستهلك فقط endpoints العامة عبر `https://mmc-mms.com/api/v1`، بينما الأسرار تبقى في بيئة Vercel/Server فقط.
