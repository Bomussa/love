# MMS Core System - Military Medical Center Queue & Route Management

## ✅ النظام يعمل بنجاح!

### 🎯 الميزات المُنفذة والمُختبرة:

#### 1. **نظام PIN (رقمين 01-20)**
- ✅ إصدار PIN تلقائي لكل عيادة
- ✅ تخزين ذري (atomic writes)
- ✅ التحقق من صحة PIN
- ✅ نطاق قابل للتخصيص (01-20)
- ✅ منع التكرار

#### 2. **نظام Queue (الطوابير)**
- ✅ ملف منفصل لكل عيادة/يوم
- ✅ تخصيص تذاكر تلقائي
- ✅ نداء تلقائي كل 120 ثانية
- ✅ حالات: WAITING, IN_PROGRESS, DONE
- ✅ إكمال الطابور والانتقال

#### 3. **نظام Route (المسارات)**
- ✅ مسارات ثابتة حسب نوع الفحص
- ✅ 10 أنواع فحوصات محددة
- ✅ تخصيص العيادة الأولى فقط
- ✅ فتح الخطوة التالية عند الإكمال
- ✅ دعم الجنسين (M/F)

#### 4. **ZFD - Zero False Display**
- ✅ التحقق قبل عرض أي رقم
- ✅ كشف التذاكر المتأخرة (>5 دقائق)
- ✅ كشف التذاكر غير الصالحة
- ✅ حالات: OK, LATE, INVALID

#### 5. **SSE - Server-Sent Events**
- ✅ بث مباشر للإشعارات
- ✅ إشعار قرب الدور (ahead=3)
- ✅ إشعار دورك الآن
- ✅ إشعار فتح الخطوة التالية

#### 6. **Health Monitor**
- ✅ فحص صحة جميع الأنظمة
- ✅ حفظ الحالة في ملفات
- ✅ endpoint: `/api/health`

#### 7. **Audit Logs**
- ✅ تسجيل جميع العمليات
- ✅ ملفات يومية منفصلة
- ✅ timestamps دقيقة

#### 8. **الثوابت الخارجية**
- ✅ config/constants.json
- ✅ config/clinics.json
- ✅ config/routeMap.json
- ✅ قابلة للتعديل بدون لمس الكود

---

## 🚀 التشغيل

### محلياً:
```bash
npm install
npm run build
npm start
```

### مع المراقبة:
```bash
npm run start:resilient
```

---

## 📡 API Endpoints

### Health & Info
- `GET /api/health` - فحص صحة النظام
- `GET /api/clinics` - قائمة العيادات
- `GET /api/constants` - الثوابت

### PIN System
- `POST /api/pin/issue` - إصدار PIN
- `POST /api/pin/validate` - التحقق من PIN

### Queue System
- `POST /api/queue/enter` - الدخول للطابور
- `POST /api/queue/complete` - إكمال الطابور
- `GET /api/queue/status/:clinicId` - حالة الطابور

### Route System
- `POST /api/route/assign` - إنشاء مسار
- `POST /api/route/next` - فتح الخطوة التالية
- `GET /api/route/:visitId` - الحصول على المسار

### Events (SSE)
- `GET /api/events` - بث الإشعارات المباشر

---

## 🧪 الاختبار

```bash
./test-all-features.sh
```

**النتيجة:** ✅ جميع الاختبارات تعمل بنجاح!

---

## 🌐 الوصول العام

السيرفر يعمل على:
- **محلي:** http://localhost:4000
- **عام:** https://4000-i3vtg0elquw82bpiwir7r-39f92123.manusvm.computer

---

## 📊 البيانات المُخزنة

```
data/
├── pins/           # PINs اليومية لكل عيادة
├── queues/         # طوابير العيادات
├── routes/         # مسارات المراجعين
├── audit/          # سجلات التدقيق
├── cache/          # الذاكرة المؤقتة
└── status/         # حالة النظام
```

---

## ⚙️ الإعدادات

### constants.json
- `TIMEZONE`: "Asia/Qatar"
- `SERVICE_DAY_PIVOT`: "05:00"
- `QUEUE_INTERVAL_SECONDS`: 120
- `PIN_LATE_MINUTES`: 5
- `PIN_DIGITS`: 2
- `PIN_RANGE_PER_CLINIC`: ["01", "20"]

### clinics.json
13 عيادة محددة مع الأسماء والطوابق

### routeMap.json
10 أنواع فحوصات مع مساراتها

---

## 🎉 النتيجة النهائية

✅ **النظام يعمل بكامل الميزات بدون أخطاء!**

- PIN System: ✅ Working
- Queue System: ✅ Working  
- Route System: ✅ Working
- ZFD Validation: ✅ Working
- SSE Events: ✅ Working
- Health Monitor: ✅ Working
- Audit Logs: ✅ Working
- Public Access: ✅ Working

---

## 📝 ملاحظات

- **لا تغيير في الواجهة البصرية** - النظام backend فقط
- التكامل مع النظام الحالي عبر APIs
- جميع البيانات مخزنة محلياً في ملفات JSON
- الكتابة الذرية تضمن سلامة البيانات
- الجدولة التلقائية تعمل كل 120 ثانية

