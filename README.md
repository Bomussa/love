# 🏥 نظام إدارة المركز الطبي التخصصي العسكري (MMC-MMS)

<div dir="rtl">

## 📋 نظرة عامة

نظام متكامل لإدارة العيادات وطوابير المرضى في المركز الطبي التخصصي العسكري. يوفر النظام واجهة سهلة الاستخدام لإدارة المواعيد، تتبع المرضى، وإدارة سير العمل في العيادات المختلفة.

## ✨ المميزات الرئيسية

### 🏥 إدارة العيادات
- ✅ إدارة متعددة للعيادات
- ✅ نظام طوابير ذكي
- ✅ تتبع حالة المرضى في الوقت الفعلي
- ✅ إدارة المسارات الطبية

### 👥 إدارة المرضى
- ✅ تسجيل المرضى السريع
- ✅ تتبع التاريخ الطبي
- ✅ نظام الباركود
- ✅ إشعارات تلقائية

### 📊 التقارير والتحليلات
- ✅ تقارير يومية وشهرية
- ✅ إحصائيات الأداء
- ✅ رسوم بيانية تفاعلية
- ✅ تصدير البيانات

### 🔐 الأمان والصلاحيات
- ✅ مصادقة متعددة المستويات
- ✅ Row Level Security (RLS)
- ✅ تشفير البيانات
- ✅ سجلات التدقيق

## 🏗️ المعمارية التقنية

### Frontend
- **Framework:** Vite + React
- **UI Library:** Custom Components
- **State Management:** React Hooks
- **Styling:** CSS Modules + Tailwind

### Backend
- **Platform:** Vercel Serverless Functions
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **API:** RESTful + Edge Functions

### Infrastructure
- **Hosting:** Vercel
- **Database:** Supabase Cloud
- **CDN:** Vercel Edge Network
- **Monitoring:** Vercel Analytics

## 📁 هيكل المشروع

```
love/
├── frontend/          # التطبيق الأمامي (Vite + React)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── api/
│   ├── public/
│   └── config/
│
├── api/               # Serverless API (Vercel Functions)
│   ├── v1/           # API v1 endpoints
│   ├── lib/          # مكتبات مشتركة
│   └── _shared/      # موارد مشتركة
│
├── supabase/          # Supabase configuration
│   ├── migrations/   # Database migrations
│   └── functions/    # Edge Functions
│
├── scripts/           # سكربتات الصيانة والنشر
│   ├── deploy/
│   ├── db/
│   └── test/
│
├── config/            # إعدادات المشروع
│   ├── vercel-environment-variables.md
│   ├── vercel-build-settings.md
│   └── supabase-tables-list.md
│
├── docs/              # التوثيق الشامل
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   └── MAINTENANCE.md
│
└── tests/             # الاختبارات
    ├── unit/
    ├── integration/
    └── e2e/
```

## 🚀 البدء السريع

### المتطلبات الأساسية

```bash
Node.js >= 18.0.0
npm >= 9.0.0
Git
```

### التثبيت

```bash
# 1. استنساخ المشروع
git clone https://github.com/Bomussa/love.git
cd love

# 2. تثبيت الاعتماديات
npm install
cd frontend && npm install

# 3. إعداد متغيرات البيئة
cp .env.example .env.local
# عدّل .env.local بالقيم الصحيحة

# 4. تشغيل التطوير
npm run dev
```

### متغيرات البيئة المطلوبة

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vite
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_USE_SUPABASE=true
VITE_API_BASE_URL=http://localhost:3000

# API
API_ORIGIN=http://localhost:3000
```

## 📦 النشر

### النشر على Vercel

```bash
# 1. تسجيل الدخول إلى Vercel
vercel login

# 2. ربط المشروع
vercel link

# 3. إضافة متغيرات البيئة
vercel env pull

# 4. النشر
vercel --prod
```

### النشر التلقائي

المشروع مُعد للنشر التلقائي عند:
- ✅ Push إلى `main` branch → Production
- ✅ Push إلى أي branch آخر → Preview

## 🧪 الاختبار

```bash
# اختبارات الوحدة
npm run test

# اختبارات التكامل
npm run test:integration

# اختبارات E2E
npm run test:e2e

# تغطية الاختبارات
npm run test:coverage
```

## 📊 قاعدة البيانات

### الجداول الرئيسية

| الجدول | الوصف | السجلات |
|--------|-------|---------|
| `patients` | بيانات المرضى | ~10,000 |
| `clinics` | العيادات | ~20 |
| `queue` | طابور الانتظار | ~500/day |
| `admins` | المسؤولون | ~50 |
| `routes` | المسارات الطبية | ~15 |

### Migrations

```bash
# إنشاء migration جديد
npm run db:migration:new

# تطبيق migrations
npm run db:migrate

# التراجع عن migration
npm run db:rollback
```

## 🔧 الصيانة

### النسخ الاحتياطي

```bash
# نسخ احتياطي لقاعدة البيانات
npm run db:backup

# استعادة من نسخة احتياطية
npm run db:restore backup_file.sql
```

### المراقبة

- **Vercel Analytics:** https://vercel.com/bomussa/love/analytics
- **Supabase Dashboard:** https://supabase.com/dashboard/project/rujwuruuosffcxazymit
- **Logs:** `npm run logs`

## 📚 التوثيق

- [معمارية النظام](docs/ARCHITECTURE.md)
- [توثيق API](docs/API.md)
- [قاعدة البيانات](docs/DATABASE.md)
- [دليل النشر](docs/DEPLOYMENT.md)
- [دليل الصيانة](docs/MAINTENANCE.md)
- [دليل المستخدم](docs/USER_GUIDE.md)

## 🤝 المساهمة

نرحب بالمساهمات! يرجى قراءة [دليل المساهمة](CONTRIBUTING.md) قبل البدء.

## 📝 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE).

## 👥 الفريق

- **المطور الرئيسي:** Bomussa
- **البريد الإلكتروني:** bomussa@gmail.com
- **GitHub:** [@Bomussa](https://github.com/Bomussa)

## 🔗 روابط مهمة

- **الموقع:** https://love-bomussa.vercel.app
- **API Docs:** https://love-bomussa.vercel.app/api/docs
- **Supabase:** https://rujwuruuosffcxazymit.supabase.co
- **GitHub:** https://github.com/Bomussa/love

## 📞 الدعم

للحصول على الدعم:
- 📧 Email: bomussa@gmail.com
- 💬 GitHub Issues: [فتح issue](https://github.com/Bomussa/love/issues)
- 📖 Documentation: [docs/](docs/)

## 🎯 خارطة الطريق

### Q1 2025
- [ ] تطبيق الجوال (React Native)
- [ ] نظام الإشعارات المتقدم
- [ ] تكامل مع الأنظمة الخارجية

### Q2 2025
- [ ] تحليلات متقدمة بالذكاء الاصطناعي
- [ ] نظام الحجز الإلكتروني
- [ ] تطبيق للأطباء

---

**آخر تحديث:** 08 نوفمبر 2025  
**الإصدار:** 2.0.0  
**الحالة:** 🟢 Production Ready

</div>
