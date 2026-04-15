# 🔗 دليل التكامل - MMS Core Integration

## ✅ تم التكامل بنجاح!

تاريخ التكامل: 2025-10-22
الإصدار: 1.0.0

---

## 📦 الملفات المضافة

### 1. Backend (MMS Core)
```
mms-core/
├── src/           # كود TypeScript
├── dist/          # كود مُترجم
├── config/        # إعدادات النظام
├── data/          # بيانات محلية
└── package.json
```

### 2. Integration Layer
```
src/lib/
├── mms-core-api.js        # واجهة MMS Core API
├── api-adapter.js         # طبقة التكامل + Fallback
└── integration-status.json # حالة التكامل
```

### 3. Backup & Rollback
```
BACKUP_BEFORE_INTEGRATION_*.tar.gz  # نسخة احتياطية كاملة
EMERGENCY_ROLLBACK.sh               # سكريبت الطوارئ
```

---

## 🚀 كيفية الاستخدام

### البدء السريع

1. **تشغيل MMS Core (إذا لم يكن يعمل):**
```bash
cd mms-core
npm start
```

2. **استخدام API Adapter في الكود:**
```javascript
import apiAdapter from './lib/api-adapter.js';

// سيستخدم MMS Core تلقائياً إذا كان متاحاً
// وإلا سيستخدم LocalAPI كـ fallback

const result = await apiAdapter.issuePin('lab', 'V001');
```

### التحقق من الحالة

```javascript
const status = apiAdapter.getStatus();
console.log(status);
// {
//   mmsCoreAvailable: true/false,
//   currentMode: 'MMS Core' | 'Local Fallback',
//   features: { ... }
// }
```

---

## 🔄 Fallback Mechanism

النظام يعمل بشكل تلقائي:

1. **MMS Core متاح** → يستخدم APIs الجديدة
2. **MMS Core غير متاح** → يستخدم LocalAPI القديم
3. **لا يوجد تعطيل** → التطبيق يعمل دائماً

---

## 🆕 APIs الجديدة المتاحة

### PIN System
```javascript
await apiAdapter.issuePin(clinicId, visitId)
await apiAdapter.validatePin(clinicId, pin, dateKey)
```

### Queue System
```javascript
await apiAdapter.enterQueue(clinicId, visitId)
await apiAdapter.completeQueue(clinicId, visitId, ticket)
await apiAdapter.getQueueStatus(clinicId)
```

### Route System
```javascript
await apiAdapter.assignRoute(visitId, examType, gender)
await apiAdapter.getRoute(visitId)
await apiAdapter.unlockNextStep(visitId, currentClinicId)
```

### SSE Events
```javascript
const eventSource = apiAdapter.connectToEvents((notice) => {
  console.log('Received:', notice);
});
```

---

## 🚨 خطة الطوارئ

### إذا حدث أي خطأ، نفذ:

```bash
./EMERGENCY_ROLLBACK.sh
```

**سيقوم السكريبت بـ:**
1. ✅ إيقاف MMS Core Server
2. ✅ حذف ملفات التكامل
3. ✅ استعادة النسخة الاحتياطية
4. ✅ إعادة تثبيت الحزم
5. ✅ إرجاع المشروع كما كان

**الوقت المتوقع:** أقل من دقيقة

---

## ✅ ضمانات الأمان

### لا تعارض:
- ✅ MMS Core يعمل على منفذ 4000
- ✅ التطبيق الحالي على منفذ 8788
- ✅ لا تداخل في قواعد البيانات
- ✅ لا تعديل على الكود الأصلي

### لا تكرار:
- ✅ API Adapter يوحد الاستدعاءات
- ✅ لا تكرار في المنطق
- ✅ كود نظيف ومنظم

### لا أخطاء مستقبلية:
- ✅ Fallback تلقائي
- ✅ معالجة أخطاء شاملة
- ✅ Rollback جاهز دائماً

---

## 📊 الاختبار

### اختبار MMS Core:
```bash
cd mms-core
./test-all-features.sh
```

### اختبار التكامل:
```javascript
// في console المتصفح
window.APIAdapter.getStatus()
```

### اختبار Fallback:
```bash
# أوقف MMS Core
ps aux | grep "node dist/index.js" | awk '{print $2}' | xargs kill

# التطبيق سيستمر بالعمل باستخدام LocalAPI
```

---

## 🔧 الصيانة

### تحديث MMS Core:
```bash
cd mms-core
npm run build
# أعد تشغيل السيرفر
```

### مراقبة Logs:
```bash
cd mms-core
tail -f server.log
tail -f data/audit/*.log
```

### تنظيف البيانات القديمة:
```bash
cd mms-core/data
# احذف ملفات أقدم من 30 يوم
find . -name "*.json" -mtime +30 -delete
```

---

## 📞 الدعم

### مشاكل شائعة:

**1. MMS Core لا يعمل:**
```bash
cd mms-core
npm run build
npm start
```

**2. Port 4000 مشغول:**
```bash
# غير المنفذ في .env
echo "PORT=4001" > mms-core/.env
```

**3. APIs لا تستجيب:**
```bash
# تحقق من الحالة
curl http://localhost:4000/api/health
```

---

## 🎯 الخطوات التالية

### للتطوير:
1. راجع `src/lib/api-adapter.js`
2. أضف APIs جديدة حسب الحاجة
3. اختبر Fallback دائماً

### للإنتاج:
1. غير `baseURL` في `mms-core-api.js` للسيرفر الحقيقي
2. فعّل HTTPS
3. أضف authentication headers

---

## ✨ الميزات الجديدة

- ✅ نظام PIN محسّن (01-20)
- ✅ نظام Queue مع جدولة تلقائية
- ✅ نظام Route ذكي
- ✅ ZFD Validation
- ✅ SSE للإشعارات الفورية
- ✅ Audit Logs شاملة
- ✅ Health Monitoring

---

**تم بنجاح! 🎉**

