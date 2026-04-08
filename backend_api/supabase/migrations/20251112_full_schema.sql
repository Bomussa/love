-- MMC-MMS Supabase canonical schema (November 2025)
-- هذا الملف شامل لإنشاء جميع الجداول الأساسية والأنواع والفهارس المطلوبة
-- للتشغيل: انسخ المحتوى بالكامل إلى محرر SQL داخل Supabase ونفِّذه دفعة واحدة.
-- ملاحظة: لا نستخدم BEGIN/COMMIT لضمان إمكانية إضافة قيم Enum جديدة خارج المعاملات الضمنية.

-- 1) التوسعات المطلوبة لتوليد UUID والتعامل مع JSON
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 2) الأنواع (Enums)
-- حالة الدور
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
        CREATE TYPE public.queue_status AS ENUM (
            'waiting',      -- بانتظار النداء
            'called',       -- تم النداء ولم يصل بعد
            'in_progress',  -- تسمية قديمة لبعض البيئات الإنتاجية
            'in_service',   -- قيد الخدمة داخل العيادة
            'completed',    -- أنهى الخدمة في العيادة
            'cancelled',    -- أُلغي الدور (بقرار إداري)
            'no_show'       -- لم يحضر بعد النداء
        );
    END IF;
END$$;

-- تأكد من توفر جميع القيم المطلوبة في enum حتى إذا كان موجوداً مسبقاً
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'queue_status' AND e.enumlabel = 'in_progress') THEN
            ALTER TYPE public.queue_status ADD VALUE 'in_progress';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'queue_status' AND e.enumlabel = 'in_service') THEN
            ALTER TYPE public.queue_status ADD VALUE 'in_service';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'queue_status' AND e.enumlabel = 'cancelled') THEN
            ALTER TYPE public.queue_status ADD VALUE 'cancelled';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'queue_status' AND e.enumlabel = 'no_show') THEN
            ALTER TYPE public.queue_status ADD VALUE 'no_show';
        END IF;
    END IF;
END$$;

-- نوع الجنس للمراجع
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE public.gender_type AS ENUM ('male', 'female');
    END IF;
END$$;

-- 3) دوال مساعدة للتحديث التلقائي لحقل updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- 4) جدول العيادات والمراكز الطبية
create table if not exists public.clinics (
    id                text primary key,
    name_en           text not null,
    name_ar           text not null,
    floor             text not null,
    category          text not null default 'clinic',
    gender_constraint text not null default 'mixed',
    call_prefix       text,
    call_interval_seconds integer not null default 60,
    is_active         boolean not null default true,
    metadata          jsonb not null default '{}',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

alter table public.clinics
    add column if not exists name_en text,
    add column if not exists name_ar text,
    add column if not exists floor text,
    add column if not exists category text,
    add column if not exists gender_constraint text,
    add column if not exists call_prefix text,
    add column if not exists call_interval_seconds integer,
    add column if not exists is_active boolean,
    add column if not exists metadata jsonb,
    add column if not exists created_at timestamptz,
    add column if not exists updated_at timestamptz;

update public.clinics
set
    name_en = coalesce(name_en, name_ar, id),
    name_ar = coalesce(name_ar, name_en, id),
    floor = coalesce(floor, '1'),
    category = coalesce(category, 'clinic'),
    gender_constraint = coalesce(gender_constraint, 'mixed'),
    call_interval_seconds = coalesce(call_interval_seconds, 60),
    is_active = coalesce(is_active, true),
    metadata = coalesce(metadata, '{}'::jsonb)
where true;

create trigger trg_clinics_touch
before update on public.clinics
for each row execute function public.touch_updated_at();

-- 5) عدادات التذاكر اليومية لكل عيادة
create table if not exists public.clinic_counters (
    clinic_id   text not null references public.clinics(id) on delete cascade,
    counter_day date not null default current_date,
    last_value  integer not null default 0,
    updated_at  timestamptz not null default now(),
    primary key (clinic_id, counter_day)
);
create trigger trg_clinic_counters_touch
before update on public.clinic_counters
for each row execute function public.touch_updated_at();

-- 6) أكواد الـ PIN اليومية لكل عيادة
create table if not exists public.clinic_pins (
    id          uuid primary key default gen_random_uuid(),
    clinic_id   text not null references public.clinics(id) on delete cascade,
    pin         text not null,
    valid_day   date not null,
    active      boolean not null default true,
    generated_by text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    expires_at  timestamptz,
    metadata    jsonb not null default '{}',
    unique (clinic_id, valid_day)
);
create index if not exists idx_clinic_pins_active_day on public.clinic_pins(clinic_id, valid_day, active);
create trigger trg_clinic_pins_touch
before update on public.clinic_pins
for each row execute function public.touch_updated_at();

-- 7) بيانات المراجعين
create table if not exists public.patients (
    id           uuid primary key default gen_random_uuid(),
    patient_id   text not null unique,
    full_name    text,
    gender       gender_type not null,
    date_of_birth date,
    phone_number text,
    status       text not null default 'active',
    last_visit_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    metadata     jsonb not null default '{}'
);
create trigger trg_patients_touch
before update on public.patients
for each row execute function public.touch_updated_at();

-- 8) الجلسات النشطة (تستخدمها دوال Supabase Edge)
create table if not exists public.patient_sessions (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid not null references public.patients(id) on delete cascade,
    token       text not null unique,
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now(),
    last_seen_at timestamptz,
    revoked_at  timestamptz,
    ip_address  inet,
    user_agent  text
);
create index if not exists idx_patient_sessions_patient on public.patient_sessions(patient_id);
create index if not exists idx_patient_sessions_active on public.patient_sessions(token) where revoked_at is null;

-- 9) طابور الانتظار الرئيسي
create table if not exists public.queue (
    id               uuid primary key default gen_random_uuid(),
    clinic_id        text not null references public.clinics(id) on delete cascade,
    patient_id       uuid not null references public.patients(id) on delete cascade,
    patient_identifier text not null,
    patient_name     text,
    exam_type        text not null,
    ticket_number    text not null,
    position         integer not null,
    status           public.queue_status not null default 'waiting',
    qr_code          text,
    entered_at       timestamptz not null default now(),
    called_at        timestamptz,
    completed_at     timestamptz,
    cancelled_at     timestamptz,
    notes            text,
    is_temporary     boolean not null default false,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    metadata         jsonb not null default '{}',
    unique (clinic_id, ticket_number)
);

-- تأكد من مطابقة الأعمدة للحالة الإنتاجية الحالية
alter table public.queue
    add column if not exists status public.queue_status;

alter table public.queue
    alter column status type public.queue_status using status::public.queue_status,
    alter column status set default 'waiting',
    alter column status set not null;

alter table public.queue
    add column if not exists qr_code text,
    add column if not exists notes text,
    add column if not exists is_temporary boolean not null default false,
    add column if not exists cancelled_at timestamptz,
    add column if not exists completed_at timestamptz,
    add column if not exists called_at timestamptz,
    add column if not exists entered_at timestamptz not null default now();

create index if not exists idx_queue_clinic_status on public.queue(clinic_id, status, entered_at);
create index if not exists idx_queue_patient_active on public.queue(patient_id)
    where completed_at is null and cancelled_at is null;
create unique index if not exists idx_queue_active_patient on public.queue (clinic_id, patient_id)
    where completed_at is null and cancelled_at is null;
create trigger trg_queue_touch
before update on public.queue
for each row execute function public.touch_updated_at();

-- 10) سجل حركة الدور
create table if not exists public.queue_history (
    id          uuid primary key default gen_random_uuid(),
    queue_id    uuid references public.queue(id) on delete cascade,
    clinic_id   text not null,
    patient_id  uuid not null,
    action      text not null,
    details     jsonb not null default '{}',
    created_at  timestamptz not null default now()
);
create index if not exists idx_queue_history_clinic_time on public.queue_history(clinic_id, created_at desc);

-- 11) الإشعارات (للتطبيق والإدارة)
create table if not exists public.notifications (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid references public.patients(id) on delete set null,
    clinic_id   text references public.clinics(id) on delete set null,
    title       text not null,
    message     text not null,
    status      text not null default 'queued',
    is_read     boolean not null default false,
    sent_at     timestamptz,
    read_at     timestamptz,
    metadata    jsonb not null default '{}',
    created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_status on public.notifications(status, created_at desc);

-- 12) الأحداث اللحظية (تُستخدم مع SSE)
create table if not exists public.events (
    id          uuid primary key default gen_random_uuid(),
    event_type  text not null,
    clinic_id   text,
    patient_id  uuid,
    payload     jsonb not null default '{}',
    created_at  timestamptz not null default now(),
    processed_at timestamptz
);
create index if not exists idx_events_type_time on public.events(event_type, created_at desc);

-- 13) المسارات الطبية (Routes)
create table if not exists public.routes (
    id           uuid primary key default gen_random_uuid(),
    patient_id   uuid not null references public.patients(id) on delete cascade,
    exam_type    text not null,
    gender       gender_type,
    status       text not null default 'active',
    current_step integer not null default 1,
    total_steps  integer not null default 0,
    metadata     jsonb not null default '{}',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists idx_routes_patient on public.routes(patient_id, status);
create trigger trg_routes_touch
before update on public.routes
for each row execute function public.touch_updated_at();

create table if not exists public.route_steps (
    id          uuid primary key default gen_random_uuid(),
    route_id    uuid not null references public.routes(id) on delete cascade,
    step_no     integer not null,
    clinic_id   text not null references public.clinics(id) on delete cascade,
    status      text not null default 'pending',
    ticket_number text,
    started_at  timestamptz,
    completed_at timestamptz,
    metadata    jsonb not null default '{}',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (route_id, step_no)
);
create index if not exists idx_route_steps_route on public.route_steps(route_id, step_no);
create trigger trg_route_steps_touch
before update on public.route_steps
for each row execute function public.touch_updated_at();

-- 14) مشاهد SQL جاهزة للإدارة
create or replace view public.queue_admin_view as
select
    c.id as clinic_id,
    c.name_en,
    c.name_ar,
    count(*) filter (where q.status::text = 'waiting')   as waiting_count,
    count(*) filter (where q.status::text = 'called')    as called_count,
    count(*) filter (where q.status::text in ('in_service','in_progress')) as in_service_count,
    count(*) filter (where q.status::text = 'completed' and q.completed_at::date = current_date) as completed_today,
    max(q.entered_at) as last_ticket_time
from public.clinics c
left join public.queue q on q.clinic_id = c.id
where c.is_active = true
group by c.id, c.name_en, c.name_ar;

-- 15) بيانات أولية للعيادات (تماثل ‎config/clinics.json‎)
insert into public.clinics (id, name_en, name_ar, floor, category, gender_constraint, call_prefix, call_interval_seconds, metadata)
values
    ('LAB', 'Laboratory', 'المختبر', 'M', 'labs',  'mixed', 'LAB', 45, jsonb_build_object('capacity', 2)),
    ('EYE', 'Ophthalmology', 'العيون', '2', 'clinic', 'mixed', 'EYE', 60, jsonb_build_object('capacity', 1)),
    ('INT', 'Internal Medicine', 'الباطنية', '2', 'clinic', 'mixed', 'INT', 60, jsonb_build_object('capacity', 1)),
    ('SUR', 'General Surgery', 'الجراحة العامة', '2', 'clinic', 'mixed', 'SUR', 60, jsonb_build_object('capacity', 1)),
    ('ENT', 'ENT (Ear, Nose & Throat)', 'أنف وأذن وحنجرة', '2', 'clinic', 'mixed', 'ENT', 60, jsonb_build_object('capacity', 1)),
    ('DER', 'Dermatology', 'الجلدية', '3', 'clinic', 'mixed', 'DER', 60, jsonb_build_object('capacity', 1)),
    ('PSY', 'Psychiatry', 'الطب النفسي', '2', 'clinic', 'mixed', 'PSY', 75, jsonb_build_object('capacity', 1)),
    ('DNT', 'Dentistry', 'الأسنان', '2', 'clinic', 'mixed', 'DNT', 75, jsonb_build_object('capacity', 1)),
    ('AUD', 'Audiology', 'قياس السمع', '2', 'station', 'mixed', 'AUD', 70, jsonb_build_object('capacity', 1)),
    ('ECG', 'ECG', 'تخطيط القلب', '2', 'station', 'mixed', 'ECG', 60, jsonb_build_object('capacity', 1)),
    ('BIO', 'Biometrics', 'القياسات الحيوية', '2', 'station', 'mixed', 'BIO', 50, jsonb_build_object('capacity', 2)),
    ('XR',  'Radiology', 'الأشعة', 'M', 'station', 'mixed', 'XR', 60, jsonb_build_object('capacity', 2)),
    ('F_INT', 'Internal Medicine (Women)', 'عيادة الباطنية (نساء)', '3', 'clinic', 'female', 'INT', 60, jsonb_build_object('capacity', 1)),
    ('F_DER', 'Dermatology (Women)', 'عيادة الجلدية (نساء)', '3', 'clinic', 'female', 'DER', 60, jsonb_build_object('capacity', 1)),
    ('F_EYE', 'Ophthalmology (Women)', 'عيادة العيون (نساء)', '3', 'clinic', 'female', 'EYE', 60, jsonb_build_object('capacity', 1))
on conflict (id) do update
set name_en = excluded.name_en,
    name_ar = excluded.name_ar,
    floor = excluded.floor,
    category = excluded.category,
    gender_constraint = excluded.gender_constraint,
    call_prefix = excluded.call_prefix,
    call_interval_seconds = excluded.call_interval_seconds,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();

-- 16) تأمين RLS (مع ملاحظة أن دوال Edge تستخدم service key وتتجاوز RLS)
alter table public.patients enable row level security;
alter table public.patient_sessions enable row level security;
alter table public.queue enable row level security;
alter table public.queue_history enable row level security;
alter table public.clinic_pins enable row level security;
alter table public.routes enable row level security;
alter table public.route_steps enable row level security;

-- سياسات بسيطة تسمح فقط لدور service_role (Edge Functions) بالوصول الكامل
drop policy if exists service_role_all on public.patients;
create policy service_role_all on public.patients
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.patient_sessions;
create policy service_role_all on public.patient_sessions
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.queue;
create policy service_role_all on public.queue
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.queue_history;
create policy service_role_all on public.queue_history
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.clinic_pins;
create policy service_role_all on public.clinic_pins
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.routes;
create policy service_role_all on public.routes
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.route_steps;
create policy service_role_all on public.route_steps
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.notifications;
create policy service_role_all on public.notifications
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists service_role_all on public.events;
create policy service_role_all on public.events
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- نهاية الملف: جاهز للتنفيذ بدون تعديل إضافي.
