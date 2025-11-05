# 📚 دليل هيكل المشروع - Military Medical Committee

**التاريخ:** 5 نوفمبر 2025  
**المستودع:** [Bomussa/love](https://github.com/Bomussa/love)  
**الموقع:** [mmc-mms.com](https://mmc-mms.com)  
**الواجهة:** Vercel  
**الخادم:** Backend API

---

## 📁 الهيكل العام للمشروع

```
love/
├── frontend/          # تطبيق React (Vite)
├── backend/           # خادم Python (Flask/FastAPI)
├── api/              # Serverless functions (Vercel)
├── supabase/         # قاعدة البيانات والوظائف
├── ops/              # مراقبة وإدارة العمليات
├── scripts/          # سكريبتات الاختبار والأتمتة
├── tests/            # اختبارات الوحدة
└── docs/             # التوثيق
```

---

## 🎨 Frontend (React + Vite)

### 📂 المجلد الرئيسي: `frontend/`

```
frontend/
├── src/
│   ├── components/        # مكونات React
│   ├── lib/              # مكتبات ووظائف مساعدة
│   ├── core/             # محركات النظام الأساسية
│   ├── hooks/            # React Hooks مخصصة
│   ├── api/              # طبقة API
│   ├── styles/           # ملفات CSS
│   └── config/           # إعدادات التطبيق
├── config/               # ملفات JSON للإعدادات
├── public/               # ملفات ثابتة
└── plugins/              # إضافات خارجية
```

---

## 🔧 الملفات الرئيسية للتعديل

### 1️⃣ **صفحات التطبيق** (`frontend/src/components/`)

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `LoginPage.jsx` | صفحة تسجيل دخول المريض | `frontend/src/components/LoginPage.jsx` |
| `PatientPage.jsx` | صفحة المريض (العيادات والعد التنازلي) | `frontend/src/components/PatientPage.jsx` |
| `AdminPage.jsx` | صفحة الإدارة الأساسية | `frontend/src/components/AdminPage.jsx` |
| `EnhancedAdminDashboard.jsx` | لوحة الإدارة المتقدمة | `frontend/src/components/EnhancedAdminDashboard.jsx` |
| `AdminLoginPage.jsx` | صفحة تسجيل دخول الإدارة | `frontend/src/components/admin/AdminLoginPage.jsx` |
| `ExamSelectionPage.jsx` | صفحة اختيار نوع الفحص | `frontend/src/components/ExamSelectionPage.jsx` |
| `CompletePage.jsx` | صفحة إكمال الفحوصات | `frontend/src/components/CompletePage.jsx` |

---

### 2️⃣ **المكونات المهمة** (`frontend/src/components/`)

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `CountdownTimer.jsx` | مكون العد التنازلي | `frontend/src/components/CountdownTimer.jsx` |
| `ZFDTicketDisplay.jsx` | عرض تذكرة ZFD | `frontend/src/components/ZFDTicketDisplay.jsx` |
| `NotificationSystem.jsx` | نظام الإشعارات | `frontend/src/components/NotificationSystem.jsx` |
| `QRScanner.jsx` | ماسح الباركود | `frontend/src/components/QRScanner.jsx` |
| `Button.jsx` | مكون الزر المخصص | `frontend/src/components/Button.jsx` |
| `Card.jsx` | مكون البطاقة | `frontend/src/components/Card.jsx` |
| `Input.jsx` | مكون حقل الإدخال | `frontend/src/components/Input.jsx` |

---

### 3️⃣ **المحركات الأساسية** (`frontend/src/core/`)

| الملف | الوصف | المسار الكامل |
|-------|---|---------------|
| `queue-engine.js` | محرك إدارة الطوابير | `frontend/src/core/queue-engine.js` |
| `advanced-queue-engine.js` | محرك الطوابير المتقدم | `frontend/src/core/advanced-queue-engine.js` |
| `notification-engine.js` | محرك الإشعارات | `frontend/src/core/notification-engine.js` |
| `path-engine.js` | محرك المسارات الديناميكية | `frontend/src/core/path-engine.js` |
| `pin-engine.js` | محرك البن كود | `frontend/src/core/pin-engine.js` |
| `event-bus.js` | نظام الأحداث | `frontend/src/core/event-bus.js` |

---

### 4️⃣ **طبقة API** (`frontend/src/lib/`)

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `api.js` | API الرئيسية | `frontend/src/lib/api.js` |
| `enhanced-api.js` | API محسنة | `frontend/src/lib/enhanced-api.js` |
| `api-unified.js` | API موحدة | `frontend/src/lib/api-unified.js` |
| `api-adapter.js` | محول API | `frontend/src/lib/api-adapter.js` |
| `local-api.js` | API محلية | `frontend/src/lib/api-local.js` |
| `auth-service.js` | خدمة المصادقة | `frontend/src/lib/auth-service.js` |
| `db.js` | قاعدة البيانات المحلية | `frontend/src/lib/db.js` |

---

### 5️⃣ **الوظائف المساعدة** (`frontend/src/lib/`)

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `eta.js` | حساب الوقت المتوقع | `frontend/src/lib/eta.js` |
| `i18n.js` | الترجمة (عربي/إنجليزي) | `frontend/src/lib/i18n.js` |
| `dynamic-pathways.js` | المسارات الديناميكية | `frontend/src/lib/dynamic-pathways.js` |
| `enhanced-themes.js` | السمات المحسنة | `frontend/src/lib/enhanced-themes.js` |

---

### 6️⃣ **ملفات الإعدادات** (`frontend/config/`)

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `features.json` | تفعيل/تعطيل الميزات | `frontend/config/features.json` |
| `constants.json` | الثوابت العامة | `frontend/config/constants.json` |
| `clinics.json` | بيانات العيادات | `frontend/config/clinics.json` |
| `routeMap.json` | خريطة المسارات | `frontend/config/routeMap.json` |

---

### 7️⃣ **ملفات الأنماط** (`frontend/src/`)

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `index.css` | الأنماط الرئيسية | `frontend/src/index.css` |
| `responsive-fixes.css` | إصلاحات الاستجابة | `frontend/src/responsive-fixes.css` |
| `qr-safe.css` | إخفاء أزرار QR | `frontend/src/styles/qr-safe.css` |

---

## 🔌 Backend (Python)

### 📂 المجلد الرئيسي: `backend/`

```
backend/
├── server.py           # خادم Flask/FastAPI
└── requirements.txt    # اعتماديات Python
```

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `server.py` | الخادم الرئيسي | `backend/server.py` |
| `requirements.txt` | اعتماديات Python | `backend/requirements.txt` |

---

## ☁️ Serverless Functions (Vercel)

### 📂 المجلد الرئيسي: `api/`

```
api/
├── login.ts           # تسجيل دخول المريض
├── signin.ts          # تسجيل دخول الإدارة
└── _lib/
    └── cors.ts        # إعدادات CORS
```

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `login.ts` | API تسجيل دخول المريض | `api/login.ts` |
| `signin.ts` | API تسجيل دخول الإدارة | `api/signin.ts` |
| `cors.ts` | إعدادات CORS | `api/_lib/cors.ts` |

---

## 🗄️ Supabase (قاعدة البيانات)

### 📂 المجلد الرئيسي: `supabase/`

```
supabase/
├── functions/         # Supabase Edge Functions
│   ├── login/        # دالة تسجيل الدخول
│   ├── healthz/      # فحص الصحة
│   └── _shared/      # وظائف مشتركة
└── migrations/       # ترحيلات قاعدة البيانات
    └── 20251102_login_audit.sql
```

---

## 📊 العمليات والمراقبة

### 📂 المجلد الرئيسي: `ops/`

```
ops/
├── prom-stack/
│   ├── docker-compose.yml    # Docker Compose
│   ├── prometheus.yml        # إعدادات Prometheus
│   ├── rules.yml            # قواعد التنبيه
│   └── grafana/             # لوحات Grafana
└── README-OPS.md            # دليل العمليات
```

---

## 🧪 الاختبارات

### 📂 المجلد الرئيسي: `tests/`

```
tests/
├── unit/
│   └── eta.test.js          # اختبار حساب ETA
└── __init__.py
```

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `eta.test.js` | اختبار دالة ETA | `tests/unit/eta.test.js` |

---

## 🚀 السكريبتات

### 📂 المجلد الرئيسي: `scripts/`

```
scripts/
├── conn-check.mjs           # فحص الاتصال
├── e2e/
│   └── login-smoke.sh       # اختبار دخان تسجيل الدخول
├── examples/
│   └── node-redis-consistency.mjs
├── lib/
│   └── circuit-breaker.ts   # قاطع الدائرة
└── metrics/
    └── push-synthetic.mjs   # دفع المقاييس
```

---

## 📝 ملفات التوثيق

| الملف | الوصف | المسار الكامل |
|-------|-------|---------------|
| `README.md` | الدليل الرئيسي | `README.md` |
| `README_STRUCTURE.md` | هيكل المشروع (هذا الملف) | `README_STRUCTURE.md` |
| `ARCHITECTURE.md` | البنية المعمارية | `ARCHITECTURE.md` |
| `FILE_INDEX.md` | فهرس الملفات | `FILE_INDEX.md` |
| `FIXES_REPORT.md` | تقرير الإصلاحات | `FIXES_REPORT.md` |
| `INTEGRATION_REPORT.md` | تقرير التكامل | `INTEGRATION_REPORT.md` |
| `RECOVERY_REPORT.md` | تقرير الاستعادة | `RECOVERY_REPORT.md` |
| `USER_GUIDE_AR.md` | دليل المستخدم (عربي) | `USER_GUIDE_AR.md` |
| `README-OPS.md` | دليل العمليات | `README-OPS.md` |
| `README_DEPLOYMENT.md` | دليل النشر | `README_DEPLOYMENT.md` |
| `VERCEL_SETUP_INSTRUCTIONS.md` | إعدادات Vercel | `VERCEL_SETUP_INSTRUCTIONS.md` |

---

## 🔑 الملفات الحساسة (لا تُرفع لـ Git)

```
.env                    # متغيرات البيئة
.env.local             # متغيرات محلية
node_modules/          # اعتماديات Node.js
dist/                  # ملفات البناء
build/                 # ملفات البناء
.vercel/               # إعدادات Vercel المحلية
```

---

## 🛠️ أهم الملفات للتعديل حسب المهمة

### ✅ إضافة/تعديل صفحة جديدة
```
frontend/src/components/[PageName].jsx
frontend/src/App.jsx (إضافة Route)
```

### ✅ تعديل منطق الطوابير
```
frontend/src/core/queue-engine.js
frontend/src/core/advanced-queue-engine.js
frontend/src/components/PatientPage.jsx
```

### ✅ تعديل العد التنازلي
```
frontend/src/components/CountdownTimer.jsx
frontend/src/lib/eta.js
```

### ✅ تعديل الإشعارات
```
frontend/src/core/notification-engine.js
frontend/src/components/NotificationSystem.jsx
```

### ✅ تعديل البن كود (PIN)
```
frontend/src/core/pin-engine.js
frontend/src/components/PatientPage.jsx (handleClinicExit)
```

### ✅ تعديل المسارات الديناميكية
```
frontend/src/core/path-engine.js
frontend/src/lib/dynamic-pathways.js
frontend/config/routeMap.json
```

### ✅ تعديل API
```
frontend/src/lib/api.js
frontend/src/lib/enhanced-api.js
api/login.ts
api/signin.ts
backend/server.py
```

### ✅ تعديل الإعدادات
```
frontend/config/features.json
frontend/config/constants.json
frontend/config/clinics.json
```

### ✅ تعديل الأنماط
```
frontend/src/index.css
frontend/tailwind.config.js
frontend/src/styles/qr-safe.css
```

---

## 📦 إعدادات المشروع

### `package.json` (Frontend)
```json
{
  "name": "frontend",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "jest"
  }
}
```

### `vercel.json` (Vercel Configuration)
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite"
}
```

---

## 🔄 سير العمل (Workflow)

### 1. تطوير محلي
```bash
cd frontend
npm install
npm run dev
```

### 2. اختبار
```bash
npm test
```

### 3. بناء
```bash
npm run build
```

### 4. نشر
```bash
git add .
git commit -m "feat: description"
git push origin main
```

### 5. Vercel ينشر تلقائياً
- عند الدفع إلى `main` → نشر production
- عند الدفع إلى فرع آخر → نشر preview

---

## 📞 جهات الاتصال

- **المستودع:** https://github.com/Bomussa/love
- **الموقع:** https://mmc-mms.com
- **الدعم:** https://help.manus.im

---

## 📅 آخر تحديث

**التاريخ:** 5 نوفمبر 2025  
**الإصدار:** 2.0.0  
**المطور:** Manus AI Agent

---

## 🎯 الإصلاحات الأخيرة

### ✅ 5 نوفمبر 2025 - التحديث الثالث (17:00)
1. **إصلاح نهائي:** أخذ رقم دور بدون دخول تلقائي
   - عند تسجيل الدخول → المريض يأخذ رقم فقط
   - العيادة تكون `ready` لكن `isEntered: false`
   - يظهر زر "🚪 دخول العيادة"
   - عند الضغط → يتفعل العد التنازلي والإشعارات وPIN

2. **إصلاح Vercel:** تحديث `vercel.json` لاستخدام `npm` بدلاً من `yarn`

3. **توثيق:** إضافة `README_STRUCTURE.md` الشامل

---

### ✅ 5 نوفمبر 2025 - التحديث الثاني (14:00)
1. تصحيح حساب الوقت المتوقع (ETA) → `ahead * 2 دقيقة`
2. إخفاء زر مسح الباركود من صفحة التسجيل
3. إضافة اختبارات وحدة شاملة (7 اختبارات)

---

**الملفات المعدلة (اليوم):**
- `frontend/src/components/PatientPage.jsx` - إصلاح منطق الدخول
- `vercel.json` - إصلاح إعدادات البناء
- `frontend/src/components/LoginPage.jsx` - إخفاء QR
- `frontend/src/lib/eta.js` - حساب ETA
- `frontend/config/features.json` - إعدادات الميزات
- `tests/unit/eta.test.js` - اختبارات
- `README_STRUCTURE.md` - توثيق شامل

---

## 📚 مراجع إضافية

- [دليل المستخدم (عربي)](USER_GUIDE_AR.md)
- [البنية المعمارية](ARCHITECTURE.md)
- [تقرير الإصلاحات](FIXES_REPORT.md)
- [دليل النشر](README_DEPLOYMENT.md)
- [دليل العمليات](README-OPS.md)

---

**ملاحظة:** هذا الملف يُحدّث باستمرار مع كل تعديل رئيسي في المشروع.
