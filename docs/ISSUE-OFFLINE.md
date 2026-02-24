# ISSUE-OFFLINE.md — تحليل آلية المزامنة في وضع عدم الاتصال
> تاريخ التحليل: 2026-02-22 | الملف المصدر: `frontend/src/lib/offline-manager.js`

---

## 1. تأكيد سلوك `sendToServer`

تم التحقق من دالة `sendToServer` في `offline-manager.js`. الدالة تحاول استيراد `api-unified.js` ديناميكياً واستدعاء `api.syncOperation(item)`. في حالة فشل الاستيراد أو عدم وجود الدالة، فإنها **تعيد `{ success: true }` كقيمة افتراضية (placeholder)**، مما يؤكد السلوك المذكور في المواصفات.

```javascript
// frontend/src/lib/offline-manager.js (السطور 172-185)

async sendToServer(item) {
  try {
    const { default: api } = await import("./api-unified");
    if (api && typeof api.syncOperation === "function") {
      return await api.syncOperation(item);
    }
    console.warn("[OfflineManager] api.syncOperation not found, using fallback");
    return { success: true }; // <-- سلوك الـ Placeholder
  } catch (e) {
    console.error("[OfflineManager] sendToServer error:", e);
    return { success: false, error: e.message };
  }
}
```

---

## 2. تحديد العمليات في `sync_queue`

لم يتم العثور على أي استدعاءات لدالة `offlineManager.addToSyncQueue()` في قاعدة الكود الحالية. هذا يعني أنه **لا توجد حالياً أي عمليات (create/update/delete) يتم إضافتها إلى طابور المزامنة**. النظام مهيأ للعمل في وضع عدم الاتصال، ولكن لا توجد أي أجزاء من التطبيق تستخدم هذه الميزة فعلياً.

---

## 3. تحديد نقاط استدعاء `offlineManager.sync()`

يتم استدعاء دالة `sync()` في حالتين:

1.  **فوراً عند إضافة عملية جديدة:** داخل `addToSyncQueue`، إذا كان المتصفح متصلاً بالإنترنت (`this.isOnline`).
2.  **عند استعادة الاتصال:** يتم استدعاؤها تلقائياً عند حدوث حدث `online` في المتصفح.

---

## 4. تحليل `api-unified.js`

الملف `api-unified.js` موجود ويحتوي على دالة `syncOperation`. هذه الدالة مصممة لاستقبال العمليات من `offline-manager` وتوجيهها إلى نقاط النهاية (endpoints) المناسبة في الواجهة الخلفية. ومع ذلك، بما أنه لا يتم استدعاء `addToSyncQueue` في أي مكان، فإن دالة `syncOperation` لا يتم تفعيلها أبداً.

---

## 5. جدول تحليل عمليات المزامنة (نظري)

بما أنه لا توجد عمليات فعلية، هذا الجدول يوضح كيف **يُفترض** أن يعمل النظام بناءً على الكود الموجود.

| OperationType (نوع العملية) | Payload (البيانات) | Server Endpoint used (نقطة النهاية المستخدمة) | Idempotency key (مفتاح التكرار) |
| :--- | :--- | :--- | :--- |
| `create` | `item.data` | `/api/v1/{item.store}` (POST) | `item.data.id` (إذا كان UUID من طرف العميل) |
| `update` | `item.data` | `/api/v1/{item.store}/{item.data.id}` (PATCH) | `item.data.id` | 
| `delete` | `item.data` | `/api/v1/{item.store}/{item.data.id}` (DELETE) | `item.data.id` |

**ملاحظة:** مفتاح منع تكرار العمليات (Idempotency key) غير مطبق بشكل صريح في الكود الحالي، ولكن يمكن اعتباره `item.data.id` إذا تم إنشاؤه من طرف العميل (client-side UUID).
