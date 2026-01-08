# هيكل قاعدة البيانات Supabase

## التاريخ: 8 يناير 2026

---

## ✅ الجداول الموجودة:

### 1. **جدول `clinics`** ✅
- **الصفوف:** 25 عيادة
- **الأعمدة المهمة:**
  - `id` (varchar) - معرف العيادة
  - `name` (varchar) - الاسم بالإنجليزية
  - `name_ar` (varchar) - الاسم بالعربية
  - `name_en` (text) - الاسم بالإنجليزية
  - `pin_code` (varchar) - **رقم PIN الحالي** ✅
  - `pin_expires_at` (timestamptz) - **وقت انتهاء PIN** ✅
  - `is_active` (boolean)
  - `floor` (text)
  - `category` (text)
  - `gender_constraint` (text)
  - `metadata` (jsonb)

### 2. **جدول `pins`** ✅
- **الصفوف:** 61 رقم PIN
- **الأعمدة:**
  - `id` (uuid) - المعرف الفريد
  - `clinic_code` (text) - كود العيادة
  - `pin` (text) - **رقم PIN** ✅
  - `generated_at` (timestamptz) - وقت الإنشاء
  - `expires_at` (timestamptz) - وقت الانتهاء
  - `is_active` (boolean) - حالة النشاط
  - `created_at` (timestamptz)

### 3. **جدول `queue`** ✅
- **الصفوف:** 22 مراجع
- **الأعمدة المهمة:**
  - `id` (uuid)
  - `patient_id` (varchar)
  - `patient_name` (varchar)
  - `clinic_id` (varchar)
  - `exam_type` (varchar)
  - `position` (integer) - **رقم الدور** ✅
  - `status` (enum) - waiting, called, in_progress, completed, cancelled, in_service, no_show
  - `qr_code` (varchar)
  - `entered_at` (timestamptz)
  - `called_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `metadata` (jsonb)

### 4. **جدول `routes`** ✅
- **الصفوف:** 0 (يحتاج إنشاء)
- **الأعمدة:**
  - `id` (uuid)
  - `exam_type` (varchar) - نوع الفحص
  - `route_name` (varchar)
  - `clinics` (jsonb) - **المسار الديناميكي** ✅
  - `order_sequence` (integer)
  - `is_active` (boolean)

### 5. **جدول `notifications`** ✅
- **الصفوف:** 0
- **الأعمدة:**
  - `id` (uuid)
  - `patient_id` (varchar)
  - `clinic_id` (varchar)
  - `type` (varchar) - call, update, alert, info
  - `title` (varchar)
  - `message` (text)
  - `is_read` (boolean)
  - `sent_at` (timestamptz)
  - `payload` (jsonb)

### 6. **جدول `patients`** ✅
- **الصفوف:** 76 مراجع
- **الأعمدة:**
  - `id` (uuid)
  - `patient_id` (text) - الرقم العسكري
  - `gender` (text)
  - `session_id` (text)
  - `login_time` (timestamptz)
  - `status` (text)

### 7. **جدول `reports`** ✅
- **الصفوف:** 0
- **الأعمدة:**
  - `id` (uuid)
  - `type` (varchar) - daily, weekly, monthly, yearly
  - `clinic_id` (varchar)
  - `period_start` (date)
  - `period_end` (date)
  - `total_patients` (integer)
  - `completed_patients` (integer)
  - `cancelled_patients` (integer)
  - `average_wait_time` (integer)
  - `data` (jsonb)

---

## 🔗 العلاقات بين الجداول:

### 1. **نظام PIN:**
```
clinics.pin_code ← يحتوي على PIN الحالي
pins ← سجل تاريخي لجميع الأرقام
```

### 2. **نظام الدور (Queue):**
```
queue.clinic_id → clinics.id
queue.position → رقم الدور
queue.status → حالة المراجع
```

### 3. **المسارات الديناميكية:**
```
routes.exam_type → نوع الفحص
routes.clinics (jsonb) → قائمة العيادات بالترتيب
```

### 4. **الإشعارات:**
```
notifications.patient_id → المراجع
notifications.clinic_id → العيادة
notifications.type → نوع الإشعار
```

---

## ✅ الخلاصة:

### ما يعمل:
1. ✅ جدول `clinics` موجود مع حقول PIN
2. ✅ جدول `pins` موجود لتخزين الأرقام
3. ✅ جدول `queue` موجود لنظام الدور
4. ✅ جدول `routes` موجود للمسارات
5. ✅ جدول `notifications` موجود للإشعارات
6. ✅ جدول `reports` موجود للتقارير

### ما يحتاج عمل:
1. ⚠️ جدول `routes` فارغ - يحتاج إنشاء المسارات
2. ⚠️ جدول `notifications` فارغ - يحتاج تفعيل الإشعارات
3. ⚠️ جدول `reports` فارغ - يحتاج إنشاء التقارير

### نظام PIN:
- ✅ **يعمل بشكل صحيح**
- ✅ الجداول موجودة
- ✅ الحقول صحيحة
- ✅ 61 رقم PIN موجود في قاعدة البيانات
