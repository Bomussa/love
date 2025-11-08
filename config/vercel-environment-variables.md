# متغيرات البيئة في Vercel

**المشروع:** love  
**التاريخ:** 08 نوفمبر 2025  
**المصدر:** https://vercel.com/bomussa/love/settings/environment-variables

---

## قائمة المتغيرات الكاملة

### 1. متغيرات Supabase

| المتغير | البيئة | آخر تحديث | الوصف |
|---------|--------|-----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | All Environments | 14h ago | مفتاح Service Role للوصول الكامل |
| `SUPABASE_ANON_KEY` | All Environments | 2d ago | مفتاح Anon للوصول العام |
| `SUPABASE_URL` | All Environments | 2d ago | رابط Supabase API |
| `SUPABASE_JWT_SECRET` | Development | 2d ago | سر JWT للمصادقة |
| `VITE_SUPABASE_ANON_KEY` | All Environments | 21h ago | مفتاح Anon لـ Vite |
| `VITE_SUPABASE_URL` | All Environments | 2d ago | رابط Supabase لـ Vite |

### 2. متغيرات PostgreSQL

| المتغير | البيئة | آخر تحديث | الوصف |
|---------|--------|-----------|-------|
| `POSTGRES_URL` | Development | 2d ago | رابط قاعدة البيانات الكامل |
| `POSTGRES_PRISMA_URL` | Development | 2d ago | رابط Prisma |
| `POSTGRES_URL_NON_POOLING` | Development | 2d ago | رابط بدون Connection Pooling |
| `POSTGRES_USER` | All Environments | 2d ago | اسم المستخدم |
| `POSTGRES_HOST` | All Environments | 2d ago | عنوان الخادم |
| `POSTGRES_PASSWORD` | Development | 2d ago | كلمة المرور |
| `POSTGRES_DATABASE` | All Environments | 2d ago | اسم قاعدة البيانات |

### 3. متغيرات التطبيق

| المتغير | البيئة | آخر تحديث | الوصف |
|---------|--------|-----------|-------|
| `API_ORIGIN` | All Environments | 23h ago | أصل API |
| `DOMIN` | Development | 2d ago | الدومين |
| `VITE_USE_SUPABASE` | All Environments | 2d ago | تفعيل استخدام Supabase |
| `VITE_API_BASE_URL` | All Environments | Oct 31 | رابط API الأساسي |

---

## إحصائيات

- **إجمالي المتغيرات:** 17
- **متغيرات All Environments:** 11
- **متغيرات Development فقط:** 6
- **متغيرات Supabase:** 6
- **متغيرات PostgreSQL:** 7
- **متغيرات التطبيق:** 4

---

## ملاحظات مهمة

1. ✅ جميع المتغيرات الحساسة مخفية (Sensitive)
2. ✅ المتغيرات موزعة بشكل صحيح بين البيئات
3. ⚠️ بعض المتغيرات في Development فقط (POSTGRES_PASSWORD, SUPABASE_JWT_SECRET)
4. ✅ متغيرات Vite مُعدة بشكل صحيح (VITE_ prefix)

---

## القيم الفعلية (من .env.production)

**ملاحظة:** القيم الفعلية محفوظة في ملفات `.env.local` و `.env.production` في المشروع.

### Supabase:
```
SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
SUPABASE_ANON_KEY=[محفوظ في .env]
SUPABASE_SERVICE_ROLE_KEY=[محفوظ في .env]
```

### Vite:
```
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=[محفوظ في .env]
VITE_USE_SUPABASE=true
VITE_API_BASE_URL=https://love-bomussa.vercel.app
```

### API:
```
API_ORIGIN=https://love-bomussa.vercel.app
```

---

## كيفية إضافة متغير جديد

1. افتح Vercel Dashboard
2. اذهب إلى Settings → Environment Variables
3. اضغط "Create new"
4. أدخل الاسم والقيمة
5. اختر البيئة (Production, Development, Preview)
6. احفظ التغييرات
7. أعد Deploy المشروع

---

## كيفية تحديث متغير

1. ابحث عن المتغير في القائمة
2. اضغط على زر Menu (⋮)
3. اختر "Edit"
4. عدّل القيمة
5. احفظ التغييرات
6. أعد Deploy المشروع

---

**آخر تحديث:** 08 نوفمبر 2025
