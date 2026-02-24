# FIX-QUEUE-ATOMIC.md — إصلاح C6: ضمان ذرية توليد display_number
> تاريخ الإصلاح: 2026-02-23 | الملف المعدّل: `love-api/api/v1.js`

---

## 1. المشكلة المُثبتة (Root Cause)

دالة `getNextDisplayNumber` في `api/v1.js` (السطور 62-71) كانت تستخدم نمط **Read-Then-Write** غير الذري:

```javascript
// ❌ غير ذري - خطر التزامن
async function getNextDisplayNumber(clinicId) {
  const data = await supabaseRequest(`unified_queue?...&order=display_number.desc&limit=1`);
  // ← هنا يمكن لطلب آخر أن يقرأ نفس القيمة قبل الكتابة
  return (data[0].display_number || 0) + 1;
}
```

في حالة وصول طلبين متزامنين، كلاهما يقرأ `display_number = 5` ويكتب `6`، مما يؤدي إلى تكرار.

---

## 2. الإصلاح المنفذ

تم استبدال `getNextDisplayNumber` بـ RPC ذرية `get_next_queue_number` في نقطة `/api/v1/queue/enter`:

```javascript
// ✅ ذري - آمن من التزامن
const rpcResult = await supabaseRPC('get_next_queue_number', {
  p_patient_id: patientId,
  p_clinic_id: clinicId,
  p_exam_type: body.examType || 'general'
});
displayNumber = rpcResult || 1;
```

### إضافة فحص منع التكرار

تم إضافة فحص مسبق لمنع إدخال نفس المراجع في نفس العيادة في نفس اليوم:

```javascript
const existing = await supabaseRequest(
  `unified_queue?clinic_id=eq.${clinicId}&patient_id=eq.${patientId}&entered_at=gte.${today}T00:00:00&status=neq.completed&limit=1`
);
if (existing.length > 0) {
  return sendResponse({ ...existing[0], already_in_queue: true });
}
```

---

## 3. خطة التراجع (Rollback)

```bash
git revert HEAD
```
