# FIX-NOTIFICATIONS.md — إصلاح C3: تفعيل الإشعارات الفعلية
> تاريخ الإصلاح: 2026-02-23 | الملف المعدّل: `frontend/src/components/PatientPage.jsx`

---

## 1. ملخص المشكلة

كان نظام الإشعارات يفتقر إلى إطلاق الأحداث التالية:
- **`START_HINT`**: لم يكن يُطلق عند دخول المراجع للعيادة.
- **`NEAR_TURN`**: كان يُطلق فقط عند `position <= 2`، دون استخدام deduplication.
- **`YOUR_TURN`**: كان يُطلق فقط عند `position === 0`، دون deduplication.
- **`STEP_DONE_NEXT`**: لم يكن يُطلق عند الخروج من العيادة.

---

## 2. التغييرات المنفذة

### إضافة آلية منع التكرار (Deduplication)

تم إضافة `sentEventsRef` كـ `React.useRef(new Set())` لتتبع الأحداث المُرسلة ومنع إعادة إرسالها. مفتاح كل حدث يتكون من: `patientId:EVENT_TYPE:clinicId:date`.

```javascript
// ✅ C3-FIX: مفاتيح الأحداث المُرسلة لمنع التكرار (deduplication)
const sentEventsRef = React.useRef(new Set());
```

### إطلاق START_HINT عند دخول العيادة

في دالة `handleEnterClinic`، قبل استدعاء `api.enterQueue`:

```javascript
// ✅ C3-FIX: إطلاق حدث START_HINT عند دخول المراجع للعيادة
const today = new Date().toISOString().split('T')[0];
const startHintKey = `${patientData.id}:START_HINT:${station.id}:${today}`;
if (!sentEventsRef.current.has(startHintKey)) {
  sentEventsRef.current.add(startHintKey);
  eventBus.emit('queue:start_hint', { clinicName: ..., patientId: ... });
}
```

### إطلاق NEAR_TURN و YOUR_TURN في updateQueueStatus

تم توسيع نطاق `NEAR_TURN` ليشمل `position <= 3` وتفعيل deduplication:

```javascript
// ✅ C3-FIX: YOUR_TURN عند position === 0 أو 1
if (positionData.display_number <= 1) {
  const yourTurnKey = `${patientData.id}:YOUR_TURN:${s.id}:${today}`;
  if (!sentEventsRef.current.has(yourTurnKey)) {
    sentEventsRef.current.add(yourTurnKey);
    eventBus.emit('queue:your_turn', { ... });
  }
} else if (positionData.display_number <= 3) {
  // ✅ C3-FIX: NEAR_TURN عند position <= 3
  const nearTurnKey = `${patientData.id}:NEAR_TURN:${s.id}:${today}:${positionData.display_number}`;
  if (!sentEventsRef.current.has(nearTurnKey)) {
    sentEventsRef.current.add(nearTurnKey);
    eventBus.emit('queue:near_turn', { ... });
  }
}
```

### إطلاق STEP_DONE_NEXT عند الخروج من العيادة

في دالة `handleClinicExit`، بعد التحقق من نجاح الخروج:

```javascript
// ✅ C3-FIX: إطلاق حدث STEP_DONE_NEXT عند الخروج من العيادة
const stepDoneKey = `${patientData.id}:STEP_DONE:${station.id}:${stepDoneToday}`;
if (!sentEventsRef.current.has(stepDoneKey)) {
  sentEventsRef.current.add(stepDoneKey);
  eventBus.emit('queue:step_done', { currentClinic: ..., nextClinic: ... });
}
```

---

## 3. جدول الأحداث بعد الإصلاح

| Event | Source File/Function | Trigger Condition | Deduplication Key |
| :--- | :--- | :--- | :--- |
| `queue:start_hint` | `PatientPage.jsx / handleEnterClinic` | عند نجاح دخول المراجع للعيادة | `patientId:START_HINT:clinicId:date` |
| `queue:near_turn` | `PatientPage.jsx / updateQueueStatus` | عند `position <= 3` | `patientId:NEAR_TURN:clinicId:date:position` |
| `queue:your_turn` | `PatientPage.jsx / updateQueueStatus` | عند `position <= 1` | `patientId:YOUR_TURN:clinicId:date` |
| `queue:step_done` | `PatientPage.jsx / handleClinicExit` | عند نجاح الخروج من العيادة | `patientId:STEP_DONE:clinicId:date` |

---

## 4. خطة التراجع (Rollback)

```bash
git revert HEAD
```
