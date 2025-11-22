# إعداد المتغيرات البيئية في Vercel
## Vercel Environment Variables Setup

**التاريخ**: 2025-11-22  
**المشروع**: love (mmc-mms.com)

---

## 🔴 المشكلة الحالية

عند اختبار تسجيل دخول المراجع على https://mmc-mms.com، ظهر خطأ:
```
401 Unauthorized - Invalid JWT
```

**السبب**: المتغيرات البيئية المطلوبة غير موجودة أو غير صحيحة في Vercel.

---

## ✅ الحل: إضافة المتغيرات البيئية التالية

يجب إضافة المتغيرات التالية في **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

### 1. VITE_SUPABASE_URL
```
https://rujwuruuosffcxazymit.supabase.co
```
- **البيئات**: Production, Preview, Development
- **الوصف**: رابط مشروع Supabase

### 2. VITE_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1OTI0NDMsImV4cCI6MjA0NzE2ODQ0M30.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10
```
- **البيئات**: Production, Preview, Development
- **الوصف**: مفتاح Supabase العام (Anon Key)

### 3. SUPABASE_SERVICE_ROLE_KEY (اختياري - للعمليات الإدارية فقط)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTU5MjQ0MywiZXhwIjoyMDQ3MTY4NDQzfQ.5PWwdcBXgS1FZhwRonSRgdbnUQuXHI5VeIHvr41yUbs
```
- **البيئات**: Production فقط
- **الوصف**: مفتاح الخدمة (استخدام حذر)

---

## 📝 خطوات الإضافة

### الطريقة 1: عبر Vercel Dashboard (موصى بها)

1. افتح https://vercel.com/bomussa/love/settings/environment-variables
2. اضغط "Add New"
3. أدخل:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://rujwuruuosffcxazymit.supabase.co`
   - **Environments**: حدد Production, Preview, Development
4. اضغط "Save"
5. كرر للمتغير الثاني `VITE_SUPABASE_ANON_KEY`

### الطريقة 2: عبر Vercel CLI

```bash
# تسجيل الدخول
vercel login

# إضافة المتغيرات
vercel env add VITE_SUPABASE_URL production
# الصق القيمة: https://rujwuruuosffcxazymit.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# الصق المفتاح

# تطبيق على جميع البيئات
vercel env pull
```

---

## 🔄 إعادة النشر بعد الإضافة

بعد إضافة المتغيرات، يجب إعادة نشر التطبيق:

```bash
# الطريقة 1: عبر Git Push (تلقائي)
git commit --allow-empty -m "trigger: redeploy with env vars"
git push origin main

# الطريقة 2: عبر Vercel Dashboard
# اذهب إلى Deployments → اختر آخر deployment → "Redeploy"
```

---

## ✅ التحقق من النجاح

بعد إعادة النشر:

1. افتح https://mmc-mms.com
2. افتح Console (F12)
3. يجب أن ترى:
   ```
   🔧 API Mode: SUPABASE
   ✅ Supabase connection successful
   ```
4. جرب تسجيل دخول مراجع:
   - أدخل رقم: 12345
   - اختر جنس: ذكر
   - اضغط "تأكيد"
   - يجب أن ترى: "تم تسجيل الدخول بنجاح"

---

## 🐛 حل المشاكل

### المشكلة: "Missing Supabase environment variables"

**الحل**:
```bash
# تحقق من وجود المتغيرات
vercel env ls

# إذا لم تكن موجودة، أضفها كما في الخطوات أعلاه
```

### المشكلة: "401 Unauthorized - Invalid JWT"

**الأسباب المحتملة**:
1. المفتاح `VITE_SUPABASE_ANON_KEY` غير صحيح
2. المفتاح منتهي الصلاحية
3. المتغير غير موجود في البيئة الصحيحة

**الحل**:
1. تحقق من المفتاح في Supabase Dashboard:
   - افتح https://supabase.com/dashboard/project/rujwuruuosffcxazymit/settings/api
   - انسخ "anon public" key
   - حدّث القيمة في Vercel

### المشكلة: التطبيق لا يقرأ المتغيرات

**الحل**:
1. تأكد أن المتغيرات تبدأ بـ `VITE_` (لـ Vite)
2. أعد بناء التطبيق بعد إضافة المتغيرات
3. تحقق من `vite.config.js` أنه يقرأ المتغيرات بشكل صحيح

---

## 📚 مراجع

- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)

---

**✅ بعد تطبيق هذه الخطوات، يجب أن يعمل تسجيل دخول المراجع بنجاح على mmc-mms.com**
