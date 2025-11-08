# خطة إعادة هيكلة المشروع

## الهيكل الحالي (مشاكل)

```
❌ تكرار: api/ و src/api/
❌ تكرار: archive/ و _ARCHIVED/
❌ تكرار: frontend/config/ و config/
❌ مجلدات غير واضحة: ops/, diagnostics/, js/, img/
❌ backend/ فارغ أو غير مستخدم
```

## الهيكل الجديد المقترح

```
love/
├── .archive/                 # الأرشيف (موجود)
│   ├── tests/
│   ├── temp/
│   ├── old_configs/
│   └── backups/
│
├── frontend/                 # التطبيق الأمامي (Vite + React)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── api/            # API clients
│   │   └── assets/
│   ├── public/
│   ├── config/
│   ├── theme/
│   ├── plugins/
│   ├── package.json
│   └── vite.config.js
│
├── api/                      # Serverless API (Vercel Functions)
│   ├── v1/                  # API v1 endpoints
│   ├── lib/                 # مكتبات مشتركة
│   ├── _shared/             # موارد مشتركة
│   └── README.md
│
├── supabase/                 # Supabase configuration
│   ├── migrations/          # Database migrations
│   ├── functions/           # Edge Functions
│   └── config.toml
│
├── scripts/                  # سكربتات الصيانة والنشر
│   ├── deploy/
│   ├── db/
│   ├── test/
│   └── utils/
│
├── config/                   # إعدادات المشروع
│   ├── vercel-environment-variables.md
│   ├── vercel-build-settings.md
│   ├── supabase-tables-list.md
│   └── deployment.md
│
├── docs/                     # التوثيق الشامل
│   ├── README.md            # نظرة عامة
│   ├── ARCHITECTURE.md      # معمارية النظام
│   ├── API.md               # توثيق API
│   ├── DATABASE.md          # توثيق قاعدة البيانات
│   ├── DEPLOYMENT.md        # دليل النشر
│   ├── MAINTENANCE.md       # دليل الصيانة
│   └── USER_GUIDE.md        # دليل المستخدم
│
├── tests/                    # اختبارات المشروع
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example              # مثال لملف البيئة
├── .env.local                # بيئة التطوير (git-ignored)
├── .env.production           # بيئة الإنتاج (git-ignored)
├── .gitignore
├── package.json              # Root package.json
├── vercel.json               # إعدادات Vercel
├── README.md                 # الملف الرئيسي
├── SECURITY.md
└── LICENSE
```

## خطوات التنفيذ

### 1. دمج المجلدات المكررة
- ✅ دمج `archive/` و `_ARCHIVED/` → `.archive/`
- ✅ دمج `src/api/` → `api/`
- ✅ نقل `img/` و `js/` → `frontend/src/assets/`
- ✅ دمج `config/` → `config/` (واحد فقط)

### 2. إنشاء مجلد التوثيق
- ✅ إنشاء `docs/`
- ✅ نقل جميع ملفات MD المهمة إلى `docs/`
- ✅ إنشاء توثيق جديد شامل

### 3. تنظيم السكربتات
- ✅ تنظيف `scripts/`
- ✅ تصنيف السكربتات حسب الوظيفة

### 4. تنظيف الجذر
- ✅ إبقاء الملفات الأساسية فقط
- ✅ نقل الباقي إلى المجلدات المناسبة

## الملفات في الجذر (نهائي)

```
love/
├── .env.example
├── .env.local (git-ignored)
├── .env.production (git-ignored)
├── .gitignore
├── package.json
├── package-lock.json
├── vercel.json
├── babel.config.js
├── jest.config.js
├── README.md
├── SECURITY.md
└── LICENSE
```

## الفوائد

1. ✅ **وضوح:** كل شيء في مكانه الصحيح
2. ✅ **لا تكرار:** مجلد واحد لكل غرض
3. ✅ **سهولة الصيانة:** بنية منطقية
4. ✅ **توثيق شامل:** كل شيء موثق
5. ✅ **جاهز للنشر:** بضغطة زر واحدة

---

**تاريخ الإنشاء:** 08 نوفمبر 2025
