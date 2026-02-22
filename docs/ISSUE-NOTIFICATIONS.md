# ISSUE-NOTIFICATIONS.md — تحليل نظام الإشعارات ومصدر الأحداث
> تاريخ التحليل: 2026-02-22 | الملفات المصدر: `frontend/src/core/notification-engine.js`, `frontend/src/components/PatientPage.jsx`

---

## 1. تأكيد وظائف `notification-engine.js`

بعد مراجعة الكود في `frontend/src/core/notification-engine.js`, تم تأكيد النقاط التالية:

-   **استخدام `eventBus` listeners:** نعم، الملف يستمع للأحداث التالية:
    -   `queue:near_turn`
    -   `queue:your_turn`
    -   `queue:step_done`
    -   بالإضافة إلى أحداث النظام العامة مثل `system:reset` و `clinic:opened`.

-   **استخدام `localStorage`:** نعم، يتم استخدام `localStorage` لحفظ وتحميل الإشعارات عبر الدوال التالية:
    -   `saveToStorage(patientId)`
    -   `loadFromStorage(patientId)`
    -   `loadAdminNotifications()`
    -   `saveAllNotifications()`

-   **استخدام `setInterval`:** نعم، يتم استخدام `setInterval` كل 30 ثانية (`30000` ms) داخل دالة `startNotificationSync` لاستدعاء `syncNotifications` التي بدورها تحفظ الإشعارات محلياً.

---

## 2. تحديد مصدر الأحداث (Event Source)

الملف `notification-engine.js` هو **مستقبل** للأحداث وليس مصدرها. المصدر الفعلي الذي يقرأ حالة الطابور ويطلق هذه الأحداث هو مكون واجهة المستخدم الذي يتتبع حالة المراجع.

من خلال تحليل المشروع، تم تحديد أن **`frontend/src/components/PatientPage.jsx`** هو المصدر الرئيسي للأحداث المتعلقة بحالة المراجع في الطابور.

### كيف يتم ذلك؟

1.  **مراقبة مستمرة:** `PatientPage.jsx` يحتوي على دالة `updateQueueStatus` التي يتم استدعاؤها بشكل دوري (`setInterval`) وكلما حدث تغيير.
2.  **جلب البيانات:** داخل `updateQueueStatus`, يتم استدعاء `api.getQueuePosition` لجلب بيانات المراجع الحالية، بما في ذلك `position` (موقعه في الطابور) و `status`.
3.  **حساب قرب الدور:** يتم حساب `isNearTurn` بناءً على `position` (e.g., `position > 1 && position <= 3`).
4.  **إطلاق الأحداث:** بناءً على البيانات المستلمة، يتم إطلاق الأحداث المناسبة باستخدام `eventBus.emit()`.

---

## 3. جدول تحليل مصدر الأحداث

| Event (الحدث) | Source File/Function (الملف/الدالة المصدر) | Trigger Condition (شرط الإطلاق) | UI Output (الناتج في الواجهة) |
| :--- | :--- | :--- | :--- |
| `queue:near_turn` | `PatientPage.jsx` / `updateQueueStatus` | `position > 1 && position <= 3` (عندما يكون دور المراجع قريبًا) | `toast.success('يقترب دورك...')` |
| `queue:your_turn` | `PatientPage.jsx` / `updateQueueStatus` | `position === 1` (عندما يصبح دور المراجع هو التالي) | `toast.loading('الآن دورك...')` + اهتزاز وصوت |
| `queue:step_done` | `PatientPage.jsx` / `handleExitClinic` | عند نجاح الخروج من عيادة والانتقال للتالية (`exitResult.success && exitResult.nextClinic`) | `toast.success('تم إنهاء الفحص، توجه إلى...')` |
| `START_HINT` | `PatientPage.jsx` / `handleEnterClinic` | عند نجاح دخول المراجع للعيادة لأول مرة (`enterResult.success`) | لا يوجد إطلاق مباشر لهذا الحدث بالاسم، ولكن يتم عرض معلومات الدور. |

---

## 4. استنتاج

-   نظام الإشعارات يعتمد على `PatientPage.jsx` كمحرك أساسي لإطلاق الأحداث بناءً على استطلاعات دورية (polling) لحالة الطابور عبر الـAPI.
-   `notification-engine.js` يعمل كطبقة عرض (presentation layer) لهذه الأحداث، حيث يقوم بإظهار الإشعارات للمستخدم.
-   المنطق موجود، ولكنه قد لا يكون فعالاً إذا كان هناك تأخير في استجابة الـAPI أو إذا توقف `setInterval` لأي سبب. الإصلاح يجب أن يركز على جعل هذا الربط أكثر موثوقية وضمان إطلاق الأحداث في الوقت الفعلي عند حدوث التغيير الفعلي في `AdminDashboardV2.jsx` أو من خلال `Supabase Realtime`time.
