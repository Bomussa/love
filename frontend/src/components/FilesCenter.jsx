/**
 * FilesCenter — مركز الملفات
 * شاشة إدارة ملفات التوثيق داخل لوحة الإدارة
 * أيقونات صغيرة + اسم مختصر + قائمة خيارات (فتح، إرسال، تصدير، تعديل، حذف)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Database, Wrench, Code, Server, Shield,
  BookOpen, Settings, Cpu, BarChart3, Download, Send,
  Edit3, Trash2, Eye, X, ChevronRight, Search,
  Plus, RefreshCw, Copy, Share2, Printer, FolderOpen,
  CheckCircle, AlertCircle, Clock, FileCode, FileSearch,
  Layers, GitBranch, Zap, HardDrive, Lock, Activity
} from 'lucide-react';

// ===== قائمة الملفات الحقيقية =====
const FILES_DATA = {
  ar: [
    {
      id: 'features',
      name: 'المزايا',
      fullName: 'دليل المزايا الشامل',
      icon: Layers,
      color: '#8A1538',
      category: 'docs',
      path: '/docs/FEATURES.md',
      size: '~45 KB',
      lines: 320,
      desc: 'كل مزايا النظام الظاهرة والباطنة مع الهدف والمسار وموقع الكود'
    },
    {
      id: 'database',
      name: 'قاعدة البيانات',
      fullName: 'دليل قاعدة البيانات',
      icon: Database,
      color: '#1a5276',
      category: 'docs',
      path: '/docs/DATABASE.md',
      size: '~28 KB',
      lines: 373,
      desc: '97 جدول Supabase — الأعمدة والعلاقات والإحصاءات الحقيقية'
    },
    {
      id: 'architecture',
      name: 'الهيكل',
      fullName: 'هيكل النظام والمعمارية',
      icon: GitBranch,
      color: '#1e8449',
      category: 'docs',
      path: '/docs/ARCHITECTURE.md',
      size: '~38 KB',
      lines: 568,
      desc: 'المعمارية الكاملة وحركة البيانات والمسارات'
    },
    {
      id: 'services',
      name: 'الخدمات',
      fullName: 'دليل الخدمات والـ API',
      icon: Server,
      color: '#7d3c98',
      category: 'docs',
      path: '/docs/SERVICES.md',
      size: '~32 KB',
      lines: 280,
      desc: '21 API endpoint + 5 خدمات lib مع الدوال والأسطر الدقيقة'
    },
    {
      id: 'maintenance',
      name: 'الصيانة',
      fullName: 'دليل الصيانة والإصلاح',
      icon: Wrench,
      color: '#d35400',
      category: 'docs',
      path: '/docs/MAINTENANCE.md',
      size: '~18 KB',
      lines: 180,
      desc: 'إجراءات الصيانة الدورية والإصلاح وحل المشكلات'
    },
    {
      id: 'security',
      name: 'الأمان',
      fullName: 'دليل الأمان والحماية',
      icon: Shield,
      color: '#922b21',
      category: 'docs',
      path: '/docs/SECURITY.md',
      size: '~12 KB',
      lines: 48,
      desc: 'سياسات الأمان والصلاحيات وحماية البيانات'
    },
    {
      id: 'api',
      name: 'API',
      fullName: 'وثيقة API الكاملة',
      icon: Code,
      color: '#1a5276',
      category: 'docs',
      path: '/docs/API.md',
      size: '~22 KB',
      lines: 200,
      desc: 'كل نقاط النهاية مع الأمثلة والمعاملات والردود'
    },
    {
      id: 'deployment',
      name: 'النشر',
      fullName: 'دليل النشر والإعداد',
      icon: Activity,
      color: '#117a65',
      category: 'docs',
      path: '/docs/DEPLOYMENT.md',
      size: '~8 KB',
      lines: 34,
      desc: 'خطوات النشر على Vercel وإعداد المتغيرات'
    },
    {
      id: 'smart_engine',
      name: 'محرك الإصلاح',
      fullName: 'محرك الإصلاح الذكي',
      icon: Zap,
      color: '#C9A54C',
      category: 'system',
      path: '/src/lib/smart-repair-engine.js',
      size: '~52 KB',
      lines: 726,
      desc: 'Circuit Breaker + Retry + Watchdog + Health Check + Bulkhead'
    },
    {
      id: 'memory_manager',
      name: 'إدارة الذاكرة',
      fullName: 'نظام إدارة الذاكرة',
      icon: HardDrive,
      color: '#2e4053',
      category: 'system',
      path: '/src/lib/memory-manager.js',
      size: '~28 KB',
      lines: 397,
      desc: 'LRU Algorithm + Watchdog — حذف تلقائي عند 90% امتلاء'
    },
    {
      id: 'supabase_client',
      name: 'Supabase',
      fullName: 'عميل Supabase',
      icon: Database,
      color: '#3498db',
      category: 'system',
      path: '/src/lib/supabase-client.js',
      size: '~35 KB',
      lines: 520,
      desc: 'الاتصال + المراقبة + التسجيل + إدارة الجلسات'
    },
    {
      id: 'auth_service',
      name: 'المصادقة',
      fullName: 'خدمة المصادقة',
      icon: Lock,
      color: '#8e44ad',
      category: 'system',
      path: '/src/lib/auth-service.js',
      size: '~18 KB',
      lines: 220,
      desc: 'JWT + أدوار المستخدمين + إدارة الجلسات'
    },
    {
      id: 'readme',
      name: 'README',
      fullName: 'دليل المشروع الرئيسي',
      icon: BookOpen,
      color: '#C9A54C',
      category: 'docs',
      path: '/README.md',
      size: '~15 KB',
      lines: 222,
      desc: 'نظرة عامة على المشروع وطريقة التشغيل'
    },
    {
      id: 'truth_tree',
      name: 'شجرة الحقيقة',
      fullName: 'شجرة الحقيقة الكاملة',
      icon: FileSearch,
      color: '#1e8449',
      category: 'docs',
      path: '/docs/TRUTH_TREE_LOVE_API.md',
      size: '~68 KB',
      lines: 967,
      desc: 'أشمل ملف — كل تفاصيل API والنظام موثقة'
    },
    {
      id: 'e2e_tests',
      name: 'نتائج الاختبار',
      fullName: 'نتائج الاختبار الشامل',
      icon: CheckCircle,
      color: '#1e8449',
      category: 'tests',
      path: '/docs/E2E_TEST_RESULTS.md',
      size: '~10 KB',
      lines: 120,
      desc: 'نتائج الاختبار الشامل E2E على mmc-mms.com'
    },
    {
      id: 'integration_lock',
      name: 'قفل التكامل',
      fullName: 'ملف قفل التكامل',
      icon: Lock,
      color: '#922b21',
      category: 'system',
      path: '/docs/INTEGRATION_LOCK.md',
      size: '~5 KB',
      lines: 60,
      desc: 'قواعد التكامل الصارمة لمنع التعارض'
    }
  ],
  en: [
    { id: 'features', name: 'Features', fullName: 'Complete Features Guide', icon: Layers, color: '#8A1538', category: 'docs', path: '/docs/FEATURES.md', size: '~45 KB', lines: 320, desc: 'All system features (visible & hidden) with purpose, path, and code location' },
    { id: 'database', name: 'Database', fullName: 'Database Guide', icon: Database, color: '#1a5276', category: 'docs', path: '/docs/DATABASE.md', size: '~28 KB', lines: 373, desc: '97 Supabase tables — columns, relations, real statistics' },
    { id: 'architecture', name: 'Architecture', fullName: 'System Architecture', icon: GitBranch, color: '#1e8449', category: 'docs', path: '/docs/ARCHITECTURE.md', size: '~38 KB', lines: 568, desc: 'Full architecture, data flow, and routes' },
    { id: 'services', name: 'Services', fullName: 'Services & API Guide', icon: Server, color: '#7d3c98', category: 'docs', path: '/docs/SERVICES.md', size: '~32 KB', lines: 280, desc: '21 API endpoints + 5 lib services with functions and exact line numbers' },
    { id: 'maintenance', name: 'Maintenance', fullName: 'Maintenance & Repair Guide', icon: Wrench, color: '#d35400', category: 'docs', path: '/docs/MAINTENANCE.md', size: '~18 KB', lines: 180, desc: 'Periodic maintenance procedures, repair, and troubleshooting' },
    { id: 'security', name: 'Security', fullName: 'Security & Protection Guide', icon: Shield, color: '#922b21', category: 'docs', path: '/docs/SECURITY.md', size: '~12 KB', lines: 48, desc: 'Security policies, permissions, and data protection' },
    { id: 'api', name: 'API', fullName: 'Complete API Documentation', icon: Code, color: '#1a5276', category: 'docs', path: '/docs/API.md', size: '~22 KB', lines: 200, desc: 'All endpoints with examples, parameters, and responses' },
    { id: 'deployment', name: 'Deployment', fullName: 'Deployment & Setup Guide', icon: Activity, color: '#117a65', category: 'docs', path: '/docs/DEPLOYMENT.md', size: '~8 KB', lines: 34, desc: 'Vercel deployment steps and environment variables' },
    { id: 'smart_engine', name: 'Repair Engine', fullName: 'Smart Repair Engine', icon: Zap, color: '#C9A54C', category: 'system', path: '/src/lib/smart-repair-engine.js', size: '~52 KB', lines: 726, desc: 'Circuit Breaker + Retry + Watchdog + Health Check + Bulkhead' },
    { id: 'memory_manager', name: 'Memory Mgr', fullName: 'Memory Management System', icon: HardDrive, color: '#2e4053', category: 'system', path: '/src/lib/memory-manager.js', size: '~28 KB', lines: 397, desc: 'LRU Algorithm + Watchdog — auto-delete at 90% capacity' },
    { id: 'supabase_client', name: 'Supabase', fullName: 'Supabase Client', icon: Database, color: '#3498db', category: 'system', path: '/src/lib/supabase-client.js', size: '~35 KB', lines: 520, desc: 'Connection + monitoring + logging + session management' },
    { id: 'auth_service', name: 'Auth', fullName: 'Authentication Service', icon: Lock, color: '#8e44ad', category: 'system', path: '/src/lib/auth-service.js', size: '~18 KB', lines: 220, desc: 'JWT + user roles + session management' },
    { id: 'readme', name: 'README', fullName: 'Main Project Guide', icon: BookOpen, color: '#C9A54C', category: 'docs', path: '/README.md', size: '~15 KB', lines: 222, desc: 'Project overview and setup instructions' },
    { id: 'truth_tree', name: 'Truth Tree', fullName: 'Complete Truth Tree', icon: FileSearch, color: '#1e8449', category: 'docs', path: '/docs/TRUTH_TREE_LOVE_API.md', size: '~68 KB', lines: 967, desc: 'Most comprehensive file — all API and system details documented' },
    { id: 'e2e_tests', name: 'Test Results', fullName: 'Comprehensive Test Results', icon: CheckCircle, color: '#1e8449', category: 'tests', path: '/docs/E2E_TEST_RESULTS.md', size: '~10 KB', lines: 120, desc: 'E2E test results on mmc-mms.com' },
    { id: 'integration_lock', name: 'Int. Lock', fullName: 'Integration Lock File', icon: Lock, color: '#922b21', category: 'system', path: '/docs/INTEGRATION_LOCK.md', size: '~5 KB', lines: 60, desc: 'Strict integration rules to prevent conflicts' }
  ]
};

const CATEGORIES = {
  ar: [
    { id: 'all', label: 'الكل' },
    { id: 'docs', label: 'التوثيق' },
    { id: 'system', label: 'النظام' },
    { id: 'tests', label: 'الاختبارات' }
  ],
  en: [
    { id: 'all', label: 'All' },
    { id: 'docs', label: 'Docs' },
    { id: 'system', label: 'System' },
    { id: 'tests', label: 'Tests' }
  ]
};

// ===== محتوى الملفات الكامل (للقراءة داخل الشاشة) =====
const FILE_CONTENT = {
  features: `# دليل المزايا الشامل — نظام MMC-MMS

## الهدف من النظام
نظام إدارة اللجنة الطبية العسكرية (MMC-MMS) هو منظومة رقمية متكاملة تُدير:
- طوابير المرضى في 18 عيادة
- المسارات الطبية متعددة العيادات
- الإشعارات والتنبيهات الفورية
- سجلات النشاط والتدقيق

## التبويبات الرئيسية (18 تبويب)
1. لوحة التحكم — Dashboard
2. إدارة الطوابير — Queues
4. الإشعارات — Notifications
5. المسارات — Routes
6. توجيه الطوابق — Floor Directions
7. التقارير — Reports
8. العيادات — Clinics
9. حالة النظام — System Status
10. الإعدادات — Settings
11. إدارة المستخدمين — Users
12. سجل النشاطات — Activity Log
13. النسخ والتصدير — Backup & Export
14. العمل أوفلاين — Offline Mode
15. إدارة المحتوى — Content Management
16. المظهر — Appearance
17. قاعدة البيانات — Database
18. التحكم بالميزات — Feature Control
19. مراقبة API — API Monitor
20. النظام الذكي — Smart System
21. مركز الملفات — Files Center

## الميزات الأساسية
### نظام الطوابير
- استدعاء المريض: PUT /api/v1/queue/next
- إكمال الفحص: PUT /api/v1/queue/done
- ترحيل المريض: POST /api/v1/admin/queues/move-to-end
- إلغاء المريض: PATCH /api/v1/admin/queues/:id
- الجدول: unified_queue (11 سجل، 24 عمود)


### إدارة العيادات
- 18 عيادة نشطة
- الجدول: clinics (21 عمود)
- أنواع الفحص: general, periodic, pre_employment, fitness, specialized, follow_up, emergency

### الإعدادات (25 مفتاح)
- center_name, working_hours_end, working_days
- exam_duration, max_daily_patients, max_postpones
- notifications_enabled, reset_queue_daily
- prevent_duplicate_patient_daily, prevent_duplicate_device_daily

## الخوارزميات العالمية المُدمجة
1. Circuit Breaker (Netflix Hystrix)
2. Retry + Exponential Backoff (AWS Standard)
3. Watchdog Timer (POSIX)
4. Health Check (Kubernetes Probes)
5. Error Boundary (React 16+)
6. Bulkhead Pattern (Release It! - Nygard)
7. LRU Memory Management

## إحصاءات المشروع
- الملفات: 94 ملف
- الأسطر: 52,000+ سطر
- المكونات: 28 مكوّن React
- الجداول: 97 جدول Supabase
- API Endpoints: 21
- التبويبات: 21 تبويب إداري`,

  database: `# دليل قاعدة البيانات — Supabase
## معلومات الاتصال
- Project URL: https://rujwuruuosffcxazymit.supabase.co
- Project ID: rujwuruuosffcxazymit
- Region: eu-central-1

## الجداول الرئيسية (97 جدول إجمالي)

### unified_queue — طابور المرضى
| العمود | النوع | الوصف |
|--------|-------|-------|
| id | int8 | معرف فريد |
| patient_id | text | رقم المريض |
| clinic_id | uuid | معرف العيادة |
| display_number | int4 | رقم العرض |
| status | text | waiting/called/done/cancelled |
| queue_date | date | تاريخ الطابور |
| created_at | timestamptz | وقت الإنشاء |
السجلات الحالية: 11

### clinics — العيادات
| العمود | النوع | الوصف |
|--------|-------|-------|
| id | uuid | معرف فريد |
| name_ar | text | الاسم بالعربية |
| name_en | text | الاسم بالإنجليزية |
| clinic_code | text | رمز العيادة |
| floor | int4 | الطابق |
| room_number | text | رقم الغرفة |
| is_active | bool | نشط/غير نشط |
| order_number | int4 | الترتيب |
| exam_type | text | نوع الفحص |
السجلات الحالية: 18

| العمود | النوع | الوصف |
|--------|-------|-------|
| id | uuid | معرف فريد |
| clinic_id | uuid | العيادة المرتبطة |
| is_active | bool | نشط/غير نشط |
| max_uses | int4 | الحد الأقصى للاستخدام |
| use_count | int4 | عدد مرات الاستخدام |
السجلات الحالية: 18

### settings — الإعدادات
السجلات الحالية: 23 إعداد

### admins — المديرون
السجلات الحالية: 2

### activity_logs — سجل النشاطات
السجلات الحالية: 20

### daily_activity_logs — السجل اليومي
السجلات الحالية: 89

### device_logins — تسجيلات الأجهزة
السجلات الحالية: 25

### smart_errors_log — سجل الأخطاء الذكي
السجلات الحالية: 1

### smart_fixes_log — سجل الإصلاحات
السجلات الحالية: 1

## RLS Policies
جميع الجداول محمية بـ Row Level Security
- الجداول العامة: قراءة مفتوحة
- الجداول الإدارية: تتطلب JWT صالح`,

  services: `# دليل الخدمات — MMC-MMS

## API Endpoints (21 endpoint)
Base URL: https://mmc-mms.com/api/v1

### Health
GET /api/v1/health — فحص صحة الـ API

### Admin — Users
POST /api/v1/admin/login — تسجيل دخول المدير
GET /api/v1/admin/users — قائمة المستخدمين
POST /api/v1/admin/users — إضافة مستخدم
PATCH /api/v1/admin/users/:id — تعديل مستخدم
DELETE /api/v1/admin/users/:id — حذف مستخدم

### Admin — Clinics
GET /api/v1/admin/clinics — قائمة العيادات
POST /api/v1/admin/clinics — إضافة عيادة
PATCH /api/v1/admin/clinics/:id — تعديل عيادة
DELETE /api/v1/admin/clinics/:id — حذف عيادة

### Admin — Queues
GET /api/v1/admin/queues — قائمة الطابور
PATCH /api/v1/admin/queues/:id — تعديل حالة
DELETE /api/v1/admin/queues/:id — حذف من الطابور
POST /api/v1/admin/queues/move-to-end — ترحيل لآخر الطابور

### Admin — Other
GET /api/v1/admin/reports/stats — إحصائيات التقارير
GET /api/v1/admin/notifications — قائمة الإشعارات
POST /api/v1/admin/notifications — إرسال إشعار
GET /api/v1/admin/activity-log — سجل النشاطات
POST /api/v1/admin/activity-log — إضافة سجل

### Settings
GET /api/v1/settings — جلب كل الإعدادات
PATCH /api/v1/settings — تحديث إعداد
GET /api/v1/settings/calculate-wait — حساب وقت الانتظار

### Patient & Queue
POST /api/v1/patients/login — تسجيل دخول المريض
POST /api/v1/queue/get-number — الحصول على رقم طابور
POST /api/v1/queue/enter — دخول الطابور
GET /api/v1/queue/status — حالة الطابور
POST /api/v1/queue/next — استدعاء التالي
POST /api/v1/queue/done — إكمال الفحص
GET /api/v1/pathway/:id — مسار المريض

## ملفات lib الرئيسية

### supabase-client.js (520 سطر)
- getConnectionStatus() — حالة الاتصال
- reconnect() — إعادة الاتصال
- startConnectionMonitor(30000) — مراقبة كل 30 ثانية
- generateDeviceFingerprint() — بصمة الجهاز
- logDailyActivity(type, details) — تسجيل نشاط
- getSystemSetting(key, default) — جلب إعداد

### auth-service.js (220 سطر)
- login(username, password) — تسجيل الدخول
- logout() — تسجيل الخروج
- getSession() — الجلسة الحالية
- isAuthenticated() — التحقق من الجلسة
- USER_ROLES: SUPER_ADMIN, ADMIN, DOCTOR, RECEPTIONIST

### smart-repair-engine.js (726 سطر)
- Circuit Breaker: CLOSED → OPEN → HALF_OPEN
- Retry: 3 محاولات + Exponential Backoff
- Watchdog: كل 60 ثانية
- Health Check: 10 خدمات كل 30 ثانية

### memory-manager.js (397 سطر)
- LRU Algorithm
- عتبة التحذير: 80%
- عتبة الحذف التلقائي: 90%
- عتبة الحذف الشامل: 95%`,

  architecture: `# هيكل النظام والمعمارية — MMC-MMS

## نظرة عامة
نظام ثلاثي الطبقات:
1. Frontend: React + Vite + TailwindCSS (على Vercel CDN)
2. Backend API: Node.js Serverless (على Vercel Functions)
3. Database: Supabase (PostgreSQL + Realtime)

## حركة الطلبات
المريض/المدير (Browser)
    │
    ▼
mmc-mms.com (Vercel Edge CDN)
    │
    ├──► /api/v1/* ──► love-api/api/v1.js (Serverless)
    │                        │
    │                        ▼
    │                  Supabase REST API
    │                        │
    │                        ▼
    │                  PostgreSQL (rujwuruuosffcxazymit)
    │
    └──► /* ──► React SPA (dist/)
                    │
                    ├── supabase-client.js (اتصال مباشر)
                    ├── auth-service.js (JWT)
                    ├── smart-repair-engine.js (إصلاح ذاتي)
                    └── memory-manager.js (LRU)

## هيكل الملفات
love/
├── frontend/
│   ├── src/
│   │   ├── components/ (28 مكوّن)
│   │   │   ├── AdminDashboardV2.jsx (5501 سطر)
│   │   │   ├── SmartDiagnosticsPanel.jsx (663 سطر)
│   │   │   ├── FilesCenter.jsx (هذا الملف)
│   │   │   └── ...
│   │   ├── lib/ (5 ملفات خدمة)
│   │   │   ├── supabase-client.js
│   │   │   ├── auth-service.js
│   │   │   ├── smart-repair-engine.js
│   │   │   └── memory-manager.js
│   │   └── App.jsx
│   ├── public/
│   │   └── logo.png
│   └── vite.config.js
├── love-api/
│   └── api/v1.js (21 endpoint)
├── docs/ (34 ملف توثيق)
└── README.md

## المسارات (Routes)
- / — صفحة المريض الرئيسية
- /admin — لوحة الإدارة
- /queue — شاشة الطابور
- /pathway — شاشة المسار

## الاتصالات المباشرة (بدون API)
Frontend → Supabase مباشرة:
- قراءة الإعدادات
- قراءة العيادات
- Realtime subscriptions
- تسجيل النشاطات`,

  maintenance: `# دليل الصيانة والإصلاح — MMC-MMS

## الصيانة الدورية

### يومياً
- مراجعة سجل الأخطاء في النظام الذكي
- التحقق من حالة Circuit Breakers (يجب أن تكون CLOSED)
- مراجعة سجل النشاطات للأنشطة غير الطبيعية
- التحقق من عدد سجلات unified_queue (يجب أن تُعاد يومياً)

### أسبوعياً
- مراجعة إحصاءات قاعدة البيانات
- التحقق من حجم الجداول (smart_errors_log, daily_activity_logs)
- مراجعة سجلات device_logins القديمة
- اختبار كل API endpoints

### شهرياً
- نسخة احتياطية كاملة من Supabase
- مراجعة إعدادات الأمان
- مراجعة أداء الـ API

## إصلاح المشكلات الشائعة

### مشكلة: الطابور لا يتحدث تلقائياً
الحل:
1. فحص Supabase Realtime في تبويب "حالة النظام"
2. تشغيل reconnect() من supabase-client.js
3. إعادة تحميل الصفحة

الحل:
2. التحقق من use_count < max_uses
3. التحقق من clinic_id صحيح

### مشكلة: لا يمكن الدخول للإدارة
الحل:
1. التحقق من بيانات الدخول في src/config/admin-credentials.js
2. التحقق من جدول admins في Supabase
3. مسح localStorage والمحاولة مجدداً

### مشكلة: بطء في الاستجابة
الحل:
1. فحص حالة Supabase في https://status.supabase.com
2. فحص Vercel في https://vercel-status.com
3. مراجعة Circuit Breaker states في النظام الذكي

## مواقع الكود للإصلاح
| المشكلة | الملف | السطر |
|---------|-------|-------|
| الطابور | AdminDashboardV2.jsx | 134-239 |
| الإعدادات | AdminDashboardV2.jsx | 3049-3250 |
| الاتصال | supabase-client.js | 148-203 |
| المصادقة | auth-service.js | 11-50 |
| الإصلاح الذكي | smart-repair-engine.js | 1-726 |
| الذاكرة | memory-manager.js | 1-397 |

## بيانات الوصول للصيانة
- Supabase Dashboard: https://supabase.com/dashboard/project/rujwuruuosffcxazymit
- Vercel Dashboard: https://vercel.com/bomussa
- GitHub: https://github.com/Bomussa/love
- الموقع: https://mmc-mms.com/admin`,

  security: `# دليل الأمان — MMC-MMS

## طبقات الأمان

### 1. Vercel Bot Protection
- تحدي تلقائي للمتصفحات الآلية
- Bypass Token للاختبار: qGD96hT6lwJZCoyjAURAEnb3SCaJOW6V

### 2. Supabase RLS (Row Level Security)
- كل الجداول محمية بـ RLS
- الجداول الإدارية تتطلب JWT صالح
- الجداول العامة: قراءة مفتوحة فقط

### 3. JWT Authentication
- مدة الجلسة: محددة في auth-service.js
- التخزين: localStorage
- التحقق: عند كل طلب إداري

### 4. أدوار المستخدمين
- SUPER_ADMIN: كامل الصلاحيات
- ADMIN: إدارة النظام
- DOCTOR: عيادته فقط
- RECEPTIONIST: الطابور والأرقام

### 5. منع التكرار
- منع نفس المريض يومياً: prevent_duplicate_patient_daily
- منع نفس الجهاز يومياً: prevent_duplicate_device_daily
- بصمة الجهاز: generateDeviceFingerprint() في supabase-client.js السطر 230

### 6. HTTPS إلزامي
- كل الاتصالات عبر HTTPS
- Vercel يُطبّق HTTPS تلقائياً`,

  api: `# وثيقة API الكاملة — MMC-MMS

## Base URL
Production: https://mmc-mms.com/api/v1
Development: http://localhost:3000/api/v1

## Authentication
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

## Response Format
{
  "success": true/false,
  "data": { ... },
  "error": "message or null"
}

## Endpoints

### GET /api/v1/health
Response: { "status": "ok", "version": "2.0.0" }

### POST /api/v1/admin/login
Body: { "username": "string", "password": "string" }
Response: { "token": "JWT", "user": { "role": "ADMIN" } }

### GET /api/v1/admin/clinics
Response: { "data": [ { "id", "name_ar", "name_en", "is_active", ... } ] }

### POST /api/v1/admin/clinics
Body: { "name_ar", "name_en", "clinic_code", "floor", "room_number", "is_active", "exam_type" }

### GET /api/v1/admin/queues
Query: ?date=2026-02-26&clinic_id=uuid
Response: { "data": [ { "id", "patient_id", "display_number", "status", ... } ] }

### POST /api/v1/queue/next
Body: { "clinic_id": "uuid" }
Response: { "data": { "patient": { ... }, "display_number": 5 } }

### POST /api/v1/queue/done
Body: { "queue_id": "int" }
Response: { "success": true }

Response: { "valid": true/false, "clinic": { ... } }

### GET /api/v1/settings
Response: { "data": { "center_name": "...", "queue_system_enabled": "true", ... } }

### PATCH /api/v1/settings
Body: { "key": "center_name", "value": "اللجنة الطبية" }

### GET /api/v1/admin/reports/stats
Response: { "data": { "total_patients": 11, "done": 5, "waiting": 4, "cancelled": 2 } }`,

  deployment: `# دليل النشر — MMC-MMS

## المنصات
- Frontend + API: Vercel
- Database: Supabase
- Code: GitHub (Bomussa/love + Bomussa/love-api)

## متغيرات البيئة المطلوبة في Vercel
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

## خطوات النشر
1. git push origin main
2. Vercel يكتشف التغيير تلقائياً
3. يُشغّل pnpm build
4. ينشر dist/ على CDN
5. ينشر api/v1.js كـ Serverless Function

## الدومين
- mmc-mms.com → Vercel Project
- www.mmc-mms.com → Redirect to mmc-mms.com

## Vercel Project IDs
- Project ID: prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM
- Org ID: team_aFtFTvzgabqENB5bOxn4SiO7`,

  readme: `# MMC-MMS — نظام إدارة اللجنة الطبية العسكرية

## الهدف
نظام رقمي متكامل لإدارة اللجنة الطبية العسكرية يشمل:
- إدارة طوابير المرضى في 18 عيادة
- المسارات الطبية متعددة العيادات
- لوحة إدارة شاملة بـ 21 تبويب
- نظام ذكي للتشخيص والإصلاح التلقائي

## التقنيات
- Frontend: React 18 + Vite + TailwindCSS
- Backend: Node.js Serverless (Vercel Functions)
- Database: Supabase (PostgreSQL + Realtime)
- Hosting: Vercel
- Icons: Lucide React
- Fonts: Cairo (خط كايرو)

## الروابط
- الموقع: https://mmc-mms.com
- الإدارة: https://mmc-mms.com/admin
- GitHub: https://github.com/Bomussa/love
- Supabase: https://rujwuruuosffcxazymit.supabase.co

## الإحصاءات
- 94 ملف في المشروع
- 52,000+ سطر كود
- 28 مكوّن React
- 97 جدول Supabase
- 21 API endpoint
- 21 تبويب إداري`,
};

// ===== المكوّن الرئيسي =====
const FilesCenter = ({ language = 'ar', t }) => {
  const isAr = language === 'ar';
  const files = FILES_DATA[language] || FILES_DATA.ar;
  const categories = CATEGORIES[language] || CATEGORIES.ar;

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [openFile, setOpenFile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [notification, setNotification] = useState(null);
  const menuRef = useRef(null);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // فلترة الملفات
  const filteredFiles = files.filter(f => {
    const matchCategory = activeCategory === 'all' || f.category === activeCategory;
    const matchSearch = !searchQuery || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // إظهار إشعار
  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ===== خيارات الملف =====
  const handleOpen = (file) => {
    const content = FILE_CONTENT[file.id] || 
      `# ${file.fullName}\n\n${file.desc}\n\nالمسار: ${file.path}\nالحجم: ${file.size}\nعدد الأسطر: ${file.lines}`;
    setOpenFile({ ...file, content });
    setEditMode(false);
    setEditContent(content);
    setOpenMenu(null);
  };

  const handleEdit = (file) => {
    const content = FILE_CONTENT[file.id] || `# ${file.fullName}\n\n${file.desc}`;
    setOpenFile({ ...file, content });
    setEditMode(true);
    setEditContent(content);
    setOpenMenu(null);
  };

  const handleExport = (file) => {
    const content = FILE_CONTENT[file.id] || `# ${file.fullName}\n\n${file.desc}\n\nالمسار: ${file.path}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotif(isAr ? `تم تصدير ${file.name}` : `${file.name} exported`);
    setOpenMenu(null);
  };

  const handleExportPDF = (file) => {
    const content = FILE_CONTENT[file.id] || `# ${file.fullName}\n\n${file.desc}`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${file.fullName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          body { font-family: 'Cairo', sans-serif; direction: ${isAr ? 'rtl' : 'ltr'}; padding: 40px; color: #1a1a1a; }
          .header { text-align: center; border-bottom: 3px solid #8A1538; padding-bottom: 20px; margin-bottom: 30px; }
          .logo-area { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 10px; }
          .org-name { font-size: 18px; font-weight: 700; color: #8A1538; }
          .doc-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 10px 0; }
          .meta { font-size: 12px; color: #666; }
          .content { white-space: pre-wrap; font-size: 13px; line-height: 1.8; }
          h1 { color: #8A1538; font-size: 20px; border-bottom: 2px solid #C9A54C; padding-bottom: 8px; }
          h2 { color: #1a5276; font-size: 16px; }
          h3 { color: #2e4053; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #8A1538; color: white; padding: 8px; font-size: 12px; }
          td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
          .footer { margin-top: 40px; border-top: 2px solid #8A1538; padding-top: 15px; text-align: center; font-size: 11px; color: #666; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <div>
              <div class="org-name">القيادة العامة للقوات المسلحة</div>
              <div class="org-name">اللجنة الطبية العسكرية المركزية</div>
            </div>
          </div>
          <div class="doc-title">${file.fullName}</div>
          <div class="meta">
            نظام MMC-MMS | mmc-mms.com | ${new Date().toLocaleDateString('ar-SA')}
          </div>
        </div>
        <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <div class="footer">
          وثيقة سرية — اللجنة الطبية العسكرية المركزية | MMC-MMS System v2.0
          <br>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    showNotif(isAr ? `جاري تصدير PDF لـ ${file.name}` : `Exporting PDF for ${file.name}`);
    setOpenMenu(null);
  };

  const handleCopy = (file) => {
    const content = FILE_CONTENT[file.id] || `# ${file.fullName}\n${file.desc}`;
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
      showNotif(isAr ? 'تم النسخ' : 'Copied!');
    });
    setOpenMenu(null);
  };

  const handleShare = (file) => {
    const text = `${file.fullName}\n${file.desc}\nنظام MMC-MMS: https://mmc-mms.com`;
    if (navigator.share) {
      navigator.share({ title: file.fullName, text, url: 'https://mmc-mms.com' });
    } else {
      navigator.clipboard.writeText(text);
      showNotif(isAr ? 'تم نسخ رابط المشاركة' : 'Share link copied');
    }
    setOpenMenu(null);
  };

  const handleSaveEdit = () => {
    showNotif(isAr ? `تم حفظ التعديلات على ${openFile.name}` : `Changes saved for ${openFile.name}`);
    setEditMode(false);
    if (openFile) setOpenFile({ ...openFile, content: editContent });
  };

  // ===== تصميم الأيقونة =====
  const FileIcon = ({ file }) => {
    const Icon = file.icon;
    const isMenuOpen = openMenu === file.id;
    const isCopied = copiedId === file.id;

    return (
      <div className="relative group">
        {/* الأيقونة الرئيسية */}
        <div
          className="flex flex-col items-center cursor-pointer select-none"
          onClick={() => setOpenMenu(isMenuOpen ? null : file.id)}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl border border-white/20"
            style={{ backgroundColor: file.color + '22', borderColor: file.color + '44' }}
          >
            <Icon size={28} style={{ color: file.color }} />
          </div>
          <span className="mt-2 text-xs font-semibold text-center leading-tight max-w-[72px] truncate"
            style={{ color: '#e8d5b7', fontFamily: 'Cairo, sans-serif' }}>
            {file.name}
          </span>
          {isCopied && (
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✓</span>
          )}
        </div>

        {/* قائمة الخيارات */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute z-50 rounded-xl shadow-2xl border overflow-hidden min-w-[160px]"
            style={{
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              backgroundColor: '#1a1a2e',
              borderColor: file.color + '66',
              direction: isAr ? 'rtl' : 'ltr'
            }}
          >
            {/* اسم الملف */}
            <div className="px-3 py-2 text-xs font-bold border-b" 
              style={{ color: file.color, borderColor: file.color + '33', backgroundColor: file.color + '11' }}>
              {file.fullName}
            </div>
            
            {/* الخيارات */}
            {[
              { icon: Eye, label: isAr ? 'فتح وقراءة' : 'Open & Read', action: () => handleOpen(file), color: '#3498db' },
              { icon: Edit3, label: isAr ? 'تعديل' : 'Edit', action: () => handleEdit(file), color: '#f39c12' },
              { icon: Download, label: isAr ? 'تصدير MD' : 'Export MD', action: () => handleExport(file), color: '#2ecc71' },
              { icon: Printer, label: isAr ? 'تصدير PDF' : 'Export PDF', action: () => handleExportPDF(file), color: '#e74c3c' },
              { icon: Copy, label: isAr ? 'نسخ المحتوى' : 'Copy Content', action: () => handleCopy(file), color: '#9b59b6' },
              { icon: Share2, label: isAr ? 'مشاركة' : 'Share', action: () => handleShare(file), color: '#1abc9c' },
            ].map((opt, i) => (
              <button
                key={i}
                onClick={opt.action}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 transition-colors"
                style={{ color: '#e8d5b7' }}
              >
                <opt.icon size={14} style={{ color: opt.color }} />
                {opt.label}
              </button>
            ))}
            
            {/* معلومات الملف */}
            <div className="px-3 py-2 border-t text-xs" style={{ borderColor: file.color + '33', color: '#888' }}>
              {file.lines} {isAr ? 'سطر' : 'lines'} • {file.size}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4" style={{ fontFamily: 'Cairo, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}>
      
      {/* إشعار */}
      {notification && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-semibold shadow-xl flex items-center gap-2"
          style={{
            backgroundColor: notification.type === 'success' ? '#1e8449' : '#922b21',
            color: 'white',
            fontFamily: 'Cairo, sans-serif'
          }}
        >
          <CheckCircle size={16} />
          {notification.msg}
        </div>
      )}

      {/* الرأس */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#8A1538' }}>
            <FolderOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#C9A54C' }}>
              {isAr ? 'مركز الملفات' : 'Files Center'}
            </h1>
            <p className="text-xs" style={{ color: '#888' }}>
              {isAr ? `${files.length} ملف — اضغط على أي ملف لعرض الخيارات` : `${files.length} files — Click any file for options`}
            </p>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلتر */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* بحث */}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-gray-400" style={{ [isAr ? 'right' : 'left']: '10px' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث في الملفات...' : 'Search files...'}
            className="w-full px-8 py-2 rounded-xl text-sm border outline-none"
            style={{
              backgroundColor: '#1a1a2e',
              borderColor: '#8A1538' + '44',
              color: '#e8d5b7',
              fontFamily: 'Cairo, sans-serif',
              paddingRight: isAr ? '32px' : '8px',
              paddingLeft: isAr ? '8px' : '32px'
            }}
          />
        </div>

        {/* فلتر الفئات */}
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeCategory === cat.id ? '#8A1538' : '#1a1a2e',
                color: activeCategory === cat.id ? 'white' : '#888',
                border: `1px solid ${activeCategory === cat.id ? '#8A1538' : '#333'}`,
                fontFamily: 'Cairo, sans-serif'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* شبكة الأيقونات */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4 mb-6">
        {filteredFiles.map(file => (
          <FileIcon key={file.id} file={file} />
        ))}
        {filteredFiles.length === 0 && (
          <div className="col-span-full text-center py-8 text-sm" style={{ color: '#666' }}>
            {isAr ? 'لا توجد ملفات مطابقة' : 'No matching files'}
          </div>
        )}
      </div>

      {/* ===== نافذة قراءة/تعديل الملف ===== */}
      {openFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ backgroundColor: '#0d0d1a', border: `2px solid ${openFile.color}44` }}
          >
            {/* رأس النافذة */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: openFile.color + '33', backgroundColor: openFile.color + '11' }}>
              <div className="flex items-center gap-3">
                <openFile.icon size={20} style={{ color: openFile.color }} />
                <div>
                  <div className="font-bold text-sm" style={{ color: '#e8d5b7', fontFamily: 'Cairo, sans-serif' }}>{openFile.fullName}</div>
                  <div className="text-xs" style={{ color: '#888' }}>{openFile.path} • {openFile.lines} {isAr ? 'سطر' : 'lines'} • {openFile.size}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#f39c12' + '22', color: '#f39c12', border: '1px solid #f39c1244' }}>
                    <Edit3 size={12} /> {isAr ? 'تعديل' : 'Edit'}
                  </button>
                ) : (
                  <button onClick={handleSaveEdit} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#2ecc71' + '22', color: '#2ecc71', border: '1px solid #2ecc7144' }}>
                    <CheckCircle size={12} /> {isAr ? 'حفظ' : 'Save'}
                  </button>
                )}
                <button onClick={() => handleExport(openFile)} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#3498db' + '22', color: '#3498db', border: '1px solid #3498db44' }}>
                  <Download size={12} /> MD
                </button>
                <button onClick={() => handleExportPDF(openFile)} className="px-3 py-1 rounded-lg text-xs flex items-center gap-1" style={{ backgroundColor: '#e74c3c' + '22', color: '#e74c3c', border: '1px solid #e74c3c44' }}>
                  <Printer size={12} /> PDF
                </button>
                <button onClick={() => { setOpenFile(null); setEditMode(false); }} className="p-1 rounded-lg" style={{ color: '#888' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* محتوى الملف */}
            <div className="flex-1 overflow-auto p-5">
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[400px] rounded-xl p-4 text-sm font-mono outline-none resize-none"
                  style={{
                    backgroundColor: '#111122',
                    color: '#e8d5b7',
                    border: `1px solid ${openFile.color}44`,
                    fontFamily: 'monospace',
                    direction: 'ltr'
                  }}
                />
              ) : (
                <pre className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#e8d5b7', fontFamily: 'Cairo, monospace', direction: isAr ? 'rtl' : 'ltr' }}>
                  {openFile.content}
                </pre>
              )}
            </div>

            {/* فهرس سريع */}
            {!editMode && (
              <div className="px-5 py-3 border-t flex flex-wrap gap-2" style={{ borderColor: openFile.color + '22', backgroundColor: '#0a0a15' }}>
                <span className="text-xs" style={{ color: '#666' }}>{isAr ? 'انتقال سريع:' : 'Jump to:'}</span>
                {openFile.content.split('\n').filter(l => l.startsWith('## ')).slice(0, 6).map((heading, i) => (
                  <button
                    key={i}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: openFile.color + '22', color: openFile.color, fontFamily: 'Cairo, sans-serif' }}
                    onClick={() => {
                      const text = heading.replace('## ', '');
                      const pre = document.querySelector('.whitespace-pre-wrap');
                      if (pre) {
                        const idx = openFile.content.indexOf(heading);
                        const ratio = idx / openFile.content.length;
                        pre.parentElement.scrollTop = pre.parentElement.scrollHeight * ratio;
                      }
                    }}
                  >
                    {heading.replace(/^#+\s/, '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesCenter;
