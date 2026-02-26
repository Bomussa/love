# قاعدة البيانات — اللجنة الطبية العسكرية
# Database Reference — Military Medical Committee (MMC-MMS)

> **المشروع / Project:** MMC-MMS — نظام إدارة اللجنة الطبية العسكرية  
> **قاعدة البيانات / Database:** Supabase PostgreSQL  
> **Project ID:** `rujwuruuosffcxazymit`  
> **Project URL:** `https://rujwuruuosffcxazymit.supabase.co`  
> **إجمالي الجداول / Total Tables:** 97  
> **تاريخ التوثيق / Doc Date:** 2026-02-26  

---

## 🔐 بيانات الاتصال / Connection Credentials

| المفتاح / Key | القيمة / Value |
|---|---|
| **Project URL** | `https://rujwuruuosffcxazymit.supabase.co` |
| **Anon Public Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10` |
| **Service Role Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM4NzI2NSwiZXhwIjoyMDc2OTYzMjY1fQ.5PWwdcBXgS1FZhwRonSRgdbnUQuXHl5VeIHvr41yUbs` |
| **JWT Secret** | `p+f1/FIaiDzeNbbHH6n4ArBQ874wj97zr5J7wStzf+67/eWuTCx94clQyONr2rGp2dAuLeqrs3QcOfigMIhJtA==` |
| **Supabase API Key** | `sbp_78e9b4149e5c4f201e980e88f3a5b1408cf20f83` |
| **Dashboard** | `https://supabase.com/dashboard/project/rujwuruuosffcxazymit` |

---

## 📊 إحصاءات قاعدة البيانات / Database Statistics

| الجدول / Table | السجلات / Records | الأعمدة / Cols | الوصف / Description |
|---|---|---|---|
| clinics | 18 | 21 | العيادات والمحطات الطبية |
| unified_queue | 11 | 24 | الطابور الموحد النشط |
| patients | 35 | 11 | بيانات المرضى |
| pins | 18 | 10 | الأرقام السرية للعيادات |
| settings | 23 | 8 | إعدادات النظام |
| routes | 8 | 8 | مسارات الفحص الطبي |
| patient_routes | 35 | 9 | مسارات المرضى الفردية |
| notifications | 2 | 23 | الإشعارات |
| activity_logs | 20 | 8 | سجل النشاطات |
| daily_activity_logs | 89 | 11 | السجل اليومي التفصيلي |
| device_logins | 25 | 7 | تسجيلات دخول الأجهزة |
| admins | 2 | 10 | حسابات المديرين |
| users | 2 | 11 | حسابات المستخدمين |
| floor_directions | 3 | 11 | توجيهات الطوابق |
| operational_notifications | 7 | 20 | الإشعارات التشغيلية |
| events | 4 | 9 | الأحداث |
| system_settings | 6 | 7 | إعدادات النظام المتقدمة |
| smart_errors_log | 1 | 10 | سجل أخطاء النظام الذكي |
| smart_fixes_log | 1 | 8 | سجل إصلاحات النظام الذكي |
| pathways | 2 | 8 | المسارات الطبية |

---

## 🏥 العيادات الحقيقية / Real Clinics (18 عيادة — مستخرجة من قاعدة البيانات)

| الكود | الاسم العربي | English Name | الطابق | النوع |
|---|---|---|---|---|
| PSY | الطب النفسي | Psychiatry | 2 | clinic |
| AUD | قياس السمع | Audiology | 2 | station |
| XR | الأشعة | Radiology | M | station |
| ENT | أنف وأذن وحنجرة | ENT (Ear, Nose & Throat) | 2 | clinic |
| SUR | الجراحة العامة | General Surgery | 2 | clinic |
| LAB | المختبر | Laboratory | M | labs |
| DNT | عيادة الأسنان (فحص فقط) | Dentistry | 2 | clinic |
| INT | عيادة الباطنية | Internal Medicine | 2 | clinic |
| DER | عيادة الجلدية | Dermatology | 2 | clinic |
| BIO | غرفة القياسات الحيوية | Biometrics | 2 | station |
| ECG | غرفة تخطيط القلب | ECG | 2 | station |
| EYE | عيادة العيون | Ophthalmology | 2 | clinic |
| NEURO | عيادة الأعصاب | Neurology Clinic | 2 | clinic |
| F_DER | عيادة الجلدية (نساء) | Dermatology (Women) | 3 | clinic |
| F_EYE | عيادة العيون (نساء) | Ophthalmology (Women) | 3 | clinic |
| F_INT | عيادة الباطنية (نساء) | Internal Medicine (Women) | 3 | clinic |
| clinic_001 | عيادة القلب | Cardiology | 2 | clinic |
| clinic_002 | عيادة العظام والمفاصل | Orthopedics | 2 | clinic |

---

## 📋 هيكل الجداول الرئيسية / Main Tables Schema

### clinics — العيادات
```sql
id                    TEXT PRIMARY KEY          -- كود العيادة (PSY, EYE, ...)
name                  TEXT                      -- الاسم الافتراضي
name_ar               TEXT                      -- الاسم بالعربية
name_en               TEXT                      -- الاسم بالإنجليزية
description           TEXT                      -- الوصف
pin_code              TEXT                      -- الرقم السري الحالي
pin_expires_at        TIMESTAMPTZ               -- انتهاء صلاحية الرقم السري
is_active             BOOLEAN DEFAULT true      -- هل العيادة نشطة
call_interval         INTEGER                   -- فترة الاستدعاء (ثانية)
call_interval_seconds INTEGER                   -- فترة الاستدعاء بالثواني
floor                 TEXT                      -- الطابق (2, 3, M)
category              TEXT                      -- النوع (clinic/station/labs)
gender_constraint     TEXT                      -- قيد الجنس (male/female/null=all)
call_prefix           TEXT                      -- بادئة الاستدعاء
metadata              JSONB                     -- بيانات إضافية
system_enabled        BOOLEAN                   -- تفعيل النظام
exam_duration         INTEGER                   -- مدة الفحص (دقيقة)
late_threshold        INTEGER                   -- حد التأخير (دقيقة)
weight                INTEGER                   -- الأولوية
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

### unified_queue — الطابور الموحد
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
patient_id        TEXT                          -- معرف المريض
patient_name      TEXT                          -- اسم المريض
military_id       TEXT                          -- الرقم العسكري
personal_id       TEXT                          -- الرقم الشخصي
clinic_id         TEXT REFERENCES clinics(id)   -- العيادة المعنية
exam_type         TEXT                          -- نوع الفحص
queue_position    INTEGER                       -- الموقع في الطابور
display_number    INTEGER                       -- الرقم المعروض على الشاشة
queue_number      INTEGER                       -- رقم الطابور الداخلي
status            TEXT                          -- waiting/called/completed/cancelled
queue_date        DATE DEFAULT CURRENT_DATE     -- تاريخ الطابور
entered_at        TIMESTAMPTZ DEFAULT now()     -- وقت الدخول
called_at         TIMESTAMPTZ                   -- وقت الاستدعاء
completed_at      TIMESTAMPTZ                   -- وقت الإكمال
cancelled_at      TIMESTAMPTZ                   -- وقت الإلغاء
qr_code           TEXT                          -- رمز QR
notes             TEXT                          -- ملاحظات
metadata          JSONB                         -- بيانات إضافية
completed_by_pin  TEXT                          -- الرقم السري المستخدم للإكمال
is_priority       BOOLEAN DEFAULT false         -- أولوية مرضى
priority_reason   TEXT                          -- سبب الأولوية
postpone_count    INTEGER DEFAULT 0             -- عدد التأجيلات
is_temporary      BOOLEAN DEFAULT false         -- مؤقت
```

### patients — المرضى
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
patient_id    TEXT UNIQUE                       -- معرف المريض الفريد
gender        TEXT                              -- الجنس (male/female)
session_id    TEXT                              -- معرف الجلسة
login_time    TIMESTAMPTZ                       -- وقت الدخول
status        TEXT                              -- الحالة (active/completed)
military_id   TEXT                              -- الرقم العسكري
personal_id   TEXT                              -- الرقم الشخصي
name          TEXT                              -- الاسم
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
```

### pins — الأرقام السرية
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
clinic_code   TEXT REFERENCES clinics(id)       -- كود العيادة
pin           TEXT NOT NULL                     -- الرقم السري (4-6 أرقام)
generated_at  TIMESTAMPTZ DEFAULT now()         -- وقت التوليد
expires_at    TIMESTAMPTZ                       -- وقت الانتهاء
is_active     BOOLEAN DEFAULT true              -- نشط
used_count    INTEGER DEFAULT 0                 -- عدد الاستخدامات
last_used_at  TIMESTAMPTZ                       -- آخر استخدام
max_uses      INTEGER                           -- الحد الأقصى للاستخدام
created_at    TIMESTAMPTZ DEFAULT now()
```

### settings — الإعدادات
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
key           TEXT UNIQUE NOT NULL              -- مفتاح الإعداد
value         TEXT                              -- القيمة
description   TEXT                              -- الوصف
category      TEXT                              -- الفئة (general/queue/display/...)
is_public     BOOLEAN DEFAULT false             -- عام أم خاص
updated_at    TIMESTAMPTZ DEFAULT now()
updated_by    TEXT                              -- من قام بالتحديث
```

### routes — مسارات الفحص
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
exam_type       TEXT NOT NULL                   -- نوع الفحص (general/special/...)
route_name      TEXT                            -- اسم المسار
clinics         JSONB                           -- قائمة العيادات المرتبة [{"id":"EYE","order":1},...]
order_sequence  INTEGER                         -- ترتيب التسلسل
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### notifications — الإشعارات
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
patient_id        TEXT                          -- المريض المستهدف
clinic_id         TEXT                          -- العيادة المرتبطة
type              TEXT                          -- info/warning/success/error
title             TEXT                          -- عنوان الإشعار
message           TEXT                          -- نص الإشعار
is_read           BOOLEAN DEFAULT false
sent_at           TIMESTAMPTZ DEFAULT now()
read_at           TIMESTAMPTZ
metadata          JSONB
user_id           TEXT
actor_id          TEXT
payload           JSONB
display_position  TEXT                          -- top/bottom/center
display_duration  INTEGER                       -- مدة العرض (ms)
font_size         TEXT
font_color        TEXT
background_color  TEXT
border_color      TEXT
scheduled_at      TIMESTAMPTZ
is_active         BOOLEAN DEFAULT true
created_at        TIMESTAMPTZ DEFAULT now()
```

### smart_errors_log — سجل أخطاء النظام الذكي
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
error_id      TEXT NOT NULL                     -- معرف الخطأ الفريد (err_timestamp)
error_type    TEXT                              -- نوع الخطأ (network/database/ui/...)
severity      TEXT                              -- low/medium/high/critical
message       TEXT                              -- رسالة الخطأ
source        TEXT                              -- مصدر الخطأ (component/function)
stack_trace   TEXT                              -- تتبع المكدس
details       JSONB                             -- تفاصيل إضافية
is_fixed      BOOLEAN DEFAULT false             -- هل تم الإصلاح
occurred_at   TIMESTAMPTZ DEFAULT now()         -- وقت الحدوث
```

### smart_fixes_log — سجل إصلاحات النظام الذكي
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
fix_id          TEXT NOT NULL                   -- معرف الإصلاح (fix_timestamp)
error_id        TEXT                            -- الخطأ المرتبط
strategy        TEXT                            -- استراتيجية الإصلاح
strategy_name   TEXT                            -- اسم الاستراتيجية (Circuit Breaker/Retry/...)
success         BOOLEAN DEFAULT false           -- هل نجح الإصلاح
duration_ms     INTEGER                         -- مدة الإصلاح بالمللي ثانية
applied_at      TIMESTAMPTZ DEFAULT now()       -- وقت التطبيق
```

### admins — المديرون
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
username        TEXT UNIQUE NOT NULL            -- اسم المستخدم
password_hash   TEXT NOT NULL                   -- كلمة المرور (bcrypt)
role            TEXT DEFAULT 'admin'            -- super_admin/admin
full_name       TEXT
email           TEXT
is_active       BOOLEAN DEFAULT true
last_login      TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### floor_directions — توجيهات الطوابق
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
floor_key       TEXT NOT NULL                   -- floor_2/floor_3/floor_M
floor_label_ar  TEXT                            -- اسم الطابق بالعربية
floor_label_en  TEXT                            -- Floor name in English
directions_ar   TEXT                            -- التوجيهات بالعربية
directions_en   TEXT                            -- Directions in English
icon            TEXT                            -- أيقونة الطابق
is_active       BOOLEAN DEFAULT true
sort_order      INTEGER
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### activity_logs — سجل النشاطات
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
action_type     TEXT                            -- نوع الإجراء
description     TEXT                            -- الوصف
user_id         TEXT                            -- المستخدم
metadata        JSONB                           -- بيانات إضافية
ip_address      TEXT                            -- عنوان IP
user_agent      TEXT                            -- متصفح المستخدم
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## 🔒 سياسات الأمان / RLS Policies

| الجدول | السياسة | الوصف |
|---|---|---|
| clinics | SELECT public | قراءة عامة للعيادات النشطة |
| unified_queue | SELECT/INSERT/UPDATE | المرضى يرون طابورهم فقط |
| patients | SELECT/INSERT | المريض يرى بياناته فقط |
| settings | SELECT (is_public=true) | الإعدادات العامة للجميع |
| admins | Service role only | المديرون عبر service role فقط |
| smart_errors_log | anon INSERT + service SELECT | الكتابة للجميع، القراءة للمديرين |
| smart_fixes_log | anon INSERT + service SELECT | الكتابة للجميع، القراءة للمديرين |

---

## 🔧 الدوال المخزنة / Stored Functions (RPCs)

| الدالة | المعاملات | الوصف |
|---|---|---|
| `enter_unified_queue_safe` | patient_id, clinic_id, exam_type | دخول المريض للطابور بأمان مع منع التكرار |
| `verify_clinic_pin` | clinic_id, pin_code | التحقق من صحة الرقم السري للعيادة |
| `get_next_queue_number` | clinic_id, exam_type | الحصول على الرقم التالي في الطابور |

---

## 🔄 طريقة الاتصال / How to Connect

### JavaScript / TypeScript
```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://rujwuruuosffcxazymit.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key
)
// مثال / Example
const { data } = await supabase.from('clinics').select('*').eq('is_active', true)
```

### REST API
```bash
curl 'https://rujwuruuosffcxazymit.supabase.co/rest/v1/clinics?is_active=eq.true' \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ANON_KEY"
```

### لوحة تحكم Supabase / Dashboard
```
https://supabase.com/dashboard/project/rujwuruuosffcxazymit
```

---

## 📁 قائمة الجداول الكاملة / Full Tables List (97 جدول)

```
activity_log, activity_logs, admin_queue_view, admins, api_logs, api_status,
app_contents, app_settings, audit_log, audit_logs, cache_logs, call_engine_state,
chart_data, clinic_counters, clinic_members, clinic_pins, clinic_queue_reservations,
clinic_statistics, clinic_visits, clinics, comprehensive_statistics,
custom_notifications, daily_activity_logs, daily_barcode_usage, daily_queue_counters,
db_column_management, db_policy_management, db_table_management, dead_letter_audit,
dead_letters, dead_letters_actions, device_logins, direct_alerts, error_log, events,
fallback_responses, floor_directions, ip_sessions, kv_admin, kv_cache, kv_events,
kv_locks, kv_pins, kv_queues, notification_settings, notifications,
operation_progress, operation_queue, operational_notifications, organization,
partial_results, pathways, patient_queue_numbers, patient_routes, patient_sessions,
patient_visits, patient_visits_report, patients, permanent_audit_logs, pins, queue,
queue_admin_view, queue_audit, queue_backup_20251101_000000, queue_counters,
queue_history, queue_pending, queue_resettle, queues, rate_limits, reports, roles,
route_steps, routes, scheduler_jobs, sessions, settings, smart_errors_log,
smart_fixes_log, smart_knowledge, smart_metrics, smart_patches, stats_daily,
system_config, system_roles, system_settings, unified_queue, users,
v_clinics_no_name, v_organization_no_name, v_queue, v_queue_no_name,
v_queue_pending_no_name, v_queues, v_users_no_name
```

---

## 🗄️ Migrations

```bash
# إنشاء migration جديد / Create new migration
supabase migration new migration_name

# تطبيق migrations / Apply migrations
supabase db push

# عرض الحالة / Show status
supabase db diff
```

---

*آخر تحديث / Last Updated: 2026-02-26 | بيانات حقيقية مستخرجة من قاعدة البيانات الفعلية*
