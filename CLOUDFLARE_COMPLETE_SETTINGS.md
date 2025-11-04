# إعدادات Cloudflare الكاملة - مشروع 2027

**تاريخ النسخ الاحتياطي**: 2025-10-22  
**Account ID**: `f8c5e563eb7dc2635afc2f6b73fa4eb9`  
**Project Name**: `2027`  
**Git Repository**: `Bomussa/2027`

---

## 1. Build Settings

### Git Repository
- **Repository**: `Bomussa/2027`
- **Production Branch**: `main`
- **Automatic Deployments**: ✅ Enabled

### Build Configuration
```yaml
Build command: npm run build
Build output: dist
Root directory: (empty - root)
Build comments: Enabled
```

### Build Cache
- **Status**: ❌ Disabled (Beta feature)
- **ملاحظة**: يمكن تفعيله لتسريع البناء

### Branch Control
- **Production branch**: `main`
- **Automatic deployments**: ✅ Enabled

### Build Watch Paths
- **Include paths**: `*` (جميع الملفات)

### Build System Version
- **Version**: `3` (أحدث إصدار)

### Deploy Hooks
- **Status**: ❌ No deploy hooks defined
- **ملاحظة**: يمكن إضافة webhooks للنشر اليدوي

---

## 2. Variables and Secrets

### Environment Variables (Production)

| Type | Name | Value | ملاحظات |
|------|------|-------|---------|
| Plaintext | `JWT_SECRET` | `ff8d89d5d4c3df96e47...` | 🔒 سري - للمصادقة |
| Plaintext | `NOTIFY_KEY` | `https://notify.mmc-m...` | 🔔 مفتاح الإشعارات |
| Plaintext | `PIN_SECRET` | `6a1f1a07787035f332...` | 🔒 سري - للـ PIN |
| Plaintext | `TIMEZONE` | `Asia/Qatar` | 🌍 المنطقة الزمنية |

**⚠️ ملاحظة هامة**: 
- هذه المتغيرات **يجب** إضافتها كـ GitHub Secrets
- لا يجب كتابة القيم الفعلية في الكود
- يتم حقنها تلقائياً أثناء البناء

---

## 3. Bindings (KV Namespaces)

### KV Namespaces المربوطة

| Binding Name | KV Namespace ID | الغرض |
|--------------|-----------------|-------|
| `KV_ADMIN` | `KV_ADMIN` | 👤 بيانات المسؤولين |
| `MMS_CACHE` | `MMS_CACHE` | 💾 التخزين المؤقت |
| `KV_EVENTS` | `KV_EVENTS` | 📡 الأحداث والإشعارات |
| `KV_LOCKS` | `KV_LOCKS` | 🔒 الأقفال للتزامن |
| `KV_PINS` | `KV_PINS` | 📌 أكواد PIN |
| `KV_QUEUES` | `KV_QUEUES` | 📋 قوائم الانتظار |

**✅ ملاحظة**: 
- جميع الـ Bindings مُدارة من خلال `wrangler.toml`
- يجب التأكد من تطابقها مع ملف wrangler.toml في المستودع

---

## 4. Runtime Settings

### Placement
- **Type**: `Default`
- **Description**: النشر على شبكة Cloudflare العالمية

### Compatibility Settings
```yaml
Compatibility date: 2025-10-18
Compatibility flags: (none)
Fail open/closed: Fail open
```

**ملاحظات**:
- تاريخ التوافق محدث (Oct 18, 2025)
- لا توجد flags إضافية
- Fail open: يسمح بالطلبات حتى في حالة الفشل

---

## 5. Custom Domains

### Production Domains
1. **Primary**: `2027-5a0.pages.dev` (Cloudflare Pages)
2. **Custom**: `www.mmc-mms.com` ✅ Active

**DNS Settings Required**:
```
Type: CNAME
Name: www
Target: 2027-5a0.pages.dev
Proxy: ✅ Proxied (Orange cloud)
```

---

## 6. General Settings

### Project Name
- **Name**: `2027`

### Notifications
- **Status**: ❌ Not configured
- **توصية**: إضافة إشعارات للنشر الفاشل

### Access Policy
- **Status**: ❌ Disabled
- **Description**: التحكم في الوصول إلى preview deployments
- **توصية**: تفعيل Cloudflare Access للحماية

---

## 7. الإعدادات المطلوبة في GitHub

### GitHub Secrets المطلوبة

يجب إضافة هذه الـ Secrets في GitHub Repository:

```bash
# Cloudflare API Token
CLOUDFLARE_API_TOKEN=<your_api_token>

# Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=f8c5e563eb7dc2635afc2f6b73fa4eb9

# Environment Variables
JWT_SECRET=ff8d89d5d4c3df96e47...
NOTIFY_KEY=https://notify.mmc-m...
PIN_SECRET=6a1f1a07787035f332...
TIMEZONE=Asia/Qatar
```

### كيفية إضافة Secrets في GitHub

1. اذهب إلى: `Settings` → `Secrets and variables` → `Actions`
2. اضغط على `New repository secret`
3. أضف كل secret على حدة

---

## 8. ملف wrangler.toml المطلوب

يجب أن يحتوي ملف `wrangler.toml` على:

```toml
name = "2027"
compatibility_date = "2025-10-18"
pages_build_output_dir = "dist"

[[kv_namespaces]]
binding = "KV_ADMIN"
id = "<KV_ADMIN_ID>"

[[kv_namespaces]]
binding = "MMS_CACHE"
id = "<MMS_CACHE_ID>"

[[kv_namespaces]]
binding = "KV_EVENTS"
id = "<KV_EVENTS_ID>"

[[kv_namespaces]]
binding = "KV_LOCKS"
id = "<KV_LOCKS_ID>"

[[kv_namespaces]]
binding = "KV_PINS"
id = "<KV_PINS_ID>"

[[kv_namespaces]]
binding = "KV_QUEUES"
id = "<KV_QUEUES_ID>"

[build]
command = "npm run build"

[build.upload]
format = "modules"
```

---

## 9. GitHub Actions Workflow المطلوب

ملف `.github/workflows/deploy-cloudflare.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          NOTIFY_KEY: ${{ secrets.NOTIFY_KEY }}
          PIN_SECRET: ${{ secrets.PIN_SECRET }}
          TIMEZONE: ${{ secrets.TIMEZONE }}
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: 2027
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

---

## 10. قائمة التحقق النهائية

### ✅ الإعدادات المكتملة

- [x] Build Settings صحيحة
- [x] KV Namespaces مربوطة (6 namespaces)
- [x] Environment Variables محددة (4 variables)
- [x] Custom Domain مفعّل (www.mmc-mms.com)
- [x] Automatic Deployments مفعّلة
- [x] Runtime Settings محدثة

### ⚠️ الإعدادات المقترحة للتحسين

- [ ] تفعيل Build Cache لتسريع البناء
- [ ] إضافة Notifications للنشر
- [ ] تفعيل Access Policy للحماية
- [ ] إضافة Deploy Hooks إذا لزم الأمر

### 🔧 الخطوات التالية

1. **التحقق من wrangler.toml**: مقارنة الإعدادات مع الملف الموجود
2. **إضافة GitHub Secrets**: نسخ جميع المتغيرات السرية
3. **إنشاء GitHub Action**: إضافة workflow للنشر التلقائي
4. **اختبار النشر**: عمل commit ومراقبة النشر التلقائي
5. **التحقق من الموقع**: زيارة www.mmc-mms.com للتأكد

---

## 11. ملاحظات أمنية مهمة

⚠️ **لا تقم أبداً بـ**:
- كتابة Secrets في الكود
- رفع ملفات `.env` إلى GitHub
- مشاركة API Tokens علناً

✅ **قم دائماً بـ**:
- استخدام GitHub Secrets للبيانات الحساسة
- تحديث API Tokens بشكل دوري
- مراجعة Access Logs في Cloudflare

---

**آخر تحديث**: 2025-10-22  
**الحالة**: ✅ جميع الإعدادات موثقة ومحفوظة




---

## 12. DNS Records الحالية

### DNS Setup
- **Type**: Full (Cloudflare هو DNS الأساسي)
- **Nameservers**: 
  - `ara.ns.cloudflare.com`
  - `paul.ns.cloudflare.com`

### DNS Records

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | mmc-mms.com | 192.0.2.1 | ✅ Proxied | Auto |
| CNAME | www | 2027-5a0.pages.dev | ✅ Proxied | Auto |

### ملاحظات DNS

1. **النطاق الرئيسي** (`mmc-mms.com`):
   - يشير إلى IP: `192.0.2.1` (IP احتياطي)
   - **الحالة**: 🟡 Verifying (جاري التحقق)
   - **سيتم تفعيله تلقائياً** خلال 24 ساعة

2. **النطاق الفرعي** (`www.mmc-mms.com`):
   - يشير إلى: `2027-5a0.pages.dev`
   - **الحالة**: ✅ Active
   - يعمل بشكل صحيح

3. **Proxy Status**:
   - جميع السجلات **Proxied** (البرتقالي)
   - يعني أن Cloudflare يحمي ويسرع الموقع

### توصيات DNS

⚠️ **مطلوب**: إضافة MX records للبريد الإلكتروني
- يجب إضافة سجلات MX إذا كنت تستخدم `@mmc-mms.com` للبريد

✅ **اختياري**: إضافة سجلات SPF, DKIM, DMARC
- لمنع انتحال البريد الإلكتروني

---

## 13. الحالة النهائية للإعدادات

### ✅ الإعدادات المكتملة والنشطة

- [x] **Build Settings**: صحيحة ومحدثة
- [x] **KV Namespaces**: 6 namespaces مربوطة
- [x] **Environment Variables**: 4 متغيرات معرّفة
- [x] **Custom Domain (www)**: ✅ نشط ويعمل
- [x] **DNS Records**: محدثة وصحيحة
- [x] **Automatic Deployments**: مفعّلة
- [x] **Runtime Settings**: محدثة (Oct 18, 2025)
- [x] **Proxy Status**: مفعّل على جميع السجلات

### 🟡 الإعدادات قيد التحقق

- [ ] **Custom Domain (root)**: `mmc-mms.com` - جاري التحقق (سيتم تفعيله خلال 24 ساعة)

### ⚠️ الإعدادات الاختيارية المقترحة

- [ ] **Build Cache**: معطّل (يمكن تفعيله لتسريع البناء)
- [ ] **Notifications**: غير مفعّلة (يُنصح بإضافتها)
- [ ] **Access Policy**: معطّل (للحماية الإضافية)
- [ ] **MX Records**: غير موجودة (مطلوبة للبريد الإلكتروني)

---

## 14. الخطوات النهائية المتبقية

### 1. إعداد GitHub Actions ✅
- إنشاء ملف `.github/workflows/deploy-cloudflare.yml`
- إضافة workflow للنشر التلقائي

### 2. إضافة GitHub Secrets ⚠️
يجب إضافة هذه الـ Secrets في GitHub:

```bash
CLOUDFLARE_API_TOKEN=<your_token>
CLOUDFLARE_ACCOUNT_ID=f8c5e563eb7dc2635afc2f6b73fa4eb9
JWT_SECRET=<from_cloudflare>
NOTIFY_KEY=<from_cloudflare>
PIN_SECRET=<from_cloudflare>
TIMEZONE=Asia/Qatar
```

### 3. اختبار النشر التلقائي ✅
- عمل commit جديد
- مراقبة GitHub Actions
- التحقق من النشر على Cloudflare

### 4. التحقق النهائي ✅
- زيارة `www.mmc-mms.com`
- التأكد من عمل جميع الوظائف
- فحص KV Namespaces

---

**آخر تحديث**: 2025-10-22 09:25 GMT+3  
**الحالة الإجمالية**: ✅ 95% مكتمل - جاهز للنشر التلقائي

