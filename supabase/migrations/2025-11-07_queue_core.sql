-- Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ============= TABLES =============

-- العيادات
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  capacity int not null default 20,            -- السعة القصوى
  is_open boolean not null default true,       -- الحالة التشغيلية
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- أرقام الدور اليومية لكل عيادة (إسناد ذرّي)
create table if not exists public.clinic_counters (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  date_key date not null,                      -- Asia/Qatar::date
  next_num int not null default 1,
  primary key (clinic_id, date_key)
);

-- طابور المراجعين
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  user_id uuid not null,                       -- auth.users.id
  number int not null,                         -- رقم الدور الممنوح
  status text not null check (status in ('waiting','in_service','done','cancelled')),
  created_at timestamptz not null default now(),
  entered_at timestamptz,
  left_at timestamptz
);

-- إشعارات بسيطة (اختياري للـpolling)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

-- ============= INDEXES =============
create index if not exists idx_queues_clinic_status on public.queues (clinic_id, status);
create index if not exists idx_queues_user_status   on public.queues (user_id, status);
create index if not exists idx_notif_user_sent      on public.notifications (user_id, sent_at desc);

-- ============= RLS =============
alter table public.queues enable row level security;
alter table public.notifications enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_counters enable row level security;

-- سياسات العيادات: قراءة للجميع (تعرض الحالة فقط)، تعديل عبر وظائف فقط
create policy clinics_select_all on public.clinics
  for select using (true);

-- counters: لا وصول مباشر (وظائف فقط)
create policy counters_no_select on public.clinic_counters
  for select using (false);
create policy counters_no_write on public.clinic_counters
  for all using (false) with check (false);

-- queues: المستخدم يرى سجلاته فقط، الإدارة عبر وظائف
create policy queues_select_self on public.queues
  for select using (auth.uid() = user_id);

create policy queues_insert_via_func on public.queues
  for insert with check (false);

create policy queues_update_via_func on public.queues
  for update using (false) with check (false);

-- notifications: المستخدم يرى/يحدّث إشعاراته فقط
create policy notif_select_self on public.notifications
  for select using (auth.uid() = user_id);

create policy notif_update_self on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy notif_insert_via_func on public.notifications
  for insert with check (false);

-- ============= VIEWS (ملخّصات حالية) =============
-- يوم قطر (UTC+3)
create or replace view public.clinic_status as
select
  c.id,
  c.code,
  c.name,
  c.capacity,
  c.is_open,
  coalesce(sum((q.status = 'waiting')::int),0) as waiting_count,
  coalesce(sum((q.status = 'in_service')::int),0) as in_service_count,
  (coalesce(sum((q.status = 'waiting')::int),0) >= c.capacity or not c.is_open) as is_full
from public.clinics c
left join public.queues q
  on q.clinic_id = c.id and q.created_at::date = (timezone('Asia/Qatar', now()))::date
group by c.id, c.code, c.name, c.capacity, c.is_open;

-- ============= FUNCTIONS (RPC) =============

-- تاريخ اليوم في قطر
create or replace function public.today_qatar() returns date
language sql stable as $$
  select (timezone('Asia/Qatar', now()))::date;
$$;

-- يمنح رقم دور جديد ذرّياً ويُدرِج في queues
create or replace function public.queue_create(p_clinic_id uuid)
returns table (queue_id uuid, clinic_id uuid, user_id uuid, number int, status text, created_at timestamptz)
language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_date date := public.today_qatar();
  v_num int;
  v_is_open boolean;
  v_capacity int;
  v_waiting int;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  select is_open, capacity into v_is_open, v_capacity from public.clinics where id = p_clinic_id;
  if not found then
    raise exception 'clinic_not_found';
  end if;
  if not v_is_open then
    raise exception 'clinic_closed';
  end if;

  -- عدد المنتظرين الحالي
  select coalesce(count(*),0) into v_waiting
  from public.queues where clinic_id = p_clinic_id
    and created_at::date = v_date and status = 'waiting';

  if v_waiting >= v_capacity then
    raise exception 'clinic_full';
  end if;

  -- upsert العداد + استرجاع الرقم الذرّي
  insert into public.clinic_counters (clinic_id, date_key, next_num)
  values (p_clinic_id, v_date, 2)
  on conflict (clinic_id, date_key) do update
    set next_num = public.clinic_counters.next_num + 1
  returning case
    when xmax = 0 then 1 -- السطر الجديد يبدأ بـ 1
    else public.clinic_counters.next_num - 1
  end into v_num;

  insert into public.queues (clinic_id, user_id, number, status)
  values (p_clinic_id, v_user, v_num, 'waiting')
  returning id, clinic_id, user_id, number, status, created_at
  into queue_id, clinic_id, user_id, number, status, created_at;
end;
$$;

-- دخول العيادة
create or replace function public.queue_enter(p_queue_id uuid)
returns table (queue_id uuid, entered_at timestamptz, status text)
language plpgsql security definer as $$
begin
  update public.queues
    set entered_at = now(), status = 'in_service'
  where id = p_queue_id and status = 'waiting'
  returning id, entered_at, status into queue_id, entered_at, status;

  if queue_id is null then
    raise exception 'invalid_state';
  end if;
end;
$$;

-- إنهاء/خروج من العيادة
create or replace function public.queue_leave(p_queue_id uuid, p_status text default 'done')
returns table (queue_id uuid, left_at timestamptz, status text)
language plpgsql security definer as $$
begin
  if p_status not in ('done','cancelled') then
    raise exception 'bad_status';
  end if;

  update public.queues
    set left_at = now(), status = p_status
  where id = p_queue_id and status in ('waiting','in_service')
  returning id, left_at, status into queue_id, left_at, status;

  if queue_id is null then
    raise exception 'invalid_state';
  end if;
end;
$$;

-- قائمة العيادات مع الحالة اللحظية
create or replace function public.clinics_list()
returns setof public.clinic_status
language sql stable as $$
  select * from public.clinic_status order by name;
$$;

-- إشعار بسيط (اختياري)
create or replace function public.notify_user(p_user uuid, p_type text, p_payload jsonb)
returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- صلاحيات تنفيذ للـauthenticated فقط
revoke all on function public.queue_create(uuid)  from public;
revoke all on function public.queue_enter(uuid)   from public;
revoke all on function public.queue_leave(uuid, text) from public;
revoke all on function public.clinics_list()      from public;
revoke all on function public.notify_user(uuid, text, jsonb) from public;

grant execute on function public.queue_create(uuid)             to authenticated;
grant execute on function public.queue_enter(uuid)              to authenticated;
grant execute on function public.queue_leave(uuid, text)        to authenticated;
grant execute on function public.clinics_list()                 to anon, authenticated;
grant execute on function public.notify_user(uuid, text, jsonb) to authenticated;

-- ============= REALTIME (نسخ تغييرات) =============
alter publication supabase_realtime add table public.queues;
