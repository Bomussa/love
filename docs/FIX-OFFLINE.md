# FIX-OFFLINE.md — إصلاح C4: تنفيذ sendToServer الحقيقي
> تاريخ الإصلاح: 2026-02-23 | الملف المعدّل: `frontend/src/lib/offline-manager.js`

---

## 1. ملخص التغييرات

### C4-FIX 1: تنفيذ sendToServer بدون placeholder

**قبل:** كانت `sendToServer` ترجع `{ success: true }` إذا لم تجد `api.syncOperation`.

**بعد:** تحاول استدعاء النقطة المناسبة مباشرة عبر `fetch` بناءً على نوع العملية والـ store.

```javascript
getEndpointForOperation(item) {
  const BASE_URL = '/api/v1';
  const storeToPath = { queue: 'queue', patients: 'patients', clinics: 'clinics' };
  const path = storeToPath[item.store];
  if (!path) return null;
  if (item.operation === 'create') return { url: `${BASE_URL}/${path}`, method: 'POST' };
  if (item.operation === 'update' && item.data?.id) return { url: `${BASE_URL}/${path}/${item.data.id}`, method: 'PATCH' };
  if (item.operation === 'delete' && item.data?.id) return { url: `${BASE_URL}/${path}/${item.data.id}`, method: 'DELETE' };
  return null;
}
```

### C4-FIX 2: Retry مع Backoff ثابت

**قبل:** كانت تحذف العملية بعد 3 محاولات فاشلة.

**بعد:** تطبيق backoff ثابت (2s ثم 4s ثم 6s) مع حفظ `retry_count`:

| المحاولة | الانتظار | الإجراء عند الفشل |
| :--- | :--- | :--- |
| 1 | 2 ثانية | حفظ `retry_count=1` |
| 2 | 4 ثانية | حفظ `retry_count=2` |
| 3 | 6 ثانية | وضع `failed=true` وعدم الحذف |

### C4-FIX 3: Failed Flag بدلاً من الحذف

**قبل:** كانت تحذف العملية من `sync_queue` عند الفشل النهائي.

**بعد:** تضع `failed=true` و `failed_at` و `last_error` وتُبقي العملية في `sync_queue`:

```javascript
await this.saveLocal('sync_queue', {
  ...item,
  failed: true,
  failed_at: new Date().toISOString(),
  last_error: result.error
});
```

### C4-FIX 4: تجاهل العناصر الفاشلة في sync

```javascript
const activeItems = pendingItems.filter(item => !item.failed);
```

---

## 2. خطة التراجع (Rollback)

```bash
git revert HEAD
```
