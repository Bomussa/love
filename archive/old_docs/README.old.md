# نظام إدارة الدور الطبي العسكري (MMC-MMS)
## Military Medical Committee - Queue Management System

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production-success.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

**نظام متكامل لإدارة دور المراجعين في المركز الطبي العسكري**

[الموقع الرسمي](https://www.mmc-mms.com) | [التوثيق](#-التوثيق) | [الدعم](#-الدعم-والمساعدة)

</div>

---

## 📋 جدول المحتويات

- [نظرة عامة](#-نظرة-عامة)
- [المميزات](#-المميزات-الرئيسية)
- [البنية التقنية](#-البنية-التقنية)
- [رحلة المراجع](#-رحلة-المراجع-الكاملة)
- [لوحة الإدارة](#-لوحة-الإدارة)
- [واجهة برمجة التطبيقات](#-واجهة-برمجة-التطبيقات-api)
- [التثبيت والتشغيل](#-التثبيت-والتشغيل)
- [البيئة والنشر](#-البيئة-والنشر)
- [الأمان](#-الأمان)
- [الأداء](#-الأداء)
- [الاختبارات](#-الاختبارات)
- [المساهمة](#-المساهمة)
- [الدعم](#-الدعم-والمساعدة)

---

## 🎯 نظرة عامة

**نظام إدارة الدور الطبي العسكري** هو حل متكامل وحديث لإدارة دور المراجعين في المركز الطبي العسكري. يوفر النظام تجربة سلسة للمراجعين والإداريين مع ضمان الدقة والموثوقية 100%.

### لماذا هذا النظام؟

- ✅ **القضاء على الازدحام** - نظام دور إلكتروني ذكي
- ✅ **الشفافية الكاملة** - المراجع يعرف موقعه بالضبط
- ✅ **التحديثات الحية** - إشعارات فورية عند اقتراب الدور
- ✅ **لا تكرار** - نظام UUID يضمن أرقام فريدة 100%
- ✅ **متعدد اللغات** - عربي وإنجليزي
- ✅ **سهل الاستخدام** - واجهة بديهية للجميع

---

## ✨ المميزات الرئيسية

### للمراجعين

- 🎫 **إصدار رقم دور فوري** - بدون انتظار
- 📱 **تتبع الدور مباشرة** - معرفة الموقع الحالي
- 🔔 **إشعارات حية** - تنبيهات عند اقتراب الدور
- 🗺️ **خريطة المسار الطبي** - معرفة العيادات المطلوبة
- 🌐 **متعدد اللغات** - عربي/إنجليزي
- 📊 **شفافية كاملة** - معرفة عدد المنتظرين

### للإداريين

- 👥 **مراقبة جميع الأدوار** - في الوقت الفعلي
- 📈 **إحصائيات شاملة** - تقارير يومية وشهرية
- 🎛️ **التحكم الكامل** - إدارة جميع العيادات
- 🔐 **نظام PIN آمن** - للتحقق من الهوية
- 📞 **استدعاء المراجعين** - بضغطة زر
- 📋 **سجل كامل** - لجميع العمليات

---

## 🏗️ البنية التقنية

### Frontend (الواجهة الأمامية)

```
التقنيات:
- React 18.3.1
- Vite 5.4.11
- TailwindCSS 3.4.15
- Lucide React

المكونات الرئيسية:
├── LoginPage.jsx
├── ExamSelectionPage.jsx
├── PatientPage.jsx
├── AdminPage.jsx
├── AdminQueueMonitor.jsx
└── AdminPINMonitor.jsx
```

### Backend (الخادم الخلفي)

```
التقنيات:
- Cloudflare Workers
- Cloudflare KV
- Server-Sent Events (SSE)

API Endpoints:
├── /api/v1/queue/enter    - دخول الدور
├── /api/v1/queue/status   - حالة الدور
├── /api/v1/queue/done     - إنهاء الدور
├── /api/v1/queue/call     - استدعاء المراجع
├── /api/v1/pin/status     - حالة PIN
├── /api/v1/path/choose    - اختيار المسار
├── /api/v1/admin/status   - حالة الإدارة
├── /api/v1/health/status  - فحص الصحة
└── /api/v1/events/stream  - التحديثات الحية (SSE)
```

---

## 👤 رحلة المراجع الكاملة

### 1️⃣ تسجيل الدخول

المراجع يدخل الرقم الشخصي (9-12 رقم) ويختار الجنس.

### 2️⃣ اختيار نوع الفحص

المراجع يختار من 8 أنواع فحوصات مختلفة.

### 3️⃣ المسار الطبي

لكل عيادة:
1. دخول العيادة → يحصل على رقم دور فريد
2. انتظار الدور
3. إنهاء الفحص → إدخال PIN
4. الانتقال للعيادة التالية

### 4️⃣ التحديثات الحية (SSE)

النظام يرسل تحديثات فورية عند أي تغيير في الدور.

---

## 🔌 واجهة برمجة التطبيقات (API)

### Base URL

```
Production: https://www.mmc-mms.com/api/v1
```

### دخول الدور

```http
POST /api/v1/queue/enter
Content-Type: application/json

{
  "clinic": "lab",
  "user": "123456789012"
}
```

**Response:**

```json
{
  "success": true,
  "clinic": "lab",
  "user": "123456789012",
  "number": 202510190932503140,
  "display_number": 1,
  "status": "WAITING",
  "ahead": 0
}
```

### حالة الدور

```http
GET /api/v1/queue/status?clinic=lab
```

### إنهاء الدور

```http
POST /api/v1/queue/done
Content-Type: application/json

{
  "clinic": "lab",
  "user": "123456789012",
  "pin": "1"
}
```

### SSE Stream

```http
GET /api/v1/events/stream?clinic=lab
```

---

## 🚀 التثبيت والتشغيل

### المتطلبات

```
Node.js >= 18.0.0
npm >= 9.0.0
```

### التثبيت المحلي

```bash
# 1. استنساخ المشروع
git clone https://github.com/Bomussa/2027.git
cd 2027

# 2. تثبيت الحزم
npm install

# 3. تشغيل التطوير
npm run dev

# 4. فتح المتصفح
# http://localhost:5173
```

### البناء للإنتاج

```bash
npm run build
npm run preview
```

---

## ☁️ البيئة والنشر

### Cloudflare Pages

```yaml
Build command: npm run build
Build output directory: dist
Node version: 18
```

### النشر التلقائي

كل push إلى main يتم نشره تلقائياً على Cloudflare Pages.

---

## 🔒 الأمان

- ✅ HTTPS فقط
- ✅ تشفير البيانات في النقل
- ✅ التحقق من صحة جميع المدخلات
- ✅ نظام PIN للتحقق

---

## ⚡ الأداء

```
Page Load Time: < 2 seconds
API Response Time: < 200ms
SSE Latency: < 100ms
Uptime: 99.9%
```

---

## 📁 هيكل المشروع

```
2027/
├── src/                    # Frontend
│   ├── components/
│   ├── lib/
│   └── App.jsx
├── functions/              # Backend
│   └── api/v1/
├── public/
├── docs/
├── wrangler.toml
└── package.json
```

---

## 📞 الدعم والمساعدة

- 📧 Email: support@mmc-mms.com
- 🌐 Website: https://www.mmc-mms.com
- 📱 GitHub: https://github.com/Bomussa/2027

---

## 📜 الترخيص

```
Proprietary - جميع الحقوق محفوظة
المركز الطبي العسكري © 2025
```

---

<div align="center">

**صنع بـ ❤️ في المركز الطبي العسكري**

</div>

