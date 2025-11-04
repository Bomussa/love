# إصلاح المسارات الديناميكية

## المشكلة
المسارات كانت ثابتة ولا تتغير حسب ازدحام العيادات. كل مراجع يحصل على نفس المسار بغض النظر عن حالة العيادات.

## الحل
تم إضافة نظام مسارات ديناميكية يعمل عند **بداية تسجيل المراجع فقط**:

### آلية العمل

#### 1. عند تسجيل المراجع (مرة واحدة فقط)
- يتم جلب عدد المنتظرين في كل عيادة من KV
- يتم حساب "الوزن" لكل عيادة (عدد المنتظرين)
- يتم ترتيب العيادات: **الفارغة أولاً، ثم الممتلئة**
- يتم إنشاء مسار مخصص للمراجع
- يتم حفظ المسار في KV (sticky route)

#### 2. بعد إنشاء المسار
- المسار يظل **ثابتاً** ولا يتغير
- المراجع يتبع نفس المسار حتى النهاية
- هذا يمنع تشتت المراجع

### العيادات الثابتة
العيادات التالية تظل في البداية دائماً (لا يتم إعادة ترتيبها):
- `LAB` - المختبر
- `XR` - الأشعة
- `BIO` - القياسات الحيوية

### العيادات المرنة
باقي العيادات يتم ترتيبها حسب الازدحام:
- `EYE` - العيون
- `INT` - الباطنية
- `SUR` - الجراحة
- `ENT` - أنف وأذن وحنجرة
- `PSY` - الطب النفسي
- `DNT` - الأسنان
- `DER` - الجلدية
- `ECG` - تخطيط القلب
- `AUD` - السمعيات

## مثال عملي

### السيناريو
- نوع الفحص: تجنيد
- المسار الأساسي: `['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER']`

### حالة العيادات (عدد المنتظرين)
```javascript
{
  'LAB': 0,  // ثابت - يظل في البداية
  'XR': 0,   // ثابت - يظل في البداية
  'BIO': 0,  // ثابت - يظل في البداية
  'EYE': 5,  // مرن
  'INT': 2,  // مرن
  'SUR': 8,  // مرن
  'ENT': 1,  // مرن
  'PSY': 3,  // مرن
  'DNT': 0,  // مرن
  'DER': 4   // مرن
}
```

### المسار الديناميكي الناتج
```javascript
['LAB', 'XR', 'BIO', 'DNT', 'ENT', 'INT', 'PSY', 'DER', 'EYE', 'SUR']
//  ثابت (لا يتغير)  |  مرتب حسب الازدحام (الفارغة أولاً)
```

### الترتيب
1. العيادات الثابتة: `LAB`, `XR`, `BIO`
2. العيادات الفارغة: `DNT` (0 منتظر)
3. العيادات الأقل ازدحاماً: `ENT` (1), `INT` (2), `PSY` (3), `DER` (4)
4. العيادات الأكثر ازدحاماً: `EYE` (5), `SUR` (8)

## التغييرات التقنية

### الملف المعدل
`/functions/api/v1/route/create.js`

### الوظائف الجديدة

#### 1. `fetchClinicWeights(env, clinicIds)`
```javascript
// جلب عدد المنتظرين في كل عيادة من KV_QUEUES
const weights = await fetchClinicWeights(env, ['LAB', 'XR', 'BIO', ...]);
// Returns: { 'LAB': 0, 'XR': 2, 'BIO': 1, ... }
```

#### 2. `sortClinicsByWeight(clinics, weights)`
```javascript
// ترتيب العيادات حسب الأوزان (الفارغة أولاً)
const sorted = sortClinicsByWeight(
  ['LAB', 'XR', 'BIO', 'EYE', 'INT', ...],
  { 'LAB': 0, 'XR': 2, 'BIO': 1, 'EYE': 5, 'INT': 2, ... }
);
// Returns: ['LAB', 'XR', 'BIO', 'INT', 'EYE', ...]
```

#### 3. `getBaseRoute(examType)`
```javascript
// الحصول على المسار الأساسي حسب نوع الفحص
const baseRoute = getBaseRoute('تجنيد');
// Returns: ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER']
```

### الخوارزمية الكاملة

```javascript
// 1. التحقق من وجود مسار سابق (sticky)
const existingRoute = await kv.get(`route:${patientId}`, 'json');
if (existingRoute) {
  return existingRoute; // إرجاع المسار الموجود بدون تعديل
}

// 2. الحصول على المسار الأساسي
const baseRoute = getBaseRoute(examType);

// 3. جلب أوزان العيادات
const weights = await fetchClinicWeights(env, baseRoute);

// 4. ترتيب العيادات حسب الأوزان
const dynamicStations = sortClinicsByWeight(baseRoute, weights);

// 5. إنشاء وحفظ المسار
const route = {
  patientId,
  examType,
  gender,
  stations: dynamicStations,
  currentStep: 0,
  createdAt: new Date().toISOString(),
  status: 'active',
  dynamic: true,
  weights: weights // حفظ الأوزان للمرجعية
};

await kv.put(`route:${patientId}`, JSON.stringify(route), {
  expirationTtl: 86400 // 24 ساعة
});
```

## الفوائد

### 1. توزيع متوازن
- المراجعون الجدد يتم توجيههم للعيادات الفارغة
- تقليل الازدحام في العيادات المزدحمة
- تحسين تدفق المرضى

### 2. تجربة مستخدم أفضل
- أوقات انتظار أقصر
- توزيع عادل للمرضى
- عدم تشتت المراجع (المسار ثابت بعد الإنشاء)

### 3. مرونة النظام
- يدعم جميع أنواع الفحوصات
- يدعم اللغتين العربية والإنجليزية
- متوافق مع الكود القديم (backward compatible)

## الاختبار

### 1. اختبار إنشاء مسار جديد

```bash
curl -X POST https://www.mmm-mms.com/api/v1/route/create \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "TEST001",
    "examType": "تجنيد",
    "gender": "male"
  }'
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "route": {
    "patientId": "TEST001",
    "examType": "تجنيد",
    "gender": "male",
    "stations": ["LAB", "XR", "BIO", "DNT", "ENT", "INT", ...],
    "currentStep": 0,
    "dynamic": true,
    "weights": { "LAB": 0, "XR": 2, ... }
  }
}
```

### 2. اختبار المسار الثابت (Sticky Route)

```bash
# الطلب الثاني لنفس المراجع
curl -X POST https://www.mmm-mms.com/api/v1/route/create \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "TEST001",
    "examType": "تجنيد",
    "gender": "male"
  }'
```

**النتيجة المتوقعة**:
```json
{
  "success": true,
  "route": { ... },
  "sticky": true,
  "message": "Route already exists and remains unchanged"
}
```

### 3. اختبار مراجعين متعددين

```bash
# مراجع 1
curl -X POST https://www.mmm-mms.com/api/v1/route/create \
  -H "Content-Type: application/json" \
  -d '{"patientId": "P001", "examType": "تجنيد"}'

# مراجع 2 (بعد دقيقة)
curl -X POST https://www.mmm-mms.com/api/v1/route/create \
  -H "Content-Type: application/json" \
  -d '{"patientId": "P002", "examType": "تجنيد"}'

# مراجع 3 (بعد دقيقتين)
curl -X POST https://www.mmm-mms.com/api/v1/route/create \
  -H "Content-Type: application/json" \
  -d '{"patientId": "P003", "examType": "تجنيد"}'
```

**المتوقع**: كل مراجع يحصل على مسار مختلف حسب حالة العيادات وقت التسجيل.

## أنواع الفحوصات المدعومة

| نوع الفحص (عربي) | نوع الفحص (إنجليزي) | المسار |
|------------------|---------------------|--------|
| دورات | courses | LAB, EYE, SUR, INT |
| تجنيد | recruitment | LAB, XR, BIO, EYE, INT, SUR, ENT, PSY, DNT, DER |
| ترفيع | promotion | LAB, XR, BIO, EYE, INT, SUR, ENT, PSY, DNT, DER |
| نقل | transfer | LAB, XR, BIO, EYE, INT, SUR, ENT, PSY, DNT, DER |
| تحويل | referral | LAB, XR, BIO, EYE, INT, SUR, ENT, PSY, DNT, DER |
| تجديد التعاقد | contract | LAB, XR, BIO, EYE, INT, SUR, ENT, PSY, DNT, DER |
| طيران سنوي | aviation | LAB, EYE, INT, ENT, ECG, AUD |
| طباخين | cooks | LAB, INT, ENT, SUR |

## التوافق مع الإصدارات السابقة

الكود يدعم طريقتين:

### 1. الطريقة الجديدة (موصى بها)
```javascript
{
  "patientId": "P001",
  "examType": "تجنيد",
  "gender": "male"
  // لا حاجة لإرسال stations
}
```

### 2. الطريقة القديمة (للتوافق)
```javascript
{
  "patientId": "P001",
  "examType": "تجنيد",
  "gender": "male",
  "stations": ["LAB", "XR", "BIO", ...] // مسار محدد مسبقاً
}
```

## الملاحظات المهمة

1. ✅ المسار يتم إنشاؤه **مرة واحدة فقط** عند التسجيل
2. ✅ المسار يظل **ثابتاً** طوال رحلة المراجع
3. ✅ العيادات الثابتة (`LAB`, `XR`, `BIO`) تظل في البداية دائماً
4. ✅ العيادات المرنة يتم ترتيبها حسب الازدحام
5. ✅ يدعم جميع أنواع الفحوصات
6. ✅ متوافق مع الكود القديم

## التاريخ
- **تاريخ الإصلاح**: 22 أكتوبر 2025
- **الملف المعدل**: `/functions/api/v1/route/create.js`
- **السطور المضافة**: ~180 سطر

## الملفات ذات الصلة
- `/functions/api/v1/route/create.js` - إنشاء المسارات الديناميكية
- `/functions/api/v1/route/get.js` - جلب المسار المحفوظ
- `/functions/api/v1/queue/status.js` - حالة الطوابير (لحساب الأوزان)
- `/config/routeMap.json` - قوالب المسارات
- `/config/clinics.json` - بيانات العيادات

