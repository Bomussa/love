# سياسة الأمان / Security Policy

## الإصدارات المدعومة / Supported Versions

| الإصدار / Version | مدعوم / Supported |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## الإبلاغ عن ثغرة أمنية / Reporting a Vulnerability

إذا اكتشفت ثغرة أمنية في هذا المشروع، يرجى الإبلاغ عنها بشكل مسؤول:

1. **لا تنشر الثغرة علناً**.
2. أرسل تقريراً إلى: **security@[domain].com**.
3. قدم وصفاً تفصيلياً مع خطوات إعادة الإنتاج.
4. سنرد خلال 48 ساعة.

## مصفوفة الحماية (Endpoint -> Table/View -> Required Policy)

> ملاحظة: هذه المصفوفة تغطي Supabase Edge Functions في هذا المستودع.

| Endpoint | Table / View / RPC | Required Policy / Authorization |
|---|---|---|
| `pin-generate` | `pins` (INSERT) | `pins_insert_admin_only` (`is_admin_actor()` + JWT role claims/roles table) |
| `pin-verify` | `pins` (SELECT/UPDATE) | `pins_select_admin_only` + `pins_update_admin_only` |
| `pin-status` | `pins` (SELECT) | `pins_select_admin_only` |
| `queue-enter` | `system_config` (SELECT), `clinics` (SELECT), `enter_queue_safe` RPC | operator/admin via `is_admin_actor()` أو تنفيذ عبر service role |
| `queue-call` | `queues` (SELECT/UPDATE), `notifications` (INSERT), `audit_log` (INSERT), `call_next_patient_safe` RPC | `queues_update_admin_only`, `notifications_insert_admin_only`, `audit_insert_auth` |
| `queue-engine` | `system_config`, `clinics`, `queues`, `audit_log`, `enter_queue_safe/call_next_patient_safe/complete_exam_safe` RPC | service role فقط للإجراءات التشغيلية |
| `reports-daily` | `vw_daily_activity` (SELECT) | قراءة مصرح بها للمشغّل/الإدارة |
| `stats-dashboard` | `vw_today_now`, `vw_clinic_performance` (SELECT) | قراءة مصرح بها للمشغّل/الإدارة |
| `functions-proxy` -> `notifications/poll` | `notifications` (SELECT) | `notifications_select_related_or_admin` |
| `functions-proxy` -> queue routes | `queues` / RPC (`queue_create`, `queue_enter`, `queue_leave`) | `queues_select_related_or_admin` + تنفيذ RPC آمن |
| `login` | `admin_users` (SELECT) | سياسات الإدارة فقط (غير متاح للعامة) |

## مراجعة أمنية لعمليات INSERT/UPDATE/DELETE (الجداول الحرجة)

### 1) `queues`
- **INSERT**: مسموح فقط للمستخدم المرتبط بنفس `patient_id` أو للإدارة (`queues_insert_related_or_admin`).
- **UPDATE**: **إدارة فقط** (`queues_update_admin_only`).
- **DELETE**: **إدارة فقط** (`queues_delete_admin_only`).
- **مخاطر تم تخفيفها**: العبث بالأدوار، تعديل حالة الطابور من مستخدم عادي، حذف سجلات تشغيلية.

### 2) `patients`
- **INSERT/UPDATE**: المريض على سجله فقط أو الإدارة (`patients_insert_self_or_admin`, `patients_update_self_or_admin`).
- **DELETE**: غير مفعّل بسياسة عامة (يفضّل أن يبقى إدارة فقط عند الحاجة التشغيلية).
- **مخاطر تم تخفيفها**: انتحال هوية مريض آخر/تعديل بياناته.

### 3) `notifications`
- **INSERT**: إدارة/مشغّل فقط (`notifications_insert_admin_only`).
- **UPDATE**: المريض على إشعاراته أو الإدارة (`notifications_update_related_or_admin`).
- **DELETE**: إدارة فقط (`notifications_delete_admin_only`).
- **مخاطر تم تخفيفها**: إرسال إشعارات مزيفة أو مسح إشعارات النظام من طرف غير مخوّل.

### 4) `system_settings`
- **SELECT/INSERT/UPDATE/DELETE**: إدارة فقط (`system_settings_*_admin_only`).
- **مخاطر تم تخفيفها**: تعطيل النظام/تغيير إعدادات حساسة (Kill Switch / limits) من حساب غير إداري.

## ضوابط إضافية موصى بها
- تفعيل `FORCE ROW LEVEL SECURITY` على الجداول الحرجة في الإنتاج.
- منع استخدام `anon` في عمليات الإدارة، والاكتفاء بـ service role أو JWT إداري موثوق.
- تفعيل مراقبة دورية على `audit_log` مع تنبيهات عند محاولات DML فاشلة.
- مراجعة جميع RPC القديمة (`queue_*`) والتأكد من كونها `SECURITY DEFINER` مع تحقق صلاحيات داخلي.
