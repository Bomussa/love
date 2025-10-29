# دليل النشر - نظام اللجنة الطبية العسكرية

## 🚀 خطوات النشر السريع

### المتطلبات الأساسية
- ✅ Windows 10/11
- ✅ Node.js v22+ ([تحميل](https://nodejs.org))
- ✅ PostgreSQL 14+ ([تحميل](https://www.postgresql.org/download/windows/))
- ✅ Cloudflare Tunnel ([تحميل](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/))

---

## 📥 الخطوة 1: تحميل المشروع

```powershell
# فتح PowerShell
cd C:\Users\$env:USERNAME\Desktop

# استنساخ المشروع
git clone https://github.com/Bomussa/2026.git mms-2026

# الدخول إلى المجلد
cd mms-2026

# التبديل إلى الفرع الصحيح
git checkout feature/frontend-restoration-2026
```

---

## 🗄️ الخطوة 2: تهيئة قاعدة البيانات

### تثبيت PostgreSQL
1. قم بتحميل PostgreSQL من الرابط أعلاه
2. اتبع معالج التثبيت
3. احفظ كلمة مرور المستخدم `postgres`

### إنشاء قاعدة البيانات
```sql
-- افتح pgAdmin أو psql
-- أنشئ قاعدة البيانات
CREATE DATABASE medical_center;

-- أنشئ مستخدم للتطبيق
CREATE USER admin WITH PASSWORD 'password';

-- امنح الصلاحيات
GRANT ALL PRIVILEGES ON DATABASE medical_center TO admin;
```

---

## ⚙️ الخطوة 3: تثبيت التبعيات

```powershell
# تثبيت حزم npm
npm install

# بناء Backend
npm run build:backend

# بناء Frontend (اختياري)
npm run build:frontend
```

---

## 🔧 الخطوة 4: إعداد ملف .env

قم بإنشاء ملف `.env` في جذر المشروع:

```env
# Database Configuration
DATABASE_URL=postgresql://admin:password@localhost:5432/medical_center
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Security
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123456

# Cloudflare Tunnel
TUNNEL_NAME=mms-tunnel
DOMAIN=mmc-mms.com
```

⚠️ **مهم**: غير `ADMIN_PASSWORD` إلى كلمة مرور قوية!

---

## 🌐 الخطوة 5: إعداد Cloudflare Tunnel

### تسجيل الدخول
```powershell
cloudflared login
```
سيفتح المتصفح لتسجيل الدخول إلى Cloudflare

### إنشاء النفق
```powershell
cloudflared tunnel create mms-tunnel
```

### ربط النطاق
```powershell
cloudflared tunnel route dns mms-tunnel mmc-mms.com
```

### إنشاء ملف التكوين
أنشئ ملف `C:\Users\$env:USERNAME\.cloudflared\config.yml`:

```yaml
tunnel: mms-tunnel
credentials-file: C:\Users\YOUR_USERNAME\.cloudflared\TUNNEL_ID.json

ingress:
  - hostname: mmc-mms.com
    service: http://localhost:3000
  - hostname: www.mmc-mms.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## ▶️ الخطوة 6: تشغيل التطبيق

### الطريقة 1: يدوياً
```powershell
# تشغيل Backend
node dist\index.js

# في نافذة أخرى: تشغيل Cloudflare Tunnel
cloudflared tunnel run mms-tunnel
```

### الطريقة 2: باستخدام السكربت (موصى به)
```powershell
# تشغيل مباشر
.\start-mms.ps1

# أو بصلاحيات المسؤول
PowerShell -ExecutionPolicy Bypass -File .\start-mms.ps1
```

---

## 🔄 الخطوة 7: التشغيل التلقائي

### إضافة إلى Startup

1. اضغط `Win + R`
2. اكتب `shell:startup` واضغط Enter
3. انسخ اختصار `start-mms.ps1` إلى المجلد المفتوح

### إنشاء اختصار
1. انقر بزر الماوس الأيمن على `start-mms.ps1`
2. اختر "Create shortcut"
3. انقل الاختصار إلى مجلد Startup

---

## ✅ الخطوة 8: الاختبار

### اختبار محلي
افتح المتصفح وانتقل إلى:
```
http://localhost:3000
```

### اختبار خارجي
من هاتفك أو جهاز آخر:
```
https://mmc-mms.com
```

### اختبار لوحة الإدارة
```
http://localhost:3000?admin=true
```
- اسم المستخدم: `admin`
- كلمة المرور: `123456`

---

## 🛠️ استكشاف الأخطاء

### المشكلة: Backend لا يعمل
**الحل**:
```powershell
# تحقق من السجلات
type logs\backend-error.log

# تحقق من المنفذ 3000
netstat -ano | findstr :3000

# أوقف العملية القديمة
taskkill /PID [PID_NUMBER] /F
```

### المشكلة: قاعدة البيانات لا تتصل
**الحل**:
```powershell
# تحقق من خدمة PostgreSQL
Get-Service postgresql*

# شغل الخدمة
Start-Service postgresql-x64-14
```

### المشكلة: Cloudflare Tunnel لا يعمل
**الحل**:
```powershell
# تحقق من السجلات
type logs\tunnel-error.log

# أعد تشغيل النفق
cloudflared tunnel run mms-tunnel
```

---

## 📊 المراقبة والصيانة

### السجلات
```
logs\backend.log          - سجل Backend
logs\backend-error.log    - أخطاء Backend
logs\tunnel.log           - سجل Cloudflare Tunnel
logs\tunnel-error.log     - أخطاء Tunnel
```

### الحالة الصحية
```powershell
# تحقق من حالة API
curl http://localhost:3000/api/admin/stats
```

### النسخ الاحتياطي
```powershell
# نسخ احتياطي لقاعدة البيانات
pg_dump -U admin medical_center > backup_$(Get-Date -Format "yyyyMMdd").sql
```

---

## 🔒 الأمان

### تغيير كلمة مرور الإدارة
1. افتح ملف `.env`
2. غير `ADMIN_PASSWORD=123456` إلى كلمة مرور قوية
3. أعد تشغيل التطبيق

### تفعيل HTTPS
1. افتح Cloudflare Dashboard
2. اذهب إلى SSL/TLS
3. اختر "Full" أو "Full (strict)"

### تحديث الأمان
```powershell
# تحديث التبعيات
npm update

# تحديث npm
npm install -g npm@latest
```

---

## 📞 الدعم

### الموارد
- **GitHub**: https://github.com/Bomussa/2026
- **التوثيق**: README.md, INTEGRATION_PLAN.md
- **التقارير**: reports/DEPLOYMENT_LOG.md

### المشاكل الشائعة
راجع ملف `TROUBLESHOOTING.md` للحلول التفصيلية

---

## 🎯 قائمة التحقق

قبل النشر النهائي:

- [ ] تثبيت Node.js
- [ ] تثبيت PostgreSQL
- [ ] تثبيت Cloudflare Tunnel
- [ ] استنساخ المشروع
- [ ] تثبيت التبعيات
- [ ] إنشاء قاعدة البيانات
- [ ] إعداد ملف .env
- [ ] بناء التطبيق
- [ ] إعداد Cloudflare Tunnel
- [ ] اختبار محلي
- [ ] اختبار خارجي
- [ ] إعداد التشغيل التلقائي
- [ ] تغيير كلمة مرور الإدارة
- [ ] نسخ احتياطي أولي

---

## ✨ نصائح للأداء

1. **استخدم SSD** لقاعدة البيانات
2. **خصص 4GB RAM** على الأقل للتطبيق
3. **فعل الكاش** في Cloudflare
4. **راقب السجلات** بانتظام
5. **احتفظ بنسخ احتياطية** يومية

---

**تم إعداد هذا الدليل بواسطة**: Manus AI  
**التاريخ**: 14 أكتوبر 2025  
**الإصدار**: 1.0

🎉 **بالتوفيق في النشر!**

