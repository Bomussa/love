# دليل الخدمات — نظام MMC-MMS
# Services Guide — MMC-MMS System

> **المصدر:** مستخرج من `src/lib/` + `love-api/api/v1.js`  
> **تاريخ التوثيق:** 2026-02-26

---

## 📋 فهرس الخدمات / Services Index

| # | الخدمة | الملف | الوظيفة |
|---|--------|-------|---------|
| 1 | [Supabase Client](#1-supabase-client) | `src/lib/supabase-client.js` | الاتصال بقاعدة البيانات |
| 2 | [Auth Service](#2-auth-service) | `src/lib/auth-service.js` | المصادقة والصلاحيات |
| 3 | [Smart Repair Engine](#3-smart-repair-engine) | `src/lib/smart-repair-engine.js` | الإصلاح التلقائي |
| 4 | [Memory Manager](#4-memory-manager) | `src/lib/memory-manager.js` | إدارة الذاكرة |
| 5 | [API v1](#5-api-v1) | `love-api/api/v1.js` | نقاط نهاية الـ API |

---

## 1. Supabase Client
**الملف:** `src/lib/supabase-client.js`

### الدوال المُصدَّرة (مستخرجة من الكود):

| الدالة | السطر | الوظيفة |
|--------|-------|---------|
| `getConnectionStatus()` | 148 | إرجاع حالة الاتصال الحالية |
| `reconnect()` | 159 | إعادة الاتصال بـ Supabase |
| `startConnectionMonitor(intervalMs)` | 178 | بدء مراقبة الاتصال كل 30 ثانية |
| `stopConnectionMonitor()` | 192 | إيقاف مراقبة الاتصال |
| `initializeAllConnections()` | 203 | تهيئة كل الاتصالات عند بدء التطبيق |
| `generateDeviceFingerprint()` | 230 | توليد بصمة فريدة للجهاز |
| `checkDeviceLogin(patientId)` | 262 | التحقق من تسجيل الجهاز مسبقاً |
| `registerDeviceLogin(patientId)` | 299 | تسجيل دخول الجهاز |
| `logDailyActivity(actionType, details)` | 328 | تسجيل نشاط يومي |
| `logPermanentAudit(actionType, details)` | 356 | تسجيل دائم للتدقيق |
| `getDailyActivityLogs(filters)` | 386 | جلب سجلات النشاط اليومي |
| `getPermanentAuditLogs(filters)` | 417 | جلب سجلات التدقيق الدائمة |
| `getSystemSetting(key, defaultValue)` | 452 | جلب إعداد محدد من `settings` |
| `setSystemSetting(key, value, description)` | 487 | حفظ إعداد في `settings` |
| `getAllSystemSettings()` | 511 | جلب كل الإعدادات |

### إعدادات الاتصال:
```
URL: https://rujwuruuosffcxazymit.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ServiceTypes (أنواع الخدمات):
- `SUPABASE` — قاعدة البيانات الرئيسية
- `NETWORK` — الشبكة
- `STORAGE` — التخزين المحلي

---

## 2. Auth Service
**الملف:** `src/lib/auth-service.js`

### الأدوار المتاحة (من السطر 11):
```javascript
USER_ROLES = {
  SUPER_ADMIN: { id: 'SUPER_ADMIN' },  // كامل الصلاحيات
  ADMIN:       { id: 'ADMIN' },        // إدارة النظام
  DOCTOR:      { id: 'DOCTOR' },       // إدارة عيادته فقط
  RECEPTIONIST:{ id: 'RECEPTIONIST' }  // الطابور والأرقام
}
```

### الدوال الرئيسية:
| الدالة | الوظيفة |
|--------|---------|
| `login(username, password)` | تسجيل الدخول + إنشاء JWT |
| `logout()` | تسجيل الخروج + مسح الجلسة |
| `getSession()` | جلب الجلسة الحالية |
| `isAuthenticated()` | التحقق من وجود جلسة نشطة |
| `isDoctor()` | التحقق من دور الطبيب |
| `createSession(username, role)` | إنشاء جلسة جديدة |
| `validateAdminCredentials(u, p)` | التحقق من بيانات المدير |

### مصدر بيانات الدخول:
- `src/config/admin-credentials.js` — بيانات المدير الرئيسي
- جدول `admins` في Supabase — المديرون الإضافيون

---

## 3. Smart Repair Engine
**الملف:** `src/lib/smart-repair-engine.js` | **726 سطر**

### الخوارزميات المُدمجة:

#### Circuit Breaker (Netflix Hystrix / Martin Fowler)
```
الحالات: CLOSED → OPEN → HALF_OPEN
عتبة الفشل: 5 أخطاء متتالية
وقت الانتظار: 30 ثانية قبل HALF_OPEN
```

#### Retry + Exponential Backoff (AWS/Google Cloud)
```
عدد المحاولات: 3
التأخير: 1s → 2s → 4s + عشوائية (Jitter)
```

#### Watchdog Timer (POSIX Standard)
```
الفترة: 60 ثانية
الإجراء: إعادة تشغيل polling عند توقفه
```

#### Health Check (Kubernetes Probes)
```
الفترة: 30 ثانية
الخدمات المفحوصة: 10 خدمات
التصنيف: healthy / degraded / unhealthy
```

#### Error Boundary (React 16+)
```
يعزل أخطاء SmartDiagnosticsPanel
يمنع تعطل الصفحة كاملاً
```

#### Bulkhead Pattern (Release It! - Nygard)
```
كل خدمة في Circuit Breaker مستقل
فشل خدمة واحدة لا يؤثر على الأخريات
```

### الخدمات المراقبة (10 خدمات):
1. Supabase Database
2. API Server
3. Network Connectivity
4. Local Storage
5. Authentication Service
6. Queue System
7. PIN System
8. Clinics Data
9. Settings
10. Notifications

### جداول Supabase المستخدمة:
- `smart_errors_log` — تسجيل الأخطاء
- `smart_fixes_log` — تسجيل الإصلاحات

---

## 4. Memory Manager
**الملف:** `src/lib/memory-manager.js` | **397 سطر**

### خوارزمية LRU (Least Recently Used):
```
العتبات:
- 80%: تحذير مرئي في لوحة الإدارة
- 90%: حذف تلقائي للبيانات الأقدم استخداماً
- 95%: حذف شامل مع الإبقاء على البيانات الحيوية فقط
```

### البيانات الحيوية (محمية من الحذف):
- `settings` — الإعدادات
- `clinics` — العيادات
- `admins` — المديرون

### البيانات القابلة للحذف (بالأولوية):
1. `daily_activity_logs` — السجلات اليومية القديمة
2. `smart_errors_log` — سجلات الأخطاء القديمة
3. `smart_fixes_log` — سجلات الإصلاحات القديمة
4. `device_logins` — تسجيلات الأجهزة القديمة

### Watchdog Timer:
```
الفترة: 30 ثانية
الإجراء: فحص حجم الذاكرة وتنفيذ الحذف إذا لزم
```

### التحكم في الحذف:
- **حذف شامل:** `memoryManager.forceCleanup('all')`
- **حذف محدد:** `memoryManager.forceCleanup('table_name')`
- **تقرير الذاكرة:** `memoryManager.getMemoryReport()`

---

## 5. API v1
**الملف:** `love-api/api/v1.js`  
**Base URL Production:** `https://mmc-mms.com/api/v1`  
**Base URL Development:** `http://localhost:3000/api/v1`

### جميع الـ Endpoints (21 endpoint):

#### Health
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/v1/health` | فحص صحة الـ API |

#### Admin — Users
| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/api/v1/admin/login` | تسجيل دخول المدير |
| GET | `/api/v1/admin/users` | قائمة المستخدمين |
| POST | `/api/v1/admin/users` | إضافة مستخدم |
| PATCH | `/api/v1/admin/users/:id` | تعديل مستخدم |
| DELETE | `/api/v1/admin/users/:id` | حذف مستخدم |

#### Admin — Clinics
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/v1/admin/clinics` | قائمة العيادات |
| POST | `/api/v1/admin/clinics` | إضافة عيادة |
| PATCH | `/api/v1/admin/clinics/:id` | تعديل عيادة |
| DELETE | `/api/v1/admin/clinics/:id` | حذف عيادة |

#### Admin — Queues
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/v1/admin/queues` | قائمة الطابور |
| PATCH | `/api/v1/admin/queues/:id` | تعديل حالة طابور |
| DELETE | `/api/v1/admin/queues/:id` | حذف من الطابور |
| POST | `/api/v1/admin/queues/move-to-end` | ترحيل لآخر الطابور |

#### Admin — Other
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/v1/admin/pins` | قائمة الأرقام السرية |
| POST | `/api/v1/admin/pins/regenerate` | إعادة توليد PIN |
| GET | `/api/v1/admin/reports/stats` | إحصائيات التقارير |
| GET | `/api/v1/admin/notifications` | قائمة الإشعارات |
| POST | `/api/v1/admin/notifications` | إرسال إشعار |
| GET | `/api/v1/admin/activity-log` | سجل النشاطات |
| POST | `/api/v1/admin/activity-log` | إضافة سجل نشاط |

#### Settings
| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/v1/settings` | جلب كل الإعدادات |
| PATCH | `/api/v1/settings` | تحديث إعداد |
| GET | `/api/v1/settings/calculate-wait` | حساب وقت الانتظار |

#### Patient & Queue
| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/api/v1/pin/generate` | توليد رقم PIN |
| POST | `/api/v1/pin/validate` | التحقق من PIN |
| POST | `/api/v1/patients/login` | تسجيل دخول المريض |
| POST | `/api/v1/queue/get-number` | الحصول على رقم طابور |
| POST | `/api/v1/queue/enter` | دخول الطابور |
| GET | `/api/v1/queue/status` | حالة الطابور |
| POST | `/api/v1/queue/next` | استدعاء التالي |
| POST | `/api/v1/queue/done` | إكمال الفحص |
| GET | `/api/v1/pathway/:id` | مسار المريض |

### Authentication:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Response Format:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 🔗 حركة البيانات / Data Flow

```
المريض (Browser)
    │
    ▼
mmc-mms.com (Vercel Edge CDN)
    │
    ├──► /api/v1/* ──► love-api/api/v1.js (Serverless Function)
    │                        │
    │                        ▼
    │                  Supabase REST API
    │                        │
    │                        ▼
    │                  PostgreSQL Database
    │                  (rujwuruuosffcxazymit)
    │
    └──► /* ──► Frontend (Vite + React SPA)
                    │
                    ├── src/lib/supabase-client.js
                    │   └── Direct Supabase connection
                    │
                    ├── src/lib/auth-service.js
                    │   └── JWT session management
                    │
                    ├── src/lib/smart-repair-engine.js
                    │   └── Auto-repair + Circuit Breaker
                    │
                    └── src/lib/memory-manager.js
                        └── LRU memory management
```

---

*آخر تحديث: 2026-02-26 | المصدر: كود المشروع الحقيقي*
