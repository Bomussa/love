# Medical Committee Queue Management System - API Documentation

## نظام إدارة طوابير اللجنة الطبية - توثيق الـ API

### 📋 نظرة عامة

هذا هو Backend API الكامل لنظام إدارة طوابير اللجنة الطبية، تم تطويره للعمل على **Vercel Serverless Functions** مع دعم كامل لجميع المميزات.

---

## 🏗️ البنية المعمارية

```
api/
├── lib/                    # المكتبات الأساسية
│   ├── storage.js         # نظام التخزين (Vercel KV + Memory)
│   ├── helpers.js         # الوظائف المساعدة
│   ├── routing.js         # المسارات الديناميكية حسب الأوزان
│   └── reports.js         # نظام التقارير
└── v1/                    # API Version 1
    ├── status.js          # Health Check
    ├── patient/           # إدارة المرضى
    ├── queue/             # إدارة الطوابير
    ├── pin/               # إدارة PIN
    ├── route/             # إدارة المسارات
    ├── clinic/            # إدارة العيادات
    ├── admin/             # لوحة الإدارة
    ├── reports/           # التقارير
    ├── stats/             # الإحصائيات
    ├── events/            # الإشعارات اللحظية
    └── path/              # اختيار المسار
```

---

## 🔌 API Endpoints (21 Endpoint)

### 1. Health & Status

#### `GET /api/v1/status`
فحص صحة النظام

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "mode": "online",
  "backend": "up",
  "platform": "vercel",
  "timestamp": "2025-10-24T19:00:00.000Z"
}
```

---

### 2. Patient Management

#### `POST /api/v1/patient/login`
تسجيل دخول المريض

**Request:**
```json
{
  "patientId": "1234567890",
  "gender": "male"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-id",
    "patientId": "1234567890",
    "gender": "male",
    "loginTime": "2025-10-24T19:00:00.000Z",
    "status": "logged_in"
  }
}
```

---

### 3. Queue Management

#### `POST /api/v1/queue/enter`
الدخول إلى الطابور

**Request:**
```json
{
  "clinic": "lab",
  "user": "1234567890",
  "isAutoEntry": false
}
```

**Response:**
```json
{
  "success": true,
  "clinic": "lab",
  "user": "1234567890",
  "number": 1729848855365,
  "status": "WAITING",
  "ahead": 5,
  "position": 6
}
```

#### `GET /api/v1/queue/status?clinic=lab`
حالة الطابور

**Response:**
```json
{
  "success": true,
  "clinic": "lab",
  "list": [...],
  "current_serving": 1729848855365,
  "total_waiting": 5
}
```

#### `POST /api/v1/queue/done`
الخروج من الطابور

**Request:**
```json
{
  "clinic": "lab",
  "user": "1234567890"
}
```

#### `POST /api/v1/queue/call`
استدعاء المريض التالي

**Request:**
```json
{
  "clinic": "lab"
}
```

---

### 4. PIN Management

#### `GET /api/v1/pin/status`
حالة جميع PINs

**Response:**
```json
{
  "success": true,
  "pins": {
    "lab": "45",
    "xray": "67",
    ...
  },
  "date": "2025-10-24"
}
```

#### `POST /api/v1/pin/verify`
التحقق من PIN

**Request:**
```json
{
  "clinic": "lab",
  "pin": "45"
}
```

#### `POST /api/v1/pin/generate`
توليد PIN جديد

**Request:**
```json
{
  "clinic": "lab"
}
```

---

### 5. Route Management (المسارات الديناميكية)

#### `POST /api/v1/route/create`
إنشاء مسار محسّن للمريض

**Request:**
```json
{
  "patientId": "1234567890",
  "examType": "recruitment",
  "gender": "male"
}
```

**Response:**
```json
{
  "success": true,
  "route": {
    "examType": "recruitment",
    "gender": "male",
    "optimizedPath": ["vitals", "lab", "xray", ...],
    "stations": [
      {
        "id": "vitals",
        "name": "القياسات الحيوية",
        "nameEn": "Vital Signs",
        "floor": "2",
        "order": 1,
        "status": "ready"
      },
      ...
    ]
  }
}
```

#### `GET /api/v1/route/get?patientId=1234567890`
جلب مسار المريض

#### `POST /api/v1/clinic/exit`
الخروج من العيادة والانتقال للتالية

**Request:**
```json
{
  "patientId": "1234567890",
  "clinicId": "lab"
}
```

---

### 6. Reports (التقارير)

#### `GET /api/v1/reports/daily?date=2025-10-24`
تقرير يومي

**Response:**
```json
{
  "success": true,
  "report": {
    "date": "2025-10-24",
    "type": "daily",
    "clinics": {
      "lab": {
        "served": 45,
        "waiting": 5,
        "total": 50
      },
      ...
    },
    "summary": {
      "totalPatients": 250,
      "totalServed": 230,
      "totalWaiting": 20,
      "completionRate": 92
    }
  }
}
```

#### `GET /api/v1/reports/weekly?week=2025-10-20`
تقرير أسبوعي

#### `GET /api/v1/reports/monthly?year=2025&month=10`
تقرير شهري

#### `GET /api/v1/reports/annual?year=2025`
تقرير سنوي

---

### 7. Statistics (الإحصائيات)

#### `GET /api/v1/stats/dashboard`
إحصائيات لوحة التحكم

**Response:**
```json
{
  "success": true,
  "stats": {
    "clinics": {
      "lab": {
        "waiting": 5,
        "served": 45,
        "current": 1729848855365,
        "isActive": true
      },
      ...
    },
    "totals": {
      "waiting": 25,
      "served": 230,
      "active": 8
    }
  }
}
```

#### `GET /api/v1/stats/queues`
إحصائيات الطوابير مع الأوزان

**Response:**
```json
{
  "success": true,
  "stats": {
    "lab": {
      "baseWeight": 1.2,
      "queueLength": 5,
      "dynamicWeight": 1.8,
      "priority": 0.556
    },
    ...
  }
}
```

---

### 8. Real-time Events (الإشعارات اللحظية)

#### `GET /api/v1/events/stream?user=1234567890`
SSE للإشعارات اللحظية

**Stream Events:**
```
event: queue_update
data: {"type":"queue_update","position":3,"message":"أنت الثالث - استعد"}

event: queue_update
data: {"type":"queue_update","position":2,"message":"أنت الثاني - كن جاهزاً"}

event: queue_update
data: {"type":"queue_update","position":1,"message":"دورك الآن!","playSound":true}
```

---

### 9. Admin

#### `GET /api/v1/admin/status`
حالة شاملة لجميع العيادات

---

### 10. Path Management

#### `POST /api/v1/path/choose`
اختيار المسار (Legacy support)

---

## 🎯 المميزات الرئيسية

### 1. المسارات الديناميكية حسب الأوزان (Weighted Routing)

يقوم النظام بحساب الأوزان الديناميكية لكل عيادة بناءً على:
- عدد المنتظرين الحالي
- الوزن الأساسي للعيادة
- الأولوية الحالية

**الصيغة:**
```
dynamicWeight = baseWeight × (1 + queueLength × 0.1)
priority = 1 / dynamicWeight
```

### 2. نظام التخزين المتعدد (Multi-layer Storage)

- **Primary:** Vercel KV (إذا كان متاحاً)
- **Fallback:** Memory Store (للتطوير والاختبار)

### 3. Rate Limiting

- 100 طلب في الدقيقة لكل عميل
- تخزين مؤقت للحدود

### 4. Distributed Locks

- منع race conditions
- ضمان تكامل البيانات

### 5. نظام التقارير الشامل

- تقارير يومية، أسبوعية، شهرية، سنوية
- إحصائيات تفصيلية لكل عيادة
- معدلات الإنجاز والأداء

---

## 🔒 الأمان (Security)

### Headers

```javascript
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; ...
```

### CORS

```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## 📊 أنواع الفحوصات المدعومة

1. **recruitment** - تجنيد
2. **promotion** - ترفيع
3. **transfer** - نقل
4. **conversion** - تحويل
5. **courses** - دورات
6. **cooks** - طباخين
7. **aviation** - طيران
8. **renewal** - تجديد

---

## 🏥 العيادات المدعومة

| ID | الاسم | Floor | Weight |
|---|---|---|---|
| vitals | القياسات الحيوية | 2 | 1.0 |
| lab | المختبر | M | 1.2 |
| xray | الأشعة | M | 1.5 |
| ecg | تخطيط القلب | 2 | 1.0 |
| audio | قياس السمع | 2 | 1.0 |
| eyes | العيون | 2 | 1.3 |
| internal | الباطنية | 2 | 1.8 |
| ent | أنف وأذن وحنجرة | 2 | 1.4 |
| surgery | الجراحة العامة | 2 | 1.6 |
| dental | الأسنان | 2 | 1.3 |
| psychiatry | الطب النفسي | 2 | 1.5 |
| derma | الجلدية | 3 | 1.2 |
| bones | العظام | 2 | 1.4 |

---

## 🧪 الاختبار

```bash
# اختبار محلي
node test-api.js

# اختبار endpoint معين
curl https://your-domain.vercel.app/api/v1/status
```

---

## 🚀 النشر

### Vercel

```bash
# تلقائي من GitHub
git push origin main

# يدوي
vercel deploy
```

---

## 📝 ملاحظات

- جميع التواريخ بصيغة ISO 8601
- جميع الأوقات بتوقيت UTC
- جميع الأرقام بصيغة integer
- جميع الـ IDs بصيغة string

---

## 🔄 Versioning

- **Current Version:** v1
- **Base Path:** `/api/v1/`

---

## 📞 الدعم

للمزيد من المعلومات أو الإبلاغ عن مشاكل، يرجى فتح issue على GitHub.

---

**تم التطوير بواسطة:** Manus AI  
**التاريخ:** 25 أكتوبر 2025  
**الإصدار:** 1.0.0

