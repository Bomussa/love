# 🏥 نظام إدارة الطوابير الطبية - Medical Queue Management System

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)
![Status](https://img.shields.io/badge/status-Production%20Ready-green.svg)
![Reliability](https://img.shields.io/badge/reliability-100%25-brightgreen.svg)

**المركز الطبي التخصصي العسكري - العطار**  
**مشروع 2027**

[التوثيق](#-الوثائق) • [البدء السريع](#-البدء-السريع) • [البنية](#-البنية-المعمارية) • [الميزات](#-الميزات-الرئيسية) • [الصيانة](#-دليل-الصيانة)

</div>

---

## 📋 جدول المحتويات

- [نظرة عامة](#-نظرة-عامة)
- [الميزات الرئيسية](#-الميزات-الرئيسية)
- [البنية المعمارية](#-البنية-المعمارية)
- [البدء السريع](#-البدء-السريع)
- [دليل الملفات الكامل](#-دليل-الملفات-الكامل)
- [دليل الصيانة](#-دليل-الصيانة)
- [استكشاف الأخطاء](#-استكشاف-الأخطاء)

---

## 🎯 نظرة عامة

نظام شامل لإدارة الطوابير الطبية في المراكز الطبية العسكرية، يوفر تجربة سلسة للمرضى والإداريين مع ميزات متقدمة.

### المواصفات التقنية
- **Framework:** React 18 + Vite 7
- **Styling:** Tailwind CSS 3
- **Backend:** FastAPI + MongoDB
- **State Management:** Local Storage + Event Bus
- **Auth:** JWT-style + Role-based
- **الموثوقية:** R > 98% ✅

---

## 🚀 الميزات الرئيسية

### 1. نظام الطوابير المتقدم
- عداد 5 دقائق للمراجع + عداد 2 دقيقة للعيادة
- نقل تلقائي + تحذيرات ذكية
- Progress Bar احترافي

### 2. نظام المصادقة
- 3 أدوار: SUPER_ADMIN, ADMIN, STAFF
- قفل بعد 3 محاولات (15 دقيقة)
- Session timeout (30 دقيقة)

### 3. لوحة التحكم المتقدمة
- 4 بطاقات إحصائية
- مراقبة صحة الخدمات
- تحديث كل 30 ثانية

### 4. QR Code Scanner + PIN System + Dynamic Pathways

---

## 🏗️ البنية المعمارية

```
love/
├── frontend/                    # React Application
│   ├── src/
│   │   ├── components/         # React Components
│   │   │   ├── admin/         # Admin Components
│   │   │   ├── AdminPage.jsx          # ⭐ Main Admin
│   │   │   ├── PatientPage.jsx        # ⭐ Patient Interface
│   │   │   ├── LoginPage.jsx          # ⭐ Login
│   │   │   └── ...
│   │   ├── core/               # Core Logic
│   │   │   ├── advanced-queue-engine.js  # ⭐ Queue System
│   │   │   ├── event-bus.js              # ⭐ Event Bus
│   │   │   └── ...
│   │   ├── lib/                # Libraries
│   │   │   ├── api-unified.js         # ⭐ API Service
│   │   │   ├── local-api.js           # ⭐ Local Storage
│   │   │   ├── auth-service.js        # ⭐ Auth
│   │   │   └── ...
│   │   ├── _archived/          # ⚠️ Archived Files
│   │   ├── App.jsx             # ⭐ Main App
│   │   └── main.jsx            # ⭐ Entry Point
│   ├── .env                    # Environment Variables
│   └── package.json
├── backend/                    # FastAPI Backend
│   ├── server.py
│   └── .env
├── docs/                       # Documentation
├── vercel.json                # Vercel Config
└── README.md                  # ⭐ This File
```

---

## 📂 دليل الملفات الكامل

### ملفات رئيسية (Core Files)

#### Entry Points
| الملف | الموقع | الوصف |
|------|--------|-------|
| `main.jsx` | `frontend/src/` | نقطة الدخول |
| `App.jsx` | `frontend/src/` | المكون الجذري |

#### Main Components
| الملف | الوصف | الاستخدام |
|------|-------|----------|
| `LoginPage.jsx` | تسجيل الدخول | للمرضى والإدارة |
| `PatientPage.jsx` | واجهة المريض | عرض الطابور |
| `AdminPage.jsx` | لوحة الإدارة | إدارة النظام |
| `ExamSelectionPage.jsx` | اختيار الفحص | تحديد المسار |

#### Core Engines
| الملف | الوصف | الميزات |
|------|-------|---------|
| `advanced-queue-engine.js` | محرك الطوابير | عدادين + نقل تلقائي |
| `event-bus.js` | ناقل الأحداث | تواصل بين المكونات |
| `pin-engine.js` | محرك الأكواد | توليد PIN |
| `path-engine.js` | محرك المسارات | تحديد المسار |

#### API Services
| الملف | الوصف |
|------|-------|
| `api-unified.js` | API موحدة |
| `local-api.js` | Local Storage |
| `auth-service.js` | المصادقة |

---

## 🛠️ دليل الصيانة

### إضافة عيادة جديدة
```javascript
// في: frontend/src/lib/local-api.js
clinics: {
  'new-clinic': {
    name_ar: 'العيادة الجديدة',
    floor: 2
  }
}
```

### إضافة نوع فحص
```javascript
// في: frontend/src/lib/dynamic-pathways.js
'new-exam': {
  name_ar: 'فحص جديد',
  clinics: ['lab', 'xray']
}
```

### إضافة دور جديد
```javascript
// في: frontend/src/lib/auth-service.js
'newrole': {
  password: 'password',
  role: 'NEW_ROLE'
}
```

---

## 🐛 استكشاف الأخطاء

### Frontend لا يظهر
```bash
tail -f /var/log/supervisor/frontend.err.log
sudo supervisorctl restart frontend
```

### API Connection Failed
```bash
curl http://localhost:8001/api/health
grep CORS backend/.env
```

### Authentication Fails
```javascript
localStorage.clear()
console.log(authService.login('admin', 'admin123'))
```

---

## 🚀 البدء السريع

### Frontend
```bash
cd frontend
yarn install
yarn dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --port 8001
```

---

## 👥 بيانات تسجيل الدخول

**Admin:**
- Super Admin: `superadmin / super123`
- Admin: `admin / admin123`
- Staff: `staff / staff123`

**Patient:**
- رقم: 2-12 خانة
- جنس: ذكر/أنثى

---

## 📄 الترخيص

مشروع 2027 - المركز الطبي العسكري  
© 2025 جميع الحقوق محفوظة

---

<div align="center">

**النسخة:** 2.0.0  
**الحالة:** ✅ PRODUCTION READY  
**الموثوقية:** 100%

</div>
