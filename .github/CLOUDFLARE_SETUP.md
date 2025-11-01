# 🔐 إعداد GitHub Secrets للنشر التلقائي إلى Cloudflare

## المتطلبات

لتفعيل النشر التلقائي من GitHub إلى Cloudflare Pages، تحتاج إلى إضافة البيانات التالية كـ **GitHub Secrets**:

### 1️⃣ CLOUDFLARE_API_TOKEN

**كيفية الحصول عليه:**

1. افتح [Cloudflare Dashboard](https://dash.cloudflare.com)
2. اذهب إلى **My Profile** → **API Tokens**
3. انقر على **Create Token**
4. اختر قالب **Edit Cloudflare Workers**
5. أو أنشئ Custom Token مع الصلاحيات التالية:
   - `Account.Cloudflare Pages` → **Edit**
   - `Account.Account Settings` → **Read**
6. انسخ الـ Token

**إضافته إلى GitHub:**

1. اذهب إلى مستودع GitHub: `https://github.com/Bomussa/2027`
2. انقر على **Settings** → **Secrets and variables** → **Actions**
3. انقر على **New repository secret**
4. الاسم: `CLOUDFLARE_API_TOKEN`
5. القيمة: الصق الـ Token
6. انقر **Add secret**

---

### 2️⃣ CLOUDFLARE_ACCOUNT_ID

**كيفية الحصول عليه:**

1. افتح [Cloudflare Dashboard](https://dash.cloudflare.com)
2. من الصفحة الرئيسية، ستجد **Account ID** في الشريط الجانبي
3. أو اذهب إلى أي موقع → في الشريط الجانبي الأيمن ستجد **Account ID**
4. انسخ الـ Account ID (يكون على شكل: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

**إضافته إلى GitHub:**

1. اذهب إلى **Settings** → **Secrets and variables** → **Actions**
2. انقر على **New repository secret**
3. الاسم: `CLOUDFLARE_ACCOUNT_ID`
4. القيمة: الصق الـ Account ID
5. انقر **Add secret**

---

## ✅ التحقق من الإعداد

بعد إضافة الـ Secrets:

1. قم بعمل **Push** لأي تعديل إلى branch `main`
2. اذهب إلى تبويب **Actions** في GitHub
3. ستجد workflow بعنوان **🚀 Deploy to Cloudflare Pages** يعمل تلقائياً
4. انتظر حتى ينتهي (عادة 2-3 دقائق)
5. تحقق من الموقع: https://mmc-mms.com

---

## 🔄 سير العمل الجديد

من الآن فصاعداً:

✅ **كل التعديلات تتم على GitHub فقط**
✅ **النشر يتم تلقائياً عند كل Push إلى main**
✅ **لا حاجة لفتح Cloudflare Dashboard أبداً**

### عند إضافة ميزة جديدة:

```bash
# 1. عدّل الملفات محلياً
git add .
git commit -m "إضافة ميزة جديدة"
git push origin main

# 2. GitHub Actions سينشر تلقائياً إلى Cloudflare
# 3. تحقق من النتيجة على https://mmc-mms.com
```

---

## 🚨 ملاحظات مهمة

- ⚠️ **لا تعدّل الملفات مباشرة في Cloudflare Dashboard** - أي تعديل سيُستبدل بالنسخة من GitHub
- ✅ **GitHub هو المصدر الوحيد للحقيقة** - كل التعديلات يجب أن تكون هنا
- 🔒 **الـ Secrets آمنة** - GitHub يخفيها في السجلات ولا يمكن قراءتها

---

## 📊 مراقبة النشر

لمراقبة حالة النشر:

1. اذهب إلى تبويب **Actions** في GitHub
2. انقر على آخر workflow run
3. ستجد تفاصيل كل خطوة من خطوات النشر
4. في حالة الفشل، ستجد رسالة الخطأ واضحة

---

## 🆘 المساعدة

إذا واجهت مشكلة:

1. تحقق من أن الـ Secrets مضافة بشكل صحيح
2. تحقق من صلاحيات الـ API Token
3. راجع سجلات الـ Actions في GitHub
4. تأكد من أن اسم المشروع في Cloudflare هو `mmc-mms`

