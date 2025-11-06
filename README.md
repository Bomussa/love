# Military Medical Committee System (MMC-MMS)

**نظام إدارة اللجان الطبية العسكرية**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://www.mmc-mms.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-green?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0-blue?logo=react)](https://reactjs.org/)

**آخر تحديث:** 6 نوفمبر 2025 - 03:25 صباحاً (GMT+3)

---

## 📋 نظرة عامة

نظام متكامل لإدارة الفحوصات الطبية العسكرية يتيح للمرضى تتبع مسار فحصهم الطبي عبر عيادات متعددة، مع نظام طوابير ذكي وإشعارات فورية.

### ✨ المميزات الرئيسية

- 🏥 **8 أنواع فحوصات طبية** مع مسارات مخصصة لكل نوع
- 📱 **واجهة مستخدم عصرية** متجاوبة مع جميع الأجهزة
- 🎨 **6 ثيمات مختلفة** للواجهة
- ⏱️ **نظام طوابير ذكي** مع حساب الوقت المتوقع
- 🔔 **إشعارات فورية** باستخدام Server-Sent Events
- 🌐 **دعم اللغتين** العربية والإنجليزية
- 🔐 **نظام أمان متقدم** مع Row Level Security
- 📊 **لوحة تحكم إدارية** شاملة

---

## 🏗️ البنية التقنية

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** CSS Modules + Tailwind CSS
- **State Management:** React Context API
- **HTTP Client:** Supabase Client
- **Deployment:** Vercel

### Backend
- **Database:** PostgreSQL (Supabase)
- **API:** Supabase REST API + Vercel Serverless Functions
- **Real-time:** Server-Sent Events (SSE)
- **Authentication:** Supabase Auth

### Infrastructure
- **Hosting:** Vercel (Frontend + API)
- **Database:** Supabase (PostgreSQL + Storage)
- **CDN:** Vercel Edge Network
- **SSL:** Automatic (Vercel + Custom Domain)

---

## 📊 قاعدة البيانات

### الجداول الرئيسية

| الجدول | الوصف | السجلات |
|--------|-------|---------|
| `patients` | بيانات المرضى | ديناميكي |
| `exam_types` | أنواع الفحوصات الطبية | 8 سجلات |
| `clinics` | العيادات المتاحة | 13 عيادة |
| `queues` | طوابير الانتظار | ديناميكي |
| `pathways` | مسارات الفحص للمرضى | ديناميكي |
| `notifications` | الإشعارات | ديناميكي |
| `admin_users` | المستخدمون الإداريون | محدود |

### أنواع الفحوصات المتاحة

1. **فحص التجنيد** - 13 خطوة (فحص شامل)
2. **فحص النقل** - 4 خطوات
3. **فحص الترفيع** - 3 خطوات
4. **فحص التحويل** - 4 خطوات
5. **فحص الدورات** - 3 خطوات
6. **فحص الطباخين** - 5 خطوات
7. **فحص الطيران السنوي** - 8 خطوات
8. **تجديد التعاقد** - 3 خطوات

---

## 🚀 التثبيت والتشغيل

### المتطلبات الأساسية

- Node.js 18+
- npm أو pnpm
- حساب Supabase
- حساب Vercel (للنشر)

### التثبيت المحلي

```bash
# استنساخ المستودع
git clone https://github.com/Bomussa/love.git
cd love

# تثبيت التبعيات
npm install

# إعداد متغيرات البيئة
cp .env.example .env
# قم بتعديل .env وإضافة مفاتيح Supabase

# تشغيل Frontend
cd frontend
npm run dev

# تشغيل API (في terminal منفصل)
cd api
npm run dev
```

### متغيرات البيئة المطلوبة

```bash
# Frontend (.env في مجلد frontend)
VITE_SUPABASE_URL=https://utgsoizsnqchiduzffxo.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_BASE_URL=https://www.mmc-mms.com/api/v1

# API (متغيرات Vercel)
SUPABASE_URL=https://utgsoizsnqchiduzffxo.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

⚠️ **مهم:** راجع ملف `VERCEL_ENV_CRITICAL_FIX.md` للحصول على المفاتيح الصحيحة والخطوات المطلوبة.

---

## 📁 هيكل المشروع

```
love/
├── frontend/                 # تطبيق React
│   ├── src/
│   │   ├── components/      # مكونات React
│   │   ├── lib/            # مكتبات مساعدة
│   │   ├── styles/         # ملفات CSS
│   │   └── main.jsx        # نقطة الدخول
│   ├── public/             # ملفات ثابتة
│   └── package.json
│
├── api/                     # Vercel Serverless Functions
│   ├── v1/
│   │   ├── patients/       # API endpoints للمرضى
│   │   ├── queue/          # API endpoints للطوابير
│   │   ├── health/         # Health checks
│   │   └── events/         # Server-Sent Events
│   └── _lib/               # مكتبات مشتركة
│
├── supabase/               # Supabase migrations
│   └── migrations/         # SQL migrations
│
├── docs/                   # التوثيق
│   ├── FIXES_APPLIED.md
│   ├── FIX_PLAN.md
│   ├── COMPLETE_INTEGRATION_REPORT.md
│   └── VERCEL_ENV_CRITICAL_FIX.md
│
├── tests/                  # الاختبارات
│   └── unit/
│
├── vercel.json            # إعدادات Vercel
├── package.json
└── README.md             # هذا الملف
```

---

## 🔧 API Endpoints

### Patient Management

```
POST /api/v1/patients/login
Body: { "patientId": "123456789", "gender": "male" }
Response: { "success": true, "data": {...}, "message": "..." }
```

### Queue Management

```
GET /api/v1/queue/status
Response: { "queues": [...], "stats": {...} }
```

### Health Check

```
GET /api/v1/health/status
Response: { "status": "ok", "timestamp": "..." }
```

### Real-time Events

```
GET /api/v1/events/stream
Response: text/event-stream
```

---

## 🎨 الثيمات المتاحة

1. **طبي احترافي** (Medical Professional) - الافتراضي
2. **الطبيعة الشافية** (Healing Nature)
3. **العافية الهادئة** (Calm Wellness)
4. **الرعاية الدافئة** (Warm Care)
5. **طبي حديث** (Modern Medical)
6. **الصحة الموثوقة** (Trusted Health)

---

## 🔐 الأمان

### Row Level Security (RLS)

جميع الجداول محمية بـ RLS policies:

- **patients:** قراءة/كتابة للمستخدمين المصادق عليهم
- **exam_types:** قراءة عامة، كتابة للإداريين فقط
- **queues:** قراءة عامة، كتابة محدودة
- **clinics:** قراءة عامة، كتابة للإداريين فقط

### CORS

CORS مفعل للنطاقات التالية:
- `https://www.mmc-mms.com`
- `https://mmc-mms.com`
- `http://localhost:3000` (للتطوير)
- `http://localhost:5173` (للتطوير)

---

## 📈 الأداء

### تحسينات الأداء

- ✅ **Indexes** على جميع الأعمدة المستخدمة في الاستعلامات
- ✅ **Connection Pooling** عبر Supabase
- ✅ **Edge Functions** عبر Vercel
- ✅ **CDN** للملفات الثابتة
- ✅ **Lazy Loading** للمكونات

### مقاييس الأداء

- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **Lighthouse Score:** 90+

---

## 🧪 الاختبارات

### تشغيل الاختبارات

```bash
# اختبارات الوحدة
npm test

# اختبار شامل للاتصال
node comprehensive-test.js

# اختبار Supabase endpoints
bash test-all-endpoints.sh
```

### نتائج الاختبارات الأخيرة (6 نوفمبر 2025)

```
✅ exam_types: 8 سجلات
✅ clinics: 13 سجلات
✅ patients: يعمل
✅ queues: يعمل
✅ pathways: يعمل
✅ notifications: يعمل
```

---

## 🚀 النشر

### النشر على Vercel

```bash
# تسجيل الدخول إلى Vercel
vercel login

# نشر المشروع
vercel --prod
```

### إعداد النطاق المخصص

1. أضف النطاق في Vercel Dashboard
2. قم بتحديث DNS records
3. انتظر انتشار SSL certificate

---

## 🐛 المشاكل الشائعة وحلولها

### المشكلة: API يعيد خطأ 500

**الحل:** تحقق من متغيرات البيئة في Vercel. راجع `VERCEL_ENV_CRITICAL_FIX.md`.

### المشكلة: تسجيل الدخول لا يعمل

**الحل:** تأكد من أن RLS policies مفعلة على جدول `patients`.

### المشكلة: الإشعارات لا تعمل

**الحل:** تحقق من أن EventSource متصل بـ `/api/v1/events/stream`.

---

## 📝 التحديثات الأخيرة

### 6 نوفمبر 2025 - 03:25 صباحاً

#### ✅ الإصلاحات المطبقة

1. **إصلاح API endpoint لتسجيل دخول المرضى**
   - تصحيح عدم تطابق أسماء الأعمدة (`patient_id` → `id`)
   - الملف: `/api/v1/patients/login.ts`

2. **إنشاء جدول exam_types**
   - 8 أنواع فحوصات طبية مع مساراتها الكاملة
   - Row Level Security مفعل
   - Triggers للتحديث التلقائي
   - Indexes لتحسين الأداء

3. **اختبارات شاملة**
   - ✅ exam_types: 8 سجلات
   - ✅ clinics: 13 سجلات
   - ✅ patients: يعمل
   - ✅ queues: يعمل
   - ✅ pathways: يعمل
   - ✅ notifications: يعمل

#### ⚠️ الخطوة المتبقية

**تحديث متغيرات البيئة في Vercel:**
- المتغيرات الحالية تشير إلى مشروع Supabase قديم
- يجب تحديثها حسب الدليل في `VERCEL_ENV_CRITICAL_FIX.md`

---

## 🎯 الحالة الحالية

| المكون | الحالة | الملاحظات |
|--------|--------|-----------|
| Frontend | 🟢 يعمل 100% | منشور على Vercel |
| Supabase Database | 🟢 يعمل 100% | جميع الجداول موجودة |
| Supabase REST API | 🟢 يعمل 100% | يمكن الوصول مباشرة |
| Vercel API Functions | 🟡 يحتاج تحديث | متغيرات البيئة خاطئة |
| تسجيل الدخول | 🟡 يحتاج تحديث | بسبب API Functions |

**الخطوة التالية:** تحديث متغيرات البيئة في Vercel حسب `VERCEL_ENV_CRITICAL_FIX.md`

---

## 👥 المساهمون

- **Bomussa** - المطور الرئيسي
- **Manus AI** - المساعد في التطوير والتوثيق

---

## 📄 الترخيص

هذا المشروع ملك خاص للقوات المسلحة. جميع الحقوق محفوظة.

---

## 🔗 روابط مهمة

- **الموقع المباشر:** https://www.mmc-mms.com
- **GitHub Repository:** https://github.com/Bomussa/love
- **Vercel Dashboard:** https://vercel.com/bomussa/love
- **Supabase Dashboard:** https://supabase.com/dashboard/project/utgsoizsnqchiduzffxo

---

## 📞 الدعم

للدعم الفني أو الاستفسارات:
- **Email:** Bomussa@gmail.com
- **GitHub Issues:** https://github.com/Bomussa/love/issues

---

**تم التحديث:** 6 نوفمبر 2025 - 03:25 صباحاً (GMT+3)

