# Middleware V2.1 - الطبقة الوسطية الذكية

**النسخة**: 2.1.0  
**التاريخ**: 2025-10-23  
**الحالة**: ✅ جاهز للإنتاج

---

## 📋 نظرة عامة

هذه الطبقة الوسطية ليست مجرد وسيط طلب/رد، بل **نظام عصبي** متكامل يقوم بـ:

- ✅ استقبال كل حدث من الواجهة
- ✅ التحقق الفوري عبر `validation-engine`
- ✅ التصحيح الذاتي عبر `auto-repair`
- ✅ الاتصال اللحظي مع Backend
- ✅ البث المباشر للإدارة عبر `realtime.service`

---

## 🏗️ الهيكل

\`\`\`
/middleware
│
├── core/                    # المحرك المركزي
│   ├── engine.js           # المحرك الذكي الرئيسي
│   ├── validation-engine.js # التحقق المتكامل
│   ├── orchestration.js    # تنسيق الأحداث
│   ├── auto-repair.js      # التصحيح الذاتي
│   ├── rules.js            # القواعد الثابتة
│   └── constants.js        # الثوابت اليومية
│
├── handlers/                # معالجات الطلبات
│   ├── pin.handler.js
│   ├── session.handler.js
│   ├── queue.handler.js
│   ├── log.handler.js
│   ├── notification.handler.js
│   └── fix.handler.js
│
├── services/                # الخدمات الخارجية
│   ├── backend.service.js  # الاتصال بالـBackend
│   ├── db.service.js       # قاعدة البيانات
│   ├── realtime.service.js # البث اللحظي
│   └── health.service.js   # الصحة والمراقبة
│
├── guards/                  # الحراس الأمنيون
│   ├── conflict.guard.js   # منع التعارضات
│   ├── timing.guard.js     # التسلسل الزمني
│   └── security.guard.js   # الأمان
│
├── utils/                   # الأدوات المساعدة
│   ├── logger.js           # التسجيل
│   ├── formatter.js        # التنسيق
│   └── metrics.js          # الإحصائيات
│
├── routes/                  # المسارات
│   ├── pin.routes.js
│   ├── session.routes.js
│   ├── queue.routes.js
│   ├── notification.routes.js
│   ├── admin.routes.js
│   └── router.js           # الموجه المركزي
│
├── monitor/                 # المراقبة والتعافي
│   ├── watcher.js          # المراقبة
│   ├── audit-log.js        # السجل
│   └── recovery.js         # التعافي
│
└── index.js                 # نقطة الدخول
\`\`\`

---

## 🚀 التشغيل المحلي

\`\`\`bash
cd middleware
npm install
npm run dev
\`\`\`

الخادم سيعمل على المنفذ **8080** (قابل للتغيير).

---

## 📡 المسارات المتاحة

| المسار | الطريقة | الوصف |
|--------|---------|-------|
| `/mw/session/start` | POST | بدء جلسة جديدة |
| `/mw/clinic/enter` | POST | دخول عيادة |
| `/mw/pin/verify` | POST | التحقق من PIN |
| `/mw/queue/issue` | POST | إصدار رقم دور |
| `/mw/admin/pins/today` | GET | أكواد اليوم |
| `/mw/admin/live` | GET | البث المباشر |
| `/mw/notify/info` | POST | إشعار |

---

## ⚙️ المنطق الكامل

### 1. التدفق الأساسي

\`\`\`
Frontend → routes → handler → guards → engine
                                         ↓
                                    validation
                                         ↓
                                   orchestration
                                         ↓
                                   auto-repair (إن لزم)
                                         ↓
                                    formatter
                                         ↓
                                      logger
                                         ↓
                              ┌──────────┴──────────┐
                              ↓                     ↓
                         Backend              Realtime
                              ↓                     ↓
                         Database            Admin UI
\`\`\`

### 2. نقاط القوة

| الوظيفة | المكان | الدور |
|---------|--------|-------|
| منع ازدواج الجلسة | `conflict.guard.js` | رفض جلسة بنفس IP/device خلال 24h |
| تصحيح ذاتي | `auto-repair.js` | إعادة بناء الطلب خلال 5 ثوانٍ |
| مراقبة صحية | `health.service.js` + `watcher.js` | كشف البطء وإرسال تنبيه |
| توثيق متسلسل | `audit-log.js` | كل عملية بتوقيت دقيق |
| بث حي | `realtime.service.js` | إشعارات لحظية |
| تعافي فوري | `recovery.js` | إعادة تشغيل بدون فقد جلسات |

---

## 🔒 الأمان

- ✅ **لا كتابة مباشرة**: كل شيء يمر عبر Backend
- ✅ **توثيق كامل**: كل عملية مسجلة
- ✅ **تحقق متعدد الطبقات**: Guards + Validation + Backend

---

## 📊 المراقبة

استخدم `/mw/admin/live` للحصول على:
- عدد الجلسات النشطة
- أرقام الدور المصدرة
- الأخطاء والتصحيحات

---

## 🛠️ التطوير

### إضافة مسار جديد

1. أنشئ handler في `handlers/`
2. أنشئ route في `routes/`
3. أضف المسار في `router.js`

### إضافة قاعدة تحقق

1. أضف القاعدة في `rules.js`
2. استخدمها في `validation-engine.js`

---

## 📝 الترخيص

هذا المشروع خاص بتطبيق اللجنة الطبية.

---

**المطور**: Lead Software Architect  
**التاريخ**: 2025-10-23
