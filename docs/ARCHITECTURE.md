# 🏗️ معمارية النظام

<div dir="rtl">

## نظرة عامة

نظام MMC-MMS مبني على معمارية حديثة تعتمد على:
- **Frontend:** Vite + React (SPA)
- **Backend:** مستودع مستقل `love-api` (Supabase Edge Functions + API Router)
- **Database:** Supabase (PostgreSQL)
- **Infrastructure:** Vercel Edge Network

---

## 📐 المعمارية العامة

> **نموذج المستودعات:** هذا المستودع (`love`) خاص بالواجهة الأمامية فقط، بينما الـ Backend موجود في مستودع منفصل (`love-api`).

```
┌─────────────────────────────────────────────────────────────┐
│                         المستخدم                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                      │
│                    (CDN + Load Balancer)                    │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│   Frontend (Vite+React)│      │  API (Serverless Functions)│
│   - Static Assets      │      │  - /api/v1/*               │
│   - Client-side Logic  │      │  - Authentication          │
│   - UI Components      │      │  - Business Logic          │
└────────────┬───────────┘      └────────────┬───────────────┘
             │                                │
             │                                │
             └────────────┬───────────────────┘
                          │
                          ▼
             ┌────────────────────────────┐
             │   Supabase (PostgreSQL)    │
             │   - Database               │
             │   - Authentication         │
             │   - Row Level Security     │
             │   - Edge Functions         │
             └────────────────────────────┘
```

---

## 🎨 Frontend Architecture

### التقنيات المستخدمة

```javascript
{
  "framework": "Vite 5.x",
  "library": "React 18.x",
  "routing": "React Router v6",
  "state": "React Hooks + Context",
  "styling": "CSS Modules + Tailwind CSS",
  "http": "Fetch API + Supabase Client"
}
```

### هيكل المكونات

```
frontend/src/
├── App.jsx                    # المكون الرئيسي
├── main.jsx                   # نقطة الدخول
│
├── components/                # المكونات القابلة لإعادة الاستخدام
│   ├── AdminPage.jsx         # صفحة الإدارة
│   ├── LoginPage.jsx         # صفحة تسجيل الدخول
│   ├── QueueMonitor.jsx      # مراقبة الطابور
│   ├── PatientCard.jsx       # بطاقة المريض
│   ├── Button.jsx            # زر مخصص
│   ├── Input.jsx             # حقل إدخال مخصص
│   └── ...
│
├── hooks/                     # React Hooks مخصصة
│   ├── useAuth.js            # المصادقة
│   ├── useQueue.js           # إدارة الطابور
│   ├── usePatients.js        # إدارة المرضى
│   └── useNotifications.js   # الإشعارات
│
├── utils/                     # وظائف مساعدة
│   ├── api.js                # API client
│   ├── validators.js         # التحقق من البيانات
│   ├── formatters.js         # تنسيق البيانات
│   └── constants.js          # الثوابت
│
├── api/                       # API clients
│   ├── supabase.js           # Supabase client
│   ├── patients.js           # Patients API
│   ├── clinics.js            # Clinics API
│   └── queue.js              # Queue API
│
└── assets/                    # الأصول الثابتة
    ├── img/                  # الصور
    ├── js/                   # JavaScript libraries
    └── styles/               # ملفات CSS
```

### تدفق البيانات (Data Flow)

```
User Action
    ↓
Component Event Handler
    ↓
Custom Hook (useQueue, usePatients, etc.)
    ↓
API Client (api/supabase.js)
    ↓
Supabase REST API / Edge Functions
    ↓
PostgreSQL Database
    ↓
Response back through the chain
    ↓
Component Re-render
```

### إدارة الحالة (State Management)

```javascript
// Global State (Context API)
AuthContext          // حالة المصادقة
QueueContext         // حالة الطابور
NotificationContext  // حالة الإشعارات

// Local State (useState)
Component-specific state

// Server State (Supabase Realtime)
Real-time subscriptions for live updates
```

---

## ⚙️ Backend Architecture

### Repository Model

- **Frontend repo (this repo):** `love`
- **Backend repo:** `love-api`
- **Runtime backend platform:** Supabase Edge Functions + Postgres

### Backend Structure (in `love-api`)

```
supabase/functions/
├── api-router/               # Unified API router
├── api-v1-status/            # Health + status endpoints
└── ...                       # Domain endpoints (queue, patients, clinics, ...)
```

### Contract Between Repos

- Frontend in `love` consumes `/api/v1/*` endpoints exposed by `love-api`.
- API behavior/versioning is owned by backend releases in `love-api`.
- `love` must not assume local `api/` workspace exists.

### API Versioning

```
/api/v1/*     # الإصدار الحالي (مستقر)
/api/v2/*     # الإصدار التالي (قيد التطوير)
/api/beta/*   # ميزات تجريبية
```

---

## 🗄️ Database Architecture

### Schema Overview

```sql
-- Core Tables
patients                 -- بيانات المرضى
clinics                  -- العيادات
queue                    -- طابور الانتظار
routes                   -- المسارات الطبية
route_steps              -- خطوات المسار

-- Management Tables
admins                   -- المسؤولون
app_settings             -- إعدادات التطبيق
organization             -- بيانات المنظمة

-- Queue Management
queue_admin_view         -- عرض إداري للطابور
queue_audit              -- تدقيق الطابور
queue_pending            -- الطابور المعلق
queue_resettle           -- إعادة ترتيب

-- Clinic Management
clinic_counters          -- عدادات العيادات
clinic_pins              -- أرقام PIN
clinic_queue_reservations -- الحجوزات

-- Logging & Auditing
audit_logs               -- سجلات التدقيق
error_log                -- سجل الأخطاء
cache_logs               -- سجلات الذاكرة المؤقتة
events                   -- الأحداث

-- Reporting
reports                  -- التقارير
chart_data               -- بيانات الرسوم البيانية
daily_barcode_usage      -- استخدام الباركود اليومي

-- System
sessions                 -- الجلسات
ip_sessions              -- جلسات IP
pins                     -- أرقام PIN
notifications            -- الإشعارات
rate_limits              -- حدود المعدل
call_engine_state        -- حالة محرك الاستدعاء
scheduler_jobs           -- مهام الجدولة
```

### Row Level Security (RLS)

```sql
-- Example: patients table
CREATE POLICY "Authenticated users can read patients"
ON patients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert patients"
ON patients FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update patients"
ON patients FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete patients"
ON patients FOR DELETE
TO authenticated
USING (true);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_patients_military_id ON patients(military_id);
CREATE INDEX idx_queue_clinic_id ON queue(clinic_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_created_at ON queue(created_at);
```

### Triggers

```sql
-- Auto-update timestamps
CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Audit logging
CREATE TRIGGER log_queue_changes
AFTER INSERT OR UPDATE OR DELETE ON queue
FOR EACH ROW
EXECUTE FUNCTION log_audit_trail();
```

---

## 🔐 Security Architecture

### Authentication Flow

```
1. User enters credentials
   ↓
2. Frontend sends to Supabase Auth
   ↓
3. Supabase validates and returns JWT
   ↓
4. Frontend stores JWT in localStorage
   ↓
5. All API requests include JWT in Authorization header
   ↓
6. Backend validates JWT with Supabase
   ↓
7. RLS policies enforce data access
```

### Authorization Levels

```javascript
{
  "roles": {
    "super_admin": {
      "permissions": ["*"],
      "description": "وصول كامل"
    },
    "admin": {
      "permissions": [
        "manage_clinics",
        "manage_queue",
        "view_reports"
      ],
      "description": "إدارة العيادات والطوابير"
    },
    "clinic_staff": {
      "permissions": [
        "view_queue",
        "update_queue",
        "call_patient"
      ],
      "description": "موظفو العيادات"
    },
    "viewer": {
      "permissions": [
        "view_queue",
        "view_reports"
      ],
      "description": "عرض فقط"
    }
  }
}
```

### Data Encryption

- ✅ **في النقل:** HTTPS/TLS 1.3
- ✅ **في التخزين:** PostgreSQL encryption at rest
- ✅ **الحقول الحساسة:** AES-256 encryption
- ✅ **كلمات المرور:** bcrypt hashing

---

## 🚀 Deployment Architecture

### Vercel Deployment

```yaml
# vercel.json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "regions": ["iad1"],  # US East
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

### Environment Variables

```bash
# Production
SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
SUPABASE_ANON_KEY=***
SUPABASE_SERVICE_ROLE_KEY=***
VITE_SUPABASE_URL=***
VITE_SUPABASE_ANON_KEY=***
API_ORIGIN=https://love-bomussa.vercel.app

# Development
SUPABASE_URL=http://localhost:54321
VITE_API_BASE_URL=http://localhost:3000
```

### CI/CD Pipeline

```
Git Push
   ↓
GitHub Webhook
   ↓
Vercel Build
   ├── Install dependencies
   ├── Run tests
   ├── Build frontend
   ├── Deploy functions
   └── Deploy static assets
   ↓
Vercel Edge Network
   ↓
Production / Preview
```

---

## 📊 Performance Optimizations

### Frontend

- ✅ **Code Splitting:** Dynamic imports
- ✅ **Lazy Loading:** React.lazy()
- ✅ **Memoization:** React.memo(), useMemo()
- ✅ **Asset Optimization:** Image compression, WebP
- ✅ **Caching:** Service Worker, localStorage

### Backend

- ✅ **Connection Pooling:** Supabase Pooler
- ✅ **Query Optimization:** Indexes, prepared statements
- ✅ **Caching:** Redis-like caching with Supabase
- ✅ **Rate Limiting:** API rate limits
- ✅ **Serverless:** Auto-scaling

### Database

- ✅ **Indexes:** Strategic indexing
- ✅ **Materialized Views:** Pre-computed queries
- ✅ **Partitioning:** Table partitioning for large tables
- ✅ **Vacuum:** Regular maintenance

---

## 🔄 Real-time Features

### Supabase Realtime

```javascript
// Subscribe to queue changes
const subscription = supabase
  .channel('queue-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'queue'
  }, (payload) => {
    console.log('Queue updated:', payload);
    updateUI(payload);
  })
  .subscribe();
```

### WebSocket Architecture

```
Client (Browser)
   ↓ WebSocket
Supabase Realtime Server
   ↓ PostgreSQL LISTEN/NOTIFY
PostgreSQL Database
```

---

## 📈 Scalability

### Horizontal Scaling

- ✅ **Frontend:** CDN + Static hosting (infinite scale)
- ✅ **API:** Serverless functions (auto-scale)
- ✅ **Database:** Supabase managed PostgreSQL (vertical scale)

### Vertical Scaling

- ✅ **Database:** Upgrade Supabase plan
- ✅ **Functions:** Increase memory/timeout
- ✅ **CDN:** Vercel Edge Network (global)

### Load Handling

```
Current: ~500 requests/minute
Capacity: ~10,000 requests/minute
Peak: ~50,000 requests/minute (with caching)
```

---

## 🛠️ Monitoring & Observability

### Metrics

- ✅ **Performance:** Vercel Analytics
- ✅ **Errors:** Error logging to Supabase
- ✅ **Usage:** API usage tracking
- ✅ **Database:** Supabase monitoring

### Logging

```javascript
// Activity logging
await logActivity({
  user_id: user.id,
  action: 'create_patient',
  resource: 'patients',
  resource_id: patient.id,
  metadata: { ... }
});

// Error logging
await logError({
  error: error.message,
  stack: error.stack,
  context: { ... }
});
```

---

## 🔮 Future Architecture

### Planned Improvements

1. **Microservices:** Split API into microservices
2. **GraphQL:** Add GraphQL layer
3. **Message Queue:** Add RabbitMQ/SQS for async tasks
4. **Caching Layer:** Add Redis for better performance
5. **Mobile Apps:** React Native apps
6. **AI/ML:** Predictive analytics

---

**آخر تحديث:** 08 نوفمبر 2025

</div>
