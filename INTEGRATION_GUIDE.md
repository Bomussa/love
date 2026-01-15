# دليل التكامل - Integration Guide

## 📋 **الملفات الجديدة المُنشأة**

### **1. Core Engines (المحركات الأساسية)**

#### `frontend/src/core/queue-engine-v2.js`
- **الوظيفة**: محرك الطوابير المحدث مع ربط Supabase
- **الاستخدام**:
```javascript
import queueEngineV2 from './core/queue-engine-v2.js'

// Add patient to queue
const entry = await queueEngineV2.addToQueue(
  'clinic_id',
  'patient_id',
  'patient_name',
  'exam_type'
)

// Get patient position
const position = await queueEngineV2.getPatientPosition('clinic_id', 'patient_id')

// Get queue status
const status = await queueEngineV2.getQueueStatus('clinic_id')
```

#### `frontend/src/core/path-engine-v2.js`
- **الوظيفة**: محرك المسارات الديناميكية مع حساب الأوزان
- **الاستخدام**:
```javascript
import pathEngineV2 from './core/path-engine-v2.js'

// Initialize patient path
const path = await pathEngineV2.initializePatientPath('patient_id', 'recruitment')

// Get current clinic
const current = pathEngineV2.getCurrentClinic('patient_id')

// Advance to next clinic
const next = await pathEngineV2.advanceToNextClinic('patient_id', 'current_clinic_id')
```

#### `frontend/src/core/notification-engine-v2.js`
- **الوظيفة**: محرك الإشعارات بدون تداخل
- **الاستخدام**:
```javascript
import notificationEngineV2 from './core/notification-engine-v2.js'

// Subscribe to notifications
const unsubscribe = notificationEngineV2.subscribe('patient_id', (notification) => {
  console.log('New notification:', notification)
})

// Send notification
notificationEngineV2.sendYourTurn('patient_id', 'clinic_name', 5)
```

---

### **2. API Extensions (توسعات API)**

#### `frontend/src/lib/supabase-api.js` (تم التحديث)
- **الدوال الجديدة**:
  - `getOrCreateQueueEntry(patientId, clinicId, patientName, examType)`
  - `getQueueEntry(patientId, clinicId)`
  - `getQueueStatus(clinicId)`
  - `getPatientPosition(patientId, clinicId)`
  - `calculateClinicWeights(clinicIds)`

---

### **3. Admin Components (مكونات الإدارة)**

#### `frontend/src/components/AdminPINManager.jsx`
- **الوظيفة**: واجهة إدارة البن كود
- **المزايا**:
  - عرض جميع البن كود (النشطة وغير النشطة)
  - إنشاء بن جديد
  - تفعيل/إلغاء تفعيل
  - حذف البن
  - إلغاء المنتهية تلقائياً
  - Realtime updates

#### `frontend/src/components/AdminStatistics.jsx`
- **الوظيفة**: لوحة الإحصائيات
- **المزايا**:
  - إحصائيات في الوقت الفعلي
  - إحصائيات العيادات
  - مؤشرات الأداء
  - تحديث تلقائي كل 30 ثانية

#### `frontend/src/components/AdminHeader.jsx`
- **الوظيفة**: شريط التنقل للإدارة
- **المزايا**:
  - زر الخروج
  - زر العودة للرئيسية
  - قائمة تنقل شاملة

---

## 🔧 **خطوات التكامل**

### **المرحلة 1: تحديث المسارات (Routing)**

#### 1.1 تحديث `App.jsx`

```javascript
// Add new imports
import AdminPINManager from './components/AdminPINManager.jsx'
import AdminStatistics from './components/AdminStatistics.jsx'
import AdminHeader from './components/AdminHeader.jsx'

// Add routing logic
function App() {
  // ... existing code ...
  
  // Add admin routes
  if (path === '/admin/pins') {
    return (
      <>
        <AdminHeader />
        <AdminPINManager />
      </>
    )
  }
  
  if (path === '/admin/statistics') {
    return (
      <>
        <AdminHeader />
        <AdminStatistics />
      </>
    )
  }
  
  // ... rest of the code ...
}
```

#### 1.2 إنشاء Router (إذا لم يكن موجوداً)

```javascript
// frontend/src/router.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminDashboard from './components/AdminDashboardV2.jsx'
import AdminPINManager from './components/AdminPINManager.jsx'
import AdminStatistics from './components/AdminStatistics.jsx'
import AdminHeader from './components/AdminHeader.jsx'

function AdminRoutes() {
  return (
    <>
      <AdminHeader />
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/pins" element={<AdminPINManager />} />
        <Route path="/admin/statistics" element={<AdminStatistics />} />
        <Route path="/admin/users" element={<AdminUserManager />} />
        <Route path="/admin/reports" element={<AdminReports />} />
      </Routes>
    </>
  )
}
```

---

### **المرحلة 2: تحديث المكونات الموجودة**

#### 2.1 تحديث `PatientPage.jsx`

```javascript
// Replace old imports
// import queueEngine from './core/queue-engine.js'
// import pathEngine from './core/path-engine.js'
// import notificationEngine from './core/notification-engine.js'

// With new imports
import queueEngineV2 from './core/queue-engine-v2.js'
import pathEngineV2 from './core/path-engine-v2.js'
import notificationEngineV2 from './core/notification-engine-v2.js'

// Update all function calls
// Old: const entry = await queueEngine.addToQueue(clinicId, patientId)
// New: const entry = await queueEngineV2.addToQueue(clinicId, patientId, patientName, examType)
```

#### 2.2 تحديث `ClinicDashboard.jsx`

```javascript
// Replace old imports
import queueEngineV2 from './core/queue-engine-v2.js'

// Update queue status fetching
const status = await queueEngineV2.getQueueStatus(clinicId)
```

---

### **المرحلة 3: تحديث قاعدة البيانات**

#### 3.1 التحقق من جدول `queue`

```sql
-- Already created, verify with:
SELECT * FROM queue LIMIT 1;
```

#### 3.2 التحقق من جدول `pins`

```sql
-- Already exists, verify with:
SELECT * FROM pins LIMIT 1;
```

---

### **المرحلة 4: الاختبار**

#### 4.1 اختبار نظام الدور

```javascript
// Test in browser console
import queueEngineV2 from './core/queue-engine-v2.js'

// Add test patient
const entry = await queueEngineV2.addToQueue('lab', 'TEST123', 'Test Patient', 'recruitment')
console.log('Queue entry:', entry)

// Get position
const position = await queueEngineV2.getPatientPosition('lab', 'TEST123')
console.log('Position:', position)
```

#### 4.2 اختبار المسارات الديناميكية

```javascript
import pathEngineV2 from './core/path-engine-v2.js'

// Initialize path
const path = await pathEngineV2.initializePatientPath('TEST123', 'recruitment')
console.log('Path:', path)
```

#### 4.3 اختبار الإشعارات

```javascript
import notificationEngineV2 from './core/notification-engine-v2.js'

// Subscribe
const unsubscribe = notificationEngineV2.subscribe('TEST123', (notification) => {
  console.log('Notification:', notification)
})

// Send test
notificationEngineV2.sendWelcome('TEST123')
```

---

## 📊 **قائمة التحقق (Checklist)**

### **Core Engines**
- [x] إنشاء `queue-engine-v2.js`
- [x] إنشاء `path-engine-v2.js`
- [x] إنشاء `notification-engine-v2.js`
- [ ] تحديث `PatientPage.jsx` لاستخدام المحركات الجديدة
- [ ] تحديث `ClinicDashboard.jsx` لاستخدام المحركات الجديدة

### **API Extensions**
- [x] إضافة دوال Queue في `supabase-api.js`
- [x] إنشاء جدول `queue` في Supabase
- [x] إضافة الفهارس

### **Admin Components**
- [x] إنشاء `AdminPINManager.jsx`
- [x] إنشاء `AdminStatistics.jsx`
- [x] إنشاء `AdminHeader.jsx`
- [ ] إنشاء `AdminUserManager.jsx`
- [ ] إنشاء `AdminReports.jsx`

### **Routing**
- [ ] تحديث `App.jsx` لإضافة المسارات الجديدة
- [ ] إنشاء Router (إذا لزم الأمر)

### **Testing**
- [ ] اختبار نظام الدور
- [ ] اختبار المسارات الديناميكية
- [ ] اختبار الإشعارات
- [ ] اختبار واجهة إدارة البن
- [ ] اختبار الإحصائيات

### **Deployment**
- [ ] Commit changes to Git
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Test on production

---

## 🚀 **الخطوات التالية**

1. **دمج المحركات الجديدة في المكونات الموجودة**
2. **تحديث المسارات في `App.jsx`**
3. **إنشاء المكونات المتبقية** (`AdminUserManager.jsx`, `AdminReports.jsx`)
4. **الاختبار الشامل**
5. **النشر على Production**

---

## 📝 **ملاحظات مهمة**

### **1. Backward Compatibility**
- المحركات القديمة لا تزال موجودة
- يمكن التبديل تدريجياً
- لا حاجة لحذف الملفات القديمة فوراً

### **2. Performance**
- المحركات الجديدة تستخدم Supabase مباشرة
- أداء أفضل مع قاعدة البيانات
- Cache محلي للأداء

### **3. Error Handling**
- جميع الدوال تحتوي على try-catch
- Fallback للنظام القديم في حالة الفشل
- Logging شامل للأخطاء

---

## 🔗 **روابط مفيدة**

- [Supabase Documentation](https://supabase.com/docs)
- [React Router Documentation](https://reactrouter.com/)
- [Vercel Deployment](https://vercel.com/docs)

---

**تاريخ الإنشاء**: 2026-01-15  
**الإصدار**: 2.0.0  
**الحالة**: جاهز للتكامل
