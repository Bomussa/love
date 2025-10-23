# 🎯 دليل استخدام النشر التلقائي
## Auto Deploy Guide

**تاريخ:** 2025-10-16  
**المشروع:** 2027

---

## 🚀 النشر التلقائي بأمر واحد

تم إنشاء سكريبت `auto-deploy.ps1` الذي ينفذ كل شيء تلقائياً:

### ✅ ما يقوم به السكريبت:

1. **نسخة احتياطية تلقائية** 📦
   - يحفظ src في backups/auto-backup-{timestamp}
   
2. **التحقق من التغييرات** 🔍
   - يتأكد من وجود تغييرات للنشر
   
3. **بناء المشروع** 🏗️
   - `npm run build`
   
4. **اختبار محلي** 🧪
   - يشغل السيرفر ويختبره
   
5. **رفع إلى GitHub** 📤
   - `git add .`
   - `git commit -m "رسالتك"`
   - `git push origin main`
   
6. **نشر على Cloudflare** ☁️
   - `wrangler pages deploy dist --project-name=2027`
   
7. **اختبار الموقع المنشور** 🌐
   - يختبر https://2027-5a0.pages.dev
   - يختبر https://www.mmc-mms.com
   
8. **فتح الموقع للمراجعة** 🔗
   - يفتح الموقع في المتصفح تلقائياً
   
9. **تسجيل النشر** 📝
   - يحفظ معلومات النشر في logs/

---

## 📋 الاستخدام

### الأمر الأساسي:

```powershell
.\auto-deploy.ps1 -CommitMessage "وصف التعديلات"
```

### أمثلة:

```powershell
# مثال 1: إصلاح الكيو
.\auto-deploy.ps1 -CommitMessage "Fix: إصلاح منطق الكيو والـPIN"

# مثال 2: إضافة ميزة جديدة
.\auto-deploy.ps1 -CommitMessage "Feature: إضافة نظام التعديل العام"

# مثال 3: تحديث التصميم
.\auto-deploy.ps1 -CommitMessage "UI: تحسين واجهة الإدارة"

# مثال 4: بدون اختبارات محلية (أسرع)
.\auto-deploy.ps1 -CommitMessage "Hotfix: إصلاح سريع" -SkipTests
```

---

## 🔄 سير العمل الموصى به

### عند كل تعديل:

```powershell
# 1. عدّل الملفات في مشروع 2027
cd "C:\Users\USER\OneDrive\Desktop\تجميع من 3\2027"

# 2. اختبر محلياً (اختياري)
npm run dev

# 3. انشر بأمر واحد
.\auto-deploy.ps1 -CommitMessage "وصف ما فعلته"

# 4. الموقع سيفتح تلقائياً للمراجعة
```

### النتيجة:
- ✅ كود محفوظ في GitHub
- ✅ موقع محدّث على Cloudflare
- ✅ نسخة احتياطية آمنة
- ✅ سجل كامل للنشر

---

## 📊 الخرج المتوقع

```
═══════════════════════════════════════════════════
    🚀 بدء عملية النشر التلقائي
═══════════════════════════════════════════════════

1️⃣  إنشاء نسخة احتياطية...
   ✅ نسخة احتياطية في: backups/auto-backup-20251016-083000

2️⃣  التحقق من التغييرات...
   ✅ وجدت تغييرات:
   M src/pages/AdminDashboard.tsx
   M src/utils/applyGlobalUpdate.ts

3️⃣  بناء المشروع...
   ✅ البناء نجح

4️⃣  اختبار محلي...
   ✅ السيرفر يعمل بنجاح

5️⃣  رفع التغييرات إلى GitHub...
   ✅ تم رفع التغييرات إلى GitHub
   📌 Commit: a1b2c3d

6️⃣  نشر على Cloudflare Pages...
   ✅ تم النشر على Cloudflare Pages

7️⃣  اختبار الموقع المنشور...
   ✅ https://2027-5a0.pages.dev يعمل بنجاح
   ✅ https://www.mmc-mms.com يعمل بنجاح

8️⃣  فتح الموقع للمراجعة...

9️⃣  تسجيل النشر...
   ✅ تم تسجيل النشر

═══════════════════════════════════════════════════
    ✅ اكتمل النشر بنجاح!
═══════════════════════════════════════════════════

📊 ملخص النشر:
  • Commit: a1b2c3d
  • الرسالة: Fix: إصلاح منطق الكيو والـPIN
  • النسخة الاحتياطية: backups/auto-backup-20251016-083000
  • الموقع: https://2027-5a0.pages.dev

🌐 الروابط:
  • Production: https://2027-5a0.pages.dev
  • Custom Domain: https://www.mmc-mms.com
  • GitHub: https://github.com/Bomussa/2027/commit/a1b2c3d
```

---

## 🛠️ الخيارات المتقدمة

### تخطي الاختبارات المحلية:

```powershell
.\auto-deploy.ps1 -CommitMessage "تحديث سريع" -SkipTests
```

**متى تستخدمه:**
- تعديلات بسيطة في التصميم
- تحديثات نصية فقط
- عندما تريد نشر سريع

---

## 📁 هيكل الملفات الناتجة

```
2027/
├── backups/
│   ├── auto-backup-20251016-080000/
│   ├── auto-backup-20251016-083000/
│   └── auto-backup-20251016-090000/
├── logs/
│   ├── deployment-20251016-080000.json
│   ├── deployment-20251016-083000.json
│   └── deployment-20251016-090000.json
└── auto-deploy.ps1
```

---

## 🔍 فحص سجلات النشر

```powershell
# عرض آخر 5 نشرات
Get-ChildItem logs/*.json | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 5 | 
    ForEach-Object { Get-Content $_.FullName | ConvertFrom-Json }
```

---

## ⚠️ استكشاف الأخطاء

### إذا فشل البناء:
```powershell
# تحقق من الأخطاء
npm run build

# أصلح الأخطاء ثم أعد المحاولة
.\auto-deploy.ps1 -CommitMessage "إصلاح أخطاء البناء"
```

### إذا فشل Push:
```powershell
# تحقق من حالة Git
git status

# تأكد من صلاحية Token
git remote -v
```

### إذا فشل النشر على Cloudflare:
```powershell
# تسجيل دخول مرة أخرى
wrangler login

# أعد المحاولة
.\auto-deploy.ps1 -CommitMessage "إعادة النشر"
```

---

## 🎯 أفضل الممارسات

### 1. رسائل Commit واضحة:
```powershell
# ✅ جيد
.\auto-deploy.ps1 -CommitMessage "Fix: إصلاح bug في حساب الدور"

# ❌ سيء
.\auto-deploy.ps1 -CommitMessage "تعديلات"
```

### 2. اختبر قبل النشر:
```powershell
# اختبر محلياً أولاً
npm run dev

# ثم انشر
.\auto-deploy.ps1 -CommitMessage "..."
```

### 3. راجع النسخ الاحتياطية:
```powershell
# احتفظ بالنسخ لمدة أسبوع
Get-ChildItem backups/ | 
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } | 
    Remove-Item -Recurse
```

---

## 🚀 النشر الأول

لأول مرة، نفّذ:

```powershell
cd "C:\Users\USER\OneDrive\Desktop\تجميع من 3\2027"

# تأكد من تثبيت wrangler
npm install -g wrangler

# تسجيل دخول
wrangler login

# النشر الأول
.\auto-deploy.ps1 -CommitMessage "Initial deployment with auto-deploy script"
```

---

## ✅ الخلاصة

**مع هذا السكريبت:**
- ✅ لا حاجة لأوامر متعددة
- ✅ نشر آمن مع نسخ احتياطية
- ✅ اختبارات تلقائية
- ✅ سجل كامل لكل نشر
- ✅ فتح تلقائي للموقع

**أمر واحد = كل شيء!** 🎉

---

**الاستخدام اليومي:**

```powershell
# فقط عدّل الملفات ثم:
.\auto-deploy.ps1 -CommitMessage "وصف التعديل"

# وانتهى! ✅
```
