# ISSUE-QUEUE-RACE.md — تحليل مشكلة تكرار `display_number`
> تاريخ التحليل: 2026-02-22 | الملف المصدر: `love-api/api/v1.js`

---

## 1. تحليل توليد `display_number`

يتم توليد `display_number` في دالة `getNextDisplayNumber` داخل `love-api/api/v1.js`. الآلية كالتالي:

1.  يتم جلب آخر سجل من `unified_queue` للعيادة المحددة، مرتباً تنازلياً حسب `display_number`.
2.  إذا لم توجد سجلات، أو كان تاريخ آخر سجل ليس اليوم، يتم إرجاع `1`.
3.  وإلا، يتم إرجاع `display_number` لآخر سجل + 1.

```javascript
// love-api/api/v1.js (السطور 62-71)

async function getNextDisplayNumber(clinicId) {
  const today = new Date().toISOString().split("T")[0];
  const data = await supabaseRequest(`unified_queue?clinic_id=eq.${clinicId}&order=display_number.desc&limit=1`);
  
  if (data.length === 0) return 1;
  const lastEntryDate = new Date(data[0].entered_at).toISOString().split("T")[0];
  if (lastEntryDate !== today) return 1;
  
  return (data[0].display_number || 0) + 1;
}
```

## 2. تحديد خطر التكرار (Race Condition)

**نعم، يوجد خطر كبير لحدوث تكرار (Race Condition).**

العملية ليست ذرية (not atomic). إذا قام مستخدمان باستدعاء هذه الدالة في نفس الوقت تقريباً، يمكن أن تحدث المشكلة التالية:

1.  **الطلب 1** يقرأ آخر `display_number` وليكن `10`.
2.  **الطلب 2** يقرأ آخر `display_number` وهو لا يزال `10` (لأن الطلب 1 لم يقم بالكتابة بعد).
3.  **الطلب 1** يحسب الرقم التالي `11` ويقوم بإضافته إلى قاعدة البيانات.
4.  **الطلب 2** يحسب الرقم التالي `11` ويقوم بإضافته إلى قاعدة البيانات.

**النتيجة:** لدينا سجلان بنفس `display_number` (`11`).

## 3. هل يوجد RPC atomic أو Fallback؟

-   **RPC Atomic:** لا يوجد استدعاء لأي دالة RPC (Remote Procedure Call) ذرية في `getNextDisplayNumber`.
-   **Fallback:** لا يوجد أي آلية احتياطية (fallback) غير ذرية، فالآلية المستخدمة هي بطبيعتها غير ذرية.

## 4. الاستنتاج

آلية توليد `display_number` الحالية غير آمنة وتعتبر مصدراً محتملاً لتكرار الأرقام تحت ضغط الاستخدام المتزامن. الحل الأمثل هو إنشاء دالة RPC ذرية في Supabase تتولى عملية جلب الرقم التالي وإضافته في خطوة واحدة لضمان عدم التكرار.
