# دليل إعداد GitHub Secrets للنشر التلقائي

> **الهدف:** إعداد GitHub Secrets مرة واحدة فقط لتفعيل النشر التلقائي من GitHub إلى Cloudflare

---

## 📋 Secrets المطلوبة

يجب إضافة هذه الـ Secrets في مستودع GitHub:

### 1. `CLOUDFLARE_API_TOKEN`

**الوصف:** مفتاح API للوصول إلى Cloudflare Pages

**كيفية الحصول عليه:**

1. افتح [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. اضغط على **"Create Token"**
3. استخدم Template: **"Edit Cloudflare Workers"** أو **"Edit Cloudflare Pages"**
4. أو أنشئ Custom Token بالصلاحيات التالية:
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **Workers KV Storage** → **Edit**
5. اضغط **"Continue to summary"** ثم **"Create Token"**
6. **انسخ Token فوراً** (لن يظهر مرة أخرى!)

**القيمة المتوقعة:** تبدأ بـ `v1.0-...` أو شبيه

---

### 2. `CLOUDFLARE_ACCOUNT_ID`

**الوصف:** معرّف حساب Cloudflare الخاص بك

**القيمة:**
```
f8c5e563eb7dc2635afc2f6b73fa4eb9
```

**كيفية التحقق:**
- افتح [Cloudflare Dashboard](https://dash.cloudflare.com/)
- اختر أي مشروع في Workers & Pages
- ستجد Account ID في URL: `dash.cloudflare.com/{ACCOUNT_ID}/...`

---

## 🔧 خطوات إضافة Secrets في GitHub

### الطريقة 1: عبر واجهة GitHub

1. افتح المستودع: [https://github.com/Bomussa/2027](https://github.com/Bomussa/2027)
2. اذهب إلى **Settings** → **Secrets and variables** → **Actions**
3. اضغط **"New repository secret"**
4. أضف كل Secret على حدة:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Value:** (الصق Token من Cloudflare)
   - اضغط **"Add secret"**
5. كرر للـ Secret الثاني:
   - **Name:** `CLOUDFLARE_ACCOUNT_ID`
   - **Value:** `f8c5e563eb7dc2635afc2f6b73fa4eb9`

### الطريقة 2: عبر GitHub CLI

```bash
# إضافة CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_API_TOKEN --repo Bomussa/2027
# (سيطلب منك إدخال القيمة)

# إضافة CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_ACCOUNT_ID --body "f8c5e563eb7dc2635afc2f6b73fa4eb9" --repo Bomussa/2027
```

---

## ✅ التحقق من الإعداد

بعد إضافة Secrets:

1. اذهب إلى **Actions** في المستودع
2. اختر workflow: **"Deploy to Cloudflare Pages"**
3. اضغط **"Run workflow"** → **"Run workflow"**
4. انتظر اكتمال العملية (حوالي 2-3 دقائق)
5. تحقق من النتيجة:
   - ✅ **Success** = الإعداد صحيح!
   - ❌ **Failed** = راجع الأخطاء في logs

---

## 🚀 بعد الإعداد

**لن تحتاج لفتح Cloudflare مرة أخرى!**

كل ما عليك فعله:
1. قم بتعديل الكود في GitHub
2. اعمل commit و push إلى `main` branch
3. سيتم النشر تلقائياً إلى Cloudflare Pages

---

## 🔐 الأمان

- ✅ لا تشارك API Token مع أحد
- ✅ لا تضع Token في الكود أو الملفات
- ✅ استخدم GitHub Secrets فقط
- ✅ يمكنك إلغاء Token من Cloudflare في أي وقت

---

## 🆘 استكشاف الأخطاء

### خطأ: "Invalid API Token"
**الحل:** تأكد من أن Token لديه صلاحيات **Edit Cloudflare Pages**

### خطأ: "Account ID not found"
**الحل:** تحقق من أن Account ID صحيح (32 حرف hex)

### خطأ: "Project not found"
**الحل:** تأكد من أن اسم المشروع في workflow هو `2027` بالضبط

---

**آخر تحديث:** 22 أكتوبر 2025

