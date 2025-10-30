# سجل التقدم - إصلاح مسارات API

**التاريخ**: 2025-10-30  
**الحالة**: 🔧 **إصلاح مسارات Supabase Functions**

---

## 🚨 المشكلة المكتشفة

### الخطأ في Console:
```
https://rujwuruuosffcxazymit.supabase.co/functions/v1/api/v1/patient/login
                                                      ^^^^^^^^ خطأ!
```

**المشكلة**:
- الكود يضيف `/api/v1/` قبل المسار
- ثم يضيف `/patient/login`
- النتيجة: `/api/v1/patient/login` ❌

**الصحيح**:
```
https://rujwuruuosffcxazymit.supabase.co/functions/v1/patient-login
```

---

## ✅ الحل المنفذ

### 1. تحديث API_VERSION
```javascript
// قبل
const API_VERSION = '/api/v1'

// بعد
const API_VERSION = ''
```

### 2. تحديث دالة request
```javascript
// تحويل المسار تلقائياً:
// /patient/login → patient-login
// /queue/enter → queue-enter
const functionName = endpoint.replace(/^\//, '').replace(/\//, '-')

// استخدام المسار الصحيح حسب البيئة
const isSupabase = base.includes('supabase.co')
const path = isSupabase ? `/${functionName}` : endpoint
```

### 3. إنشاء api-routes-map.js
- Mapping كامل لجميع المسارات
- 21 function مدعومة

---

## 🔄 الخطوة القادمة

### Push التعديلات
```bash
git add src/lib/api.js src/lib/api-routes-map.js PROGRESS.md
git commit -m "fix: إصلاح مسارات Supabase Functions"
git push origin main
```

---

**آخر تحديث**: جاري Push الإصلاح
