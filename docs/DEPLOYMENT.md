# 🚀 دليل النشر

## البنية الفعلية
- الواجهة الأمامية: `frontend/` وتُنشر على Vercel.
- الواجهة الخلفية: Supabase Edge Functions داخل `supabase/functions/`.
- لا توجد حزمة `api/` داخل هذا المستودع، وكل طلبات `/api/*` تمر عبر rewrite في `vercel.json` إلى Supabase.

## النشر على Vercel (Frontend)

### الخطوات

```bash
# 1. تسجيل الدخول
vercel login

# 2. ربط المشروع
vercel link

# 3. إضافة متغيرات البيئة
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 4. النشر
vercel --prod
```

## نشر وظائف Supabase (Backend)

```bash
# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref rujwuruuosffcxazymit

# نشر جميع الوظائف
./scripts/deploy-functions.sh
```

## متغيرات البيئة المطلوبة

انظر `config/vercel-environment-variables.md`

## التحقق من النشر

```bash
# فحص Rewrite + Edge Function
curl https://mmc-mms.com/api/api-v1-status

# فحص endpoint مباشر من وظائف Supabase
curl https://rujwuruuosffcxazymit.functions.supabase.co/api-v1-status
```

---
**آخر تحديث:** 09 مارس 2026
---
