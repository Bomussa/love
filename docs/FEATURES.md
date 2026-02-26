# دليل المزايا الشامل — نظام MMC-MMS
# Complete Features Guide — MMC-MMS System

> **المشروع:** نظام إدارة اللجنة الطبية العسكرية  
> **Project:** Military Medical Committee Management System  
> **الموقع:** https://mmc-mms.com  
> **تاريخ التوثيق:** 2026-02-26  
> **المصدر:** مستخرج من الكود الحقيقي — `src/components/AdminDashboardV2.jsx` + `src/components/FeatureControlPanel.jsx`

---

## 📋 فهرس المزايا / Features Index

| # | القسم | عدد المزايا |
|---|-------|-------------|
| 1 | [المزايا الأساسية — Core Features](#1-المزايا-الأساسية) | 4 |
| 2 | [إدارة الطوابير — Queue Management](#2-إدارة-الطوابير) | 8 |
| 3 | [نظام الأرقام السرية — PIN System](#3-نظام-الأرقام-السرية) | 5 |
| 4 | [إدارة العيادات — Clinics Management](#4-إدارة-العيادات) | 6 |
| 5 | [نظام المسارات — Routes System](#5-نظام-المسارات) | 4 |
| 6 | [توجيه الطوابق — Floor Directions](#6-توجيه-الطوابق) | 3 |
| 7 | [نظام الإشعارات — Notifications](#7-نظام-الإشعارات) | 5 |
| 8 | [إدارة المستخدمين — Users Management](#8-إدارة-المستخدمين) | 6 |
| 9 | [التقارير والإحصائيات — Reports](#9-التقارير-والإحصائيات) | 4 |
| 10 | [الإعدادات — Settings](#10-الإعدادات) | 27 |
| 11 | [سجل النشاطات — Activity Log](#11-سجل-النشاطات) | 3 |
| 12 | [النسخ الاحتياطي — Backup & Export](#12-النسخ-الاحتياطي) | 3 |
| 13 | [وضع أوفلاين — Offline Mode](#13-وضع-أوفلاين) | 3 |
| 14 | [إدارة المحتوى — Content Management](#14-إدارة-المحتوى) | 4 |
| 15 | [المظهر — Appearance](#15-المظهر) | 5 |
| 16 | [قاعدة البيانات — Database](#16-قاعدة-البيانات) | 4 |
| 17 | [التحكم بالميزات — Feature Control](#17-التحكم-بالميزات) | 11 |
| 18 | [مراقبة API — API Monitor](#18-مراقبة-api) | 4 |
| 19 | [النظام الذكي — Smart System](#19-النظام-الذكي) | 6 |

---

## 1. المزايا الأساسية
## 1. Core Features

### 1.1 لوحة التحكم الرئيسية / Main Dashboard
- **الهدف:** عرض ملخص حي للنظام بالكامل
- **Purpose:** Display live system summary
- **البيانات المعروضة (حقيقية من Supabase):**
  - عدد المرضى في الطابور اليوم
  - عدد العيادات النشطة (من جدول `clinics`)
  - عدد الأرقام السرية النشطة (من جدول `pins`)
  - آخر نشاط في السجل (من جدول `activity_logs`)
- **موقع الكود:** `AdminDashboardV2.jsx` → `activeTab === 'dashboard'`
- **تحديث تلقائي:** كل 30 ثانية عبر Supabase Realtime

### 1.2 دعم اللغتين / Bilingual Support
- **الهدف:** عرض كامل التطبيق بالعربية أو الإنجليزية
- **Purpose:** Full Arabic/English UI switching
- **الآلية:** دالة `t(ar, en)` في كل مكون — تُغيّر كل النصوص فوراً
- **موقع الكود:** `AdminDashboardV2.jsx` → `const t = (ar, en) => language === 'ar' ? ar : en`
- **التأثير:** كل الملفات تتغير للإنجليزية عند اختيار اللغة الإنجليزية

### 1.3 المزامنة الفورية / Realtime Sync
- **الهدف:** تحديث البيانات تلقائياً بدون إعادة تحميل
- **Purpose:** Auto-update data without page reload
- **الآلية:** Supabase Realtime Subscriptions على جداول: `unified_queue`, `clinics`, `pins`
- **موقع الكود:** `src/lib/supabase-client.js` → `startConnectionMonitor()`

### 1.4 حماية الجلسة / Session Protection
- **الهدف:** منع الوصول غير المصرح للوحة الإدارة
- **Purpose:** Prevent unauthorized admin access
- **الآلية:** JWT Token + Role-based access control
- **موقع الكود:** `src/lib/auth-service.js`

---

## 2. إدارة الطوابير
## 2. Queue Management

> **الجدول:** `unified_queue` | **السجلات الحالية:** 11 | **الأعمدة:** 24

### 2.1 استدعاء المريض / Call Patient
- **الهدف:** استدعاء الرقم التالي في الطابور
- **Purpose:** Call next patient number
- **الآلية:** يُحدّث حقل `status` من `waiting` إلى `called` في `unified_queue`
- **API:** `POST /api/v1/queue/next`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleCallNext()`
- **شرط العمل:** العيادة يجب أن تكون نشطة (`is_active = true`)

### 2.2 إكمال الفحص / Complete Exam
- **الهدف:** تسجيل انتهاء فحص المريض
- **Purpose:** Mark patient exam as complete
- **الآلية:** يُحدّث `status` إلى `done` + يُسجّل في `activity_logs`
- **API:** `POST /api/v1/queue/done`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleComplete()`

### 2.3 ترحيل المريض / Postpone Patient
- **الهدف:** تأجيل مريض لآخر الطابور
- **Purpose:** Move patient to end of queue
- **الآلية:** يُحدّث `display_number` لأكبر رقم + 1
- **API:** `POST /api/v1/admin/queues/move-to-end`
- **الحد الأقصى:** مُتحكَّم به بإعداد `max_postpones`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handlePostpone()`

### 2.4 إلغاء المريض / Cancel Patient
- **الهدف:** إلغاء مريض من الطابور
- **Purpose:** Remove patient from queue
- **الآلية:** يُحدّث `status` إلى `cancelled`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleCancel()`

### 2.5 إضافة للطابور / Add to Queue
- **الهدف:** إضافة مريض يدوياً للطابور
- **Purpose:** Manually add patient to queue
- **API:** `POST /api/v1/queue/get-number`
- **الحقول المطلوبة:** `patient_id`, `clinic_id`, `queue_date`

### 2.6 فلترة الطابور / Queue Filter
- **الهدف:** عرض طابور عيادة محددة أو الكل
- **Purpose:** Filter queue by clinic or show all
- **الآلية:** فلترة محلية في React بدون طلب جديد للـ API

### 2.7 إعادة تعيين الطابور / Reset Queue
- **الهدف:** مسح كل الطابور اليومي
- **Purpose:** Clear all daily queue entries
- **الإعداد المتحكم:** `reset_queue_daily` في جدول `settings`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleResetQueue()`

### 2.8 إحصائيات الطابور / Queue Statistics
- **الهدف:** عرض أعداد الانتظار والمكتملين والملغيين
- **Purpose:** Show waiting/done/cancelled counts
- **البيانات:** حقيقية من `unified_queue` مُفلترة بتاريخ اليوم

---

## 3. نظام الأرقام السرية
## 3. PIN System

> **الجدول:** `pins` | **السجلات الحالية:** 18 | **الأعمدة:** 10

### 3.1 إنشاء رقم سري / Create PIN
- **الهدف:** إنشاء رقم PIN لعيادة محددة
- **Purpose:** Generate PIN for a specific clinic
- **الحقول:** `pin_code` (اختياري - يُولَّد تلقائياً إذا فارغ), `clinic_id` (إلزامي), `max_uses` (افتراضي: 100)
- **الآلية:** يتحقق من عدم تكرار الرقم في نفس العيادة
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleCreatePin()` السطر 732

### 3.2 تفعيل/تعطيل PIN / Toggle PIN
- **الهدف:** إيقاف أو تشغيل رقم سري
- **Purpose:** Enable/disable a PIN code
- **الآلية:** يُحدّث `is_active` في جدول `pins`
- **موقع الكود:** `AdminDashboardV2.jsx` السطر 835

### 3.3 إصدار PIN تلقائي / Auto PIN Generate
- **الهدف:** إصدار أرقام PIN يومياً تلقائياً
- **Purpose:** Auto-generate daily PIN codes
- **الإعداد:** `auto_pin_generate` في `FeatureControlPanel`
- **وقت التشغيل:** مُتحكَّم به بإعداد `pin_auto_generate_time`

### 3.4 حذف PIN تلقائي / Auto PIN Delete
- **الهدف:** حذف الأرقام منتهية الصلاحية تلقائياً
- **Purpose:** Auto-delete expired PINs
- **الإعداد:** `pin_auto_delete_time` في جدول `settings`

### 3.5 التحقق من PIN / Validate PIN
- **الهدف:** التحقق من صحة رقم PIN عند دخول المريض
- **Purpose:** Validate patient PIN at entry
- **API:** `POST /api/v1/pin/validate`
- **الآلية:** يتحقق من `is_active` + `max_uses` + `clinic_code`

---

## 4. إدارة العيادات
## 4. Clinics Management

> **الجدول:** `clinics` | **السجلات الحالية:** 18 | **الأعمدة:** 21

### 4.1 إضافة عيادة / Add Clinic
- **الهدف:** إضافة عيادة أو محطة طبية جديدة
- **Purpose:** Add new clinic or medical station
- **الحقول:** `name_ar`, `name_en`, `clinic_code`, `floor`, `room_number`, `is_active`, `order_number`, `exam_type`
- **API:** `POST /api/v1/admin/clinics`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleCreateClinic()`

### 4.2 تعديل عيادة / Edit Clinic
- **الهدف:** تعديل بيانات عيادة موجودة
- **Purpose:** Update existing clinic data
- **API:** `PATCH /api/v1/admin/clinics/:id`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleUpdateClinic()`

### 4.3 حذف عيادة / Delete Clinic
- **الهدف:** حذف عيادة من النظام
- **Purpose:** Remove clinic from system
- **API:** `DELETE /api/v1/admin/clinics/:id`
- **تحذير:** يؤثر على الطوابير المرتبطة

### 4.4 تفعيل/تعطيل عيادة / Toggle Clinic
- **الهدف:** إيقاف أو تشغيل عيادة مؤقتاً
- **Purpose:** Temporarily enable/disable clinic
- **الآلية:** يُحدّث `is_active` في جدول `clinics`

### 4.5 ترتيب العيادات / Clinic Order
- **الهدف:** تحديد ترتيب ظهور العيادات
- **Purpose:** Set clinic display order
- **الحقل:** `order_number` في جدول `clinics`

### 4.6 أنواع الفحص / Exam Types
- **الأنواع المتاحة (من الكود):**
  - `general` — فحص عام / General Exam
  - `periodic` — فحص دوري / Periodic Exam
  - `pre_employment` — فحص ما قبل التوظيف / Pre-Employment
  - `fitness` — فحص اللياقة / Fitness Exam
  - `specialized` — فحص تخصصي / Specialized Exam
  - `follow_up` — متابعة / Follow-up
  - `emergency` — طوارئ / Emergency
- **موقع الكود:** `AdminDashboardV2.jsx` السطر 2015-2021

---

## 5. نظام المسارات
## 5. Routes System

> **الجدول:** `routes` | **السجلات الحالية:** 8 | **الأعمدة:** 8

### 5.1 إنشاء مسار / Create Route
- **الهدف:** تحديد مسار فحص يمر بعدة عيادات
- **Purpose:** Define multi-clinic examination path
- **الحقول:** `route_name`, `clinics` (مصفوفة), `is_active`, `order`
- **موقع الكود:** `AdminDashboardV2.jsx` → `handleCreateRoute()` السطر 2080

### 5.2 تعديل مسار / Edit Route
- **الهدف:** تعديل عيادات أو ترتيب مسار موجود
- **Purpose:** Modify route clinics or order
- **موقع الكود:** `AdminDashboardV2.jsx` السطر 2097

### 5.3 تفعيل/تعطيل مسار / Toggle Route
- **الهدف:** إيقاف أو تشغيل مسار
- **Purpose:** Enable/disable a route
- **الآلية:** يُحدّث `is_active` في جدول `routes`

### 5.4 مسارات المرضى / Patient Routes
- **الجدول:** `patient_routes` | **السجلات:** 35
- **الهدف:** تتبع تقدم كل مريض في مساره
- **Purpose:** Track each patient's route progress

---

## 6. توجيه الطوابق
## 6. Floor Directions

> **الجدول:** `floor_directions` | **السجلات الحالية:** 3 | **الأعمدة:** 11

### 6.1 إضافة توجيه / Add Direction
- **الهدف:** إضافة تعليمات توجيه لطابق محدد
- **Purpose:** Add floor navigation instructions
- **الحقول:** `floor_number`, `direction_ar`, `direction_en`, `icon`, `is_active`

### 6.2 تعديل توجيه / Edit Direction
- **الهدف:** تعديل نص أو أيقونة التوجيه
- **Purpose:** Update direction text or icon
- **موقع الكود:** `AdminDashboardV2.jsx` السطر 2524

### 6.3 تفعيل/تعطيل توجيه / Toggle Direction
- **الهدف:** إخفاء أو إظهار توجيه طابق
- **Purpose:** Show/hide floor direction

---

## 7. نظام الإشعارات
## 7. Notifications System

> **الجدول:** `notifications` | **السجلات:** 2 | **الأعمدة:** 23  
> **الجدول:** `operational_notifications` | **السجلات:** 7 | **الأعمدة:** 20

### 7.1 إنشاء إشعار / Create Notification
- **الهدف:** إرسال إشعار لمجموعة مستخدمين
- **Purpose:** Send notification to user group
- **API:** `POST /api/v1/admin/notifications`
- **الحقول:** `title_ar`, `title_en`, `message_ar`, `message_en`, `type`, `target_audience`

### 7.2 إشعارات تشغيلية / Operational Notifications
- **الهدف:** إشعارات تلقائية عند أحداث النظام
- **Purpose:** Auto-notifications on system events
- **الجدول:** `operational_notifications`

### 7.3 الإشعارات المتقدمة / Advanced Notifications
- **المكوّن:** `AdvancedNotificationsManager`
- **الهدف:** إدارة متقدمة للإشعارات مع جدولة وتصفية
- **موقع الكود:** `src/components/AdvancedNotificationsManager.jsx`

### 7.4 تفعيل/تعطيل الإشعارات / Toggle Notifications
- **الإعداد:** `notifications_enabled` في جدول `settings`

### 7.5 إشعارات الإدارة V2 / Admin Notifications V2
- **المكوّن:** `NotificationsManagementV2`
- **موقع الكود:** `src/components/NotificationsManagementV2.jsx`

---

## 8. إدارة المستخدمين
## 8. Users Management

> **الجدول:** `admins` | **السجلات:** 2 | **الأعمدة:** 10  
> **الجدول:** `users` | **السجلات:** 2 | **الأعمدة:** 11

### 8.1 الأدوار المتاحة / Available Roles
| الدور | المعرف | الصلاحيات |
|-------|--------|-----------|
| مدير عام | `SUPER_ADMIN` | كامل الصلاحيات |
| مدير | `ADMIN` | إدارة النظام |
| طبيب | `DOCTOR` | إدارة عيادته |
| موظف استقبال | `RECEPTIONIST` | الطابور والأرقام |

- **موقع الكود:** `src/lib/auth-service.js` السطر 11

### 8.2 إضافة مستخدم / Add User
- **الهدف:** إضافة مستخدم جديد بصلاحيات محددة
- **Purpose:** Add new user with specific permissions
- **API:** `POST /api/v1/admin/users`
- **الحقول:** `username`, `password`, `role`, `clinic_id` (للطبيب), `is_active`

### 8.3 تعديل مستخدم / Edit User
- **API:** `PATCH /api/v1/admin/users/:id`

### 8.4 حذف مستخدم / Delete User
- **API:** `DELETE /api/v1/admin/users/:id`

### 8.5 تفعيل/تعطيل مستخدم / Toggle User
- **الهدف:** إيقاف وصول مستخدم مؤقتاً
- **Purpose:** Temporarily disable user access

### 8.6 منع تكرار الجهاز / Device Duplicate Prevention
- **الجدول:** `device_logins` | **السجلات:** 25
- **الإعداد:** `prevent_duplicate_device_daily` في `settings`
- **الآلية:** `generateDeviceFingerprint()` في `supabase-client.js` السطر 230

---

## 9. التقارير والإحصائيات
## 9. Reports & Statistics

### 9.1 تقارير يومية / Daily Reports
- **المكوّن:** `ReportsSection`
- **البيانات:** من `daily_activity_logs` (89 سجل)
- **API:** `GET /api/v1/admin/reports/stats`

### 9.2 سجل النشاطات / Activity Log
- **الجدول:** `activity_logs` | **السجلات:** 20
- **API:** `GET /api/v1/admin/activity-log`
- **المكوّن:** `ActivityLog`

### 9.3 السجل اليومي التفصيلي / Daily Detail Log
- **الجدول:** `daily_activity_logs` | **السجلات:** 89

### 9.4 تصدير التقارير / Export Reports
- **الصيغ:** CSV, JSON (من `BackupExport`)
- **المكوّن:** `BackupExport`

---

## 10. الإعدادات
## 10. Settings

> **الجدول:** `settings` | **السجلات:** 23 | **الأعمدة:** 8  
> **موقع الكود:** `AdminDashboardV2.jsx` → `updateSetting(key, value)`

| مفتاح الإعداد | الوصف | القيمة الافتراضية |
|--------------|-------|------------------|
| `center_name` | اسم المركز الطبي | اللجنة الطبية العسكرية |
| `working_hours_end` | وقت انتهاء العمل | - |
| `working_days` | أيام العمل | - |
| `exam_duration` | مدة الفحص بالدقائق | - |
| `max_daily_patients` | الحد الأقصى للمرضى يومياً | - |
| `max_postpones` | الحد الأقصى للترحيلات | - |
| `max_wait_time` | الحد الأقصى لوقت الانتظار | - |
| `queue_skip_time` | وقت تخطي المريض | - |
| `queue_late_time` | وقت اعتبار المريض متأخراً | - |
| `queue_system_enabled` | تفعيل نظام الطابور | `true` |
| `queue_system_visible` | إظهار الطابور للمرضى | `true` |
| `pin_system_enabled` | تفعيل نظام PIN | `true` |
| `pin_system_visible` | إظهار PIN للمرضى | `true` |
| `pin_auto_generate_time` | وقت إصدار PIN تلقائي | - |
| `pin_auto_delete_time` | وقت حذف PIN تلقائي | - |
| `notifications_enabled` | تفعيل الإشعارات | `true` |
| `postpone_enabled` | تفعيل الترحيل | `true` |
| `postpone_wait_minutes` | دقائق الانتظار بعد الترحيل | - |
| `reset_queue_daily` | إعادة تعيين الطابور يومياً | `true` |
| `separate_queue_per_clinic` | طابور منفصل لكل عيادة | `false` |
| `registration_start_time` | وقت بدء التسجيل | - |
| `registration_stop_time` | وقت إيقاف التسجيل | - |
| `registration_closed_message` | رسالة إغلاق التسجيل | - |
| `prevent_duplicate_patient_daily` | منع تسجيل نفس المريض مرتين | `true` |
| `prevent_duplicate_device_daily` | منع نفس الجهاز مرتين | `true` |

---

## 11. سجل النشاطات
## 11. Activity Log

### 11.1 تسجيل تلقائي / Auto Logging
- **الهدف:** تسجيل كل عملية في النظام تلقائياً
- **Purpose:** Auto-log every system operation
- **الدالة:** `logDailyActivity(actionType, details)` في `supabase-client.js` السطر 328
- **أنواع الأحداث المسجلة:** `queue_call`, `queue_complete`, `queue_cancel`, `queue_postpone`, `pin_created`, `route_updated`, `clinic_updated`

### 11.2 عرض السجل / View Log
- **API:** `GET /api/v1/admin/activity-log`
- **المكوّن:** `ActivityLog`

### 11.3 سجل دائم / Permanent Audit
- **الدالة:** `logPermanentAudit(actionType, details)` في `supabase-client.js` السطر 356

---

## 12. النسخ الاحتياطي
## 12. Backup & Export

### 12.1 تصدير البيانات / Export Data
- **المكوّن:** `BackupExport`
- **الصيغ:** JSON, CSV
- **البيانات:** العيادات، الطابور، الأرقام السرية، الإعدادات

### 12.2 استيراد البيانات / Import Data
- **الهدف:** استعادة بيانات من نسخة احتياطية
- **Purpose:** Restore data from backup

### 12.3 نسخ قاعدة البيانات / DB Backup
- **الرابط:** https://supabase.com/dashboard/project/rujwuruuosffcxazymit

---

## 13. وضع أوفلاين
## 13. Offline Mode

### 13.1 الكشف التلقائي / Auto Detection
- **الهدف:** الكشف التلقائي عن انقطاع الاتصال
- **Purpose:** Auto-detect connection loss
- **المكوّن:** `OfflineSettings`
- **الآلية:** `navigator.onLine` + Supabase connection check

### 13.2 التخزين المؤقت / Local Cache
- **الهدف:** حفظ البيانات محلياً للعمل أوفلاين
- **Purpose:** Cache data locally for offline work
- **الآلية:** `localStorage` + IndexedDB

### 13.3 المزامنة عند الاتصال / Sync on Reconnect
- **الهدف:** رفع البيانات المحلية عند عودة الاتصال
- **Purpose:** Upload local data when reconnected

---

## 14. إدارة المحتوى
## 14. Content Management

### 14.1 تعديل النصوص / Edit Texts
- **المكوّن:** `ContentManagement`
- **الهدف:** تعديل نصوص الواجهة بدون تعديل الكود
- **Purpose:** Edit UI texts without code changes

### 14.2 إدارة الصور / Images Management
- **الهدف:** رفع وإدارة صور النظام
- **Purpose:** Upload and manage system images

### 14.3 الرسائل المخصصة / Custom Messages
- **الهدف:** تخصيص رسائل النظام للمرضى
- **Purpose:** Customize patient-facing messages

### 14.4 إعدادات الصفحة الرئيسية / Home Page Settings
- **الهدف:** تعديل محتوى صفحة دخول المرضى
- **Purpose:** Edit patient entry page content

---

## 15. المظهر
## 15. Appearance

### 15.1 الثيمات / Themes
- **المكوّن:** `AppearanceManagement`
- **الثيمات المتاحة (من الكود):**
  - `military-dark` — الثيم العسكري الداكن (الافتراضي)
  - `military-light` — الثيم العسكري الفاتح
  - `blue-professional` — الأزرق المهني
  - `green-medical` — الأخضر الطبي
  - `classic-white` — الكلاسيكي الأبيض

### 15.2 الألوان الأساسية / Primary Colors
- **الألوان الحالية:** `#8A1538` (أحمر عسكري), `#C9A54C` (ذهبي)
- **موقع الكود:** `AdminDashboardV2.jsx` → className patterns

### 15.3 حجم الخط / Font Size
- **الخيارات:** `small`, `medium`, `large`
- **موقع الكود:** `AdminDashboardV2.jsx` السطر 4488

### 15.4 اتجاه النص / Text Direction
- **الافتراضي:** RTL (عربي)
- **عند الإنجليزية:** LTR تلقائياً

### 15.5 الشعار / Logo
- **الملف:** `public/logo.png`
- **يظهر في:** الشريط العلوي، صفحة الدخول، ملفات PDF

---

## 16. قاعدة البيانات
## 16. Database Management

### 16.1 عرض الجداول / View Tables
- **المكوّن:** `DatabaseManagement`
- **الهدف:** عرض إحصاءات الجداول مباشرة
- **Purpose:** View live table statistics

### 16.2 تنظيف البيانات / Data Cleanup
- **الهدف:** حذف السجلات القديمة
- **Purpose:** Delete old records

### 16.3 مراقبة الاتصال / Connection Monitor
- **الدالة:** `startConnectionMonitor()` في `supabase-client.js` السطر 178
- **الفترة:** كل 30 ثانية

### 16.4 إعادة الاتصال / Reconnect
- **الدالة:** `reconnect()` في `supabase-client.js` السطر 159

---

## 17. التحكم بالميزات
## 17. Feature Control

> **المكوّن:** `FeatureControlPanel`  
> **موقع الكود:** `src/components/FeatureControlPanel.jsx`

### الميزات القابلة للتحكم (11 ميزة):

| المعرف | الاسم | الفئة | الوصف |
|--------|-------|-------|-------|
| `queue_system` | نظام الطوابير | core | إدارة أرقام الدور والانتظار |
| `pin_system` | نظام الأرقام السرية | core | إصدار وإدارة أرقام PIN |
| `notifications` | نظام الإشعارات | core | إرسال وإدارة الإشعارات |
| `routes` | نظام المسارات | core | توجيه المراجعين للعيادات |
| `clinics` | إدارة العيادات | management | إضافة وتعديل العيادات |
| `reports` | التقارير | analytics | عرض وتصدير التقارير |
| `statistics` | الإحصائيات | analytics | عرض إحصائيات النظام |
| `realtime_sync` | المزامنة الفورية | system | تحديث البيانات تلقائياً |
| `auto_pin_generate` | إصدار PIN تلقائي | automation | إصدار أرقام PIN يومياً |
| `auto_queue_reset` | إعادة تعيين الدور | automation | إعادة تعيين الأرقام يومياً |
| `duplicate_prevention` | منع التكرار | security | منع تسجيل نفس الرقم مرتين |
| `offline_mode` | وضع أوفلاين | system | العمل بدون اتصال |

---

## 18. مراقبة API
## 18. API Monitor

> **المكوّن:** `APIMonitor`  
> **موقع الكود:** `src/components/APIMonitor.jsx`

### 18.1 مراقبة الطلبات / Request Monitoring
- **الهدف:** عرض حالة كل API endpoint في الوقت الفعلي
- **Purpose:** Show real-time status of all API endpoints

### 18.2 قياس الأداء / Performance Metrics
- **الهدف:** قياس زمن استجابة كل endpoint
- **Purpose:** Measure response time per endpoint

### 18.3 سجل الأخطاء / Error Log
- **الهدف:** تسجيل وعرض أخطاء API
- **Purpose:** Log and display API errors

### 18.4 تنبيهات الأداء / Performance Alerts
- **الهدف:** تنبيه عند تجاوز زمن الاستجابة الحد المقبول
- **Purpose:** Alert when response time exceeds threshold

---

## 19. النظام الذكي
## 19. Smart System

> **المكوّن:** `SmartDiagnosticsPanel`  
> **موقع الكود:** `src/components/SmartDiagnosticsPanel.jsx`  
> **محرك الإصلاح:** `src/lib/smart-repair-engine.js`

### 19.1 التشخيص الحي / Live Diagnostics
- **الهدف:** فحص صحة كل خدمة في الوقت الفعلي
- **Purpose:** Real-time health check for all services
- **الخدمات المفحوصة:** Supabase, API, Network, Storage, Auth, Queue, Pins, Clinics, Settings, Notifications
- **النتيجة الحالية:** 100% صحة (10/10 خدمات OK)

### 19.2 الإصلاح التلقائي / Auto Repair
- **الهدف:** إصلاح الأخطاء تلقائياً بدون تدخل بشري
- **Purpose:** Auto-fix errors without human intervention
- **الخوارزميات:** Circuit Breaker + Retry + Watchdog + Health Check + Error Boundary + Bulkhead

### 19.3 إدارة الذاكرة / Memory Management
- **الملف:** `src/lib/memory-manager.js`
- **العتبات:** 80% تحذير → 90% حذف تلقائي → 95% حذف شامل
- **الخوارزمية:** LRU (Least Recently Used)

### 19.4 سجل الأخطاء الذكي / Smart Error Log
- **الجدول:** `smart_errors_log` | **السجلات:** 1
- **الأعمدة:** `error_id`, `service`, `error_type`, `message`, `severity`, `resolved`, `fix_applied`, `created_at`

### 19.5 سجل الإصلاحات / Fixes Log
- **الجدول:** `smart_fixes_log` | **السجلات:** 1
- **الأعمدة:** `fix_id`, `error_ref`, `fix_type`, `duration_ms`, `success`, `details`, `created_at`

### 19.6 Circuit Breaker States
- **CLOSED:** النظام يعمل طبيعياً
- **OPEN:** توقف الطلبات بسبب تجاوز عتبة الفشل
- **HALF_OPEN:** اختبار الاتصال بعد فترة الانتظار
- **موقع الكود:** `smart-repair-engine.js` → `class CircuitBreaker`

---

## 📊 ملخص إحصائي / Summary Statistics

| المقياس | القيمة |
|---------|--------|
| **إجمالي المزايا الموثقة** | 95+ ميزة |
| **التبويبات في لوحة الإدارة** | 18 تبويب |
| **الميزات القابلة للتحكم** | 11 ميزة |
| **مفاتيح الإعدادات** | 25 مفتاح |
| **أنواع الأدوار** | 4 أدوار |
| **أنواع الفحص** | 7 أنواع |
| **الجداول المستخدمة** | 20+ جدول |
| **API Endpoints** | 21 endpoint |

---

*آخر تحديث: 2026-02-26 | المصدر: كود المشروع الحقيقي*  
*Last Updated: 2026-02-26 | Source: Actual project code*
