# Queue Canonical Contract

**Status:** Active (source of truth for queue naming/state compatibility)  
**Last updated:** 2026-03-17

## 1) Canonical physical relation

- **Canonical physical table:** `public.queues`
- **Compatibility views:**
  - `public.unified_queue` (view over `public.queues`)
  - `public.queue` (legacy view over `public.queues`)

> أي تطوير جديد يجب أن يعتبر `public.queues` هو المصدر الحقيقي الوحيد للكتابة/القراءة.  
> أسماء `unified_queue` و `queue` موجودة فقط للتوافق الخلفي.

Reference migration: `supabase/migrations/20260316093000_queue_canonical_compat.sql`.

## 2) Official supported statuses

### Canonical runtime statuses (preferred for new code)

- `waiting`
- `called`
- `serving`
- `completed`
- `skipped`
- `cancelled`
- `postponed`

### Backward-compatible aliases (read/write accepted, should not be produced by new code)

- `in_service` → canonicalized to `serving`
- `done` → canonicalized to `completed`

## 3) Backward compatibility rules

1. **Do not drop** `public.unified_queue` or `public.queue` views until all clients are migrated.
2. **All migrations/functions/triggers الجديدة** يجب أن تستهدف `public.queues`.
3. إذا كان عميل قديم يكتب `in_service` أو `done`، يتم تحويلها إلى القيم الرسمية (`serving` / `completed`).
4. أي توثيق جديد يجب أن يصف `unified_queue` كـ **compatibility view** وليس جدولًا ماديًا.
5. عند إضافة حالة جديدة مستقبلًا:
   - تُضاف أولًا في check constraint على `public.queues`.
   - تُوثّق هنا في نفس التغيير.
   - تُراجع تأثيراتها على الواجهات القديمة قبل الدمج.

## 4) Pre-merge review checklist (mandatory)

- [ ] جميع الاستعلامات الجديدة (`from`, `insert`, `update`, `delete`) تستهدف `public.queues` كاسم canonical.
- [ ] لا يوجد كود جديد يعتمد على `unified_queue` باعتباره جدولًا ماديًا.
- [ ] الحالات المستخدمة في الكود الجديد من قائمة **Canonical runtime statuses** فقط.
- [ ] أي تعامل مع aliases (`in_service`, `done`) موثق كـ compatibility-only.
- [ ] أي تعديل schema للطابور مرفق معه تحديث لهذه الوثيقة.
- [ ] أي توثيق تشغيلي متأثر تم تحديثه ليطابق هذا العقد المرجعي.

