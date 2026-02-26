# نظام إدارة اللجنة الطبية العسكرية
# Military Medical Committee Management System (MMC-MMS)

<div align="center">

![MMC-MMS](https://img.shields.io/badge/MMC--MMS-v2.0-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-LIVE-brightgreen?style=for-the-badge)
![Build](https://img.shields.io/badge/Build-Passing-success?style=for-the-badge)

**الموقع الحي / Live Site:** [mmc-mms.com](https://mmc-mms.com) | [www.mmc-mms.com](https://www.mmc-mms.com)

</div>

---

## 🎯 الهدف / Purpose

نظام رقمي متكامل لإدارة الطوابير والعيادات في اللجنة الطبية العسكرية، يُتيح للمرضى العسكريين تسجيل الدخول، الحصول على أرقام الطابور، ومتابعة مسارهم الطبي عبر جميع العيادات — بدون ورق، بدون انتظار عشوائي، بدون تعقيد.

A fully digital system for managing queues and clinics in the Military Medical Committee. It allows military patients to log in, get queue numbers, and track their medical journey across all clinics — paperless, organized, and efficient.

---

## 🌐 الروابط الحية / Live URLs

| الخدمة / Service | الرابط / URL |
|---|---|
| **الموقع الرئيسي** | https://mmc-mms.com |
| **www** | https://www.mmc-mms.com |
| **لوحة الإدارة** | https://mmc-mms.com/admin |
| **API الرئيسي** | https://love-api-bomussa.vercel.app/api/v1 |
| **API Health** | https://love-api-bomussa.vercel.app/api/health |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/rujwuruuosffcxazymit |
| **Vercel Dashboard** | https://vercel.com/bomussa/love |

---

## 🔑 بيانات الدخول / Access Credentials

### لوحة الإدارة / Admin Panel
```
URL:      https://mmc-mms.com/admin
Username: Bomussa
Password: [محفوظ بأمان في Supabase]
Role:     super_admin
```

### Supabase
```
Project URL: https://rujwuruuosffcxazymit.supabase.co
Project ID:  rujwuruuosffcxazymit
Anon Key:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10
Service Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...5PWwdcBXgS1FZhwRonSRgdbnUQuXHl5VeIHvr41yUbs
API Key:     sbp_78e9b4149e5c4f201e980e88f3a5b1408cf20f83
```

### Vercel
```
Token:      NJ7LJFyyeQTxlPW4aaiHrQ6I
Org ID:     team_aFtFTvzgabqENB5bOxn4SiO7
Project ID: prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM
```

### GitHub
```
Repos:  Bomussa/love (frontend), Bomussa/love-api (backend)
Token:  github_pat_11BM3TZRQ0LZE38gPbfSPT_...
```

---

## 🏗️ هيكل المشروع / Project Structure

```
love/                          ← المستودع الرئيسي
├── frontend/                  ← واجهة React (Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/        ← 29 مكوّن React
│   │   │   ├── AdminDashboardV2.jsx    (5,501 سطر - لوحة الإدارة الكاملة)
│   │   │   ├── SmartDiagnosticsPanel.jsx (663 سطر - النظام الذكي)
│   │   │   ├── PatientPage.jsx         (صفحة المريض)
│   │   │   ├── ClinicDashboard.jsx     (لوحة العيادة)
│   │   │   ├── DisplayPage.jsx         (شاشة العرض)
│   │   │   └── ...
│   │   ├── lib/               ← 35 ملف منطق وخدمات
│   │   │   ├── api-unified.js          (65,532 بايت - API موحد)
│   │   │   ├── smart-repair-engine.js  (23,808 بايت - محرك الإصلاح)
│   │   │   ├── memory-manager.js       (12,117 بايت - إدارة الذاكرة)
│   │   │   ├── supabase-client.js      (15,826 بايت - اتصال Supabase)
│   │   │   ├── i18n.js                 (15,774 بايت - الترجمة)
│   │   │   └── ...
│   │   └── App.jsx            ← نقطة الدخول الرئيسية
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── love-api/                  ← API Node.js (Vercel Serverless)
│   ├── api/
│   │   ├── v1.js              ← 21 endpoint رئيسي
│   │   ├── health.js          ← فحص الصحة
│   │   └── maintenance.js     ← الصيانة
│   └── vercel.json
└── docs/                      ← التوثيق الكامل
    ├── README.md              ← هذا الملف
    ├── DATABASE.md            ← قاعدة البيانات (97 جدول)
    ├── ARCHITECTURE.md        ← الهيكل التقني
    ├── API.md                 ← توثيق API
    ├── MAINTENANCE.md         ← دليل الصيانة
    ├── SECURITY.md            ← الأمان
    └── ...
```

---

## 📊 إحصاءات المشروع / Project Statistics

| المقياس / Metric | القيمة / Value |
|---|---|
| **إجمالي ملفات src** | 95 ملف |
| **مكونات React** | 29 مكوّن |
| **ملفات المنطق (lib)** | 35 ملف |
| **إجمالي أسطر الكود** | 32,538 سطر |
| **حجم dist (بعد البناء)** | 6.0 MB |
| **جداول قاعدة البيانات** | 97 جدول |
| **عيادات نشطة** | 18 عيادة |
| **API endpoints** | 21 endpoint |
| **لغات مدعومة** | عربي + إنجليزي |
| **ثيمات متاحة** | 6 ثيمات |

---

## 🚀 التشغيل المحلي / Local Development

```bash
# 1. استنساخ المشروع
git clone https://github.com/Bomussa/love.git
cd love/frontend

# 2. تثبيت الحزم
pnpm install

# 3. إعداد متغيرات البيئة
cp .env.example .env.local
# أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY

# 4. تشغيل التطوير
pnpm dev

# 5. البناء للإنتاج
pnpm build
```

---

## 🏥 العيادات / Clinics (18 عيادة)

| الكود | العيادة | الطابق | النوع |
|---|---|---|---|
| PSY | الطب النفسي / Psychiatry | 2 | clinic |
| EYE | العيون / Ophthalmology | 2 | clinic |
| ENT | أنف وأذن / ENT | 2 | clinic |
| INT | الباطنية / Internal Medicine | 2 | clinic |
| SUR | الجراحة / Surgery | 2 | clinic |
| DER | الجلدية / Dermatology | 2 | clinic |
| NEURO | الأعصاب / Neurology | 2 | clinic |
| DNT | الأسنان / Dentistry | 2 | clinic |
| ECG | تخطيط القلب / ECG | 2 | station |
| BIO | القياسات الحيوية / Biometrics | 2 | station |
| AUD | قياس السمع / Audiology | 2 | station |
| XR | الأشعة / Radiology | M | station |
| LAB | المختبر / Laboratory | M | labs |
| F_INT | الباطنية نساء / Int. Women | 3 | clinic |
| F_EYE | العيون نساء / Eye Women | 3 | clinic |
| F_DER | الجلدية نساء / Der. Women | 3 | clinic |
| clinic_001 | القلب / Cardiology | 2 | clinic |
| clinic_002 | العظام / Orthopedics | 2 | clinic |

---

## 🧠 النظام الذكي / Smart System

النظام الذكي للتشخيص والإصلاح التلقائي يعمل في الخلفية باستمرار:

| الخوارزمية | المصدر | الوظيفة |
|---|---|---|
| **Circuit Breaker** | Netflix Hystrix | يوقف الطلبات عند تجاوز عتبة الفشل |
| **Retry + Exponential Backoff** | AWS Standard | إعادة المحاولة: 500ms → 1s → 2s |
| **Watchdog Timer** | POSIX Standard | مراقبة دورية كل 60 ثانية |
| **Health Check Pattern** | Kubernetes Probes | فحص صحة كل خدمة |
| **Error Boundary** | React 16+ | عزل أخطاء المكونات |
| **Bulkhead Pattern** | Release It! | عزل كل خدمة مستقلة |
| **Memory Manager** | Custom | حذف تلقائي عند امتلاء الذاكرة |

---

## 📚 التوثيق / Documentation

| الملف | الوصف |
|---|---|
| [DATABASE.md](docs/DATABASE.md) | قاعدة البيانات الكاملة (97 جدول) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | الهيكل التقني الشامل |
| [API.md](docs/API.md) | توثيق API (21 endpoint) |
| [MAINTENANCE.md](docs/MAINTENANCE.md) | دليل الصيانة والإصلاح |
| [SECURITY.md](docs/SECURITY.md) | الأمان وسياسات RLS |

---

## 🛠️ التقنيات / Tech Stack

| الطبقة | التقنية |
|---|---|
| **Frontend** | React 18 + Vite + TailwindCSS |
| **Backend API** | Node.js Serverless (Vercel) |
| **Database** | Supabase PostgreSQL |
| **Auth** | Supabase Auth + Custom PIN |
| **Hosting** | Vercel (Frontend + API) |
| **Font** | Cairo (Arabic + Latin) |
| **State** | React Hooks + Context |
| **Realtime** | Supabase Realtime |

---

*آخر تحديث / Last Updated: 2026-02-26 | الإصدار / Version: 2.0.0*
