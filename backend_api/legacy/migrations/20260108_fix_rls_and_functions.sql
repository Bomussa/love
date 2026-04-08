-- MMC-MMS Stabilization Migration
-- Date: 2026-01-08
-- Purpose: Implement RLS policies, Queue functions, PIN system, and Reports

-- ==================== 1. ENSURE AUTH FUNCTIONS ====================
create or replace function auth.uid() returns uuid as $$
begin
  return current_setting('request.jwt.claim.sub')::uuid;
exception when others then
  return null;
end;
$$ language plpgsql stable;

-- ==================== 2. ENABLE RLS ON CORE TABLES ====================

-- patients table RLS
alter table patients enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Patients can view own data" on patients;
drop policy if exists "patients_select_limited" on patients;

-- Create new patient selection policy
create policy patients_select_limited on patients
  for select using (
    -- Allow if public non-sensitive fields OR if owner or same clinic
    (public_field_visible = true)
    OR (created_by = auth.uid()::text)
    OR (clinic_id in (select c.id from clinics c join clinic_members cm on cm.clinic_id = c.id where cm.user_id = auth.uid()::text))
  );

-- notifications table RLS
alter table notifications enable row level security;

-- Drop existing policies
drop policy if exists "Notifications are viewable by patient" on notifications;
drop policy if exists "notifications_crud" on notifications;

-- Create new notification policy
create policy notifications_crud on notifications
  for all using (
    -- read: only notifications targeting the clinic or specific user
    (target_clinic_id is null) -- global notifications allowed
    OR (target_clinic_id in (select clinic_id from clinic_members where user_id = auth.uid()::text))
    OR (target_user_id = auth.uid()::text)
  ) with check (
    -- insert/update: actor must belong to clinic or be admin
    (exists (select 1 from admins a where a.user_id = auth.uid()::text))
    OR (target_clinic_id in (select clinic_id from clinic_members where user_id = auth.uid()::text))
  );

-- pathways table RLS
alter table pathways enable row level security;

-- Drop existing policies
drop policy if exists "Pathways are viewable by patient" on pathways;
drop policy if exists "pathways_select" on pathways;

-- Create new pathway policy
create policy pathways_select on pathways
  for select using (
    (clinic_id in (select clinic_id from clinic_members where user_id = auth.uid()::text))
    OR (is_public = true)
  );

-- ==================== 3. CLINIC PINS TABLE ====================

-- Create clinic_pins table if not exists
create table if not exists clinic_pins (
    id uuid primary key default uuid_generate_v4(),
    clinic_id text references clinics(id) on delete cascade,
    date date default current_date,
    pin_hash text not null,
    created_at timestamp with time zone default now(),
    unique(clinic_id, date)
);

-- Create index for faster lookups
create index if not exists idx_clinic_pins_clinic_date on clinic_pins(clinic_id, date);

-- ==================== 4. QUEUE HISTORY TABLE ====================

-- Create queue_history table if not exists
create table if not exists queue_history (
    id uuid primary key default uuid_generate_v4(),
    queue_id uuid,
    clinic_id text references clinics(id),
    patient_id text,
    number integer,
    created_at timestamp with time zone,
    completed_at timestamp with time zone,
    meta jsonb,
    created_at_ts timestamp with time zone default now()
);

-- Create index for faster queries
create index if not exists idx_queue_history_clinic_date on queue_history(clinic_id, created_at);

-- ==================== 5. CLINIC COUNTERS TABLE ====================

-- Create clinic_counters table if not exists
create table if not exists clinic_counters (
    id uuid primary key default uuid_generate_v4(),
    clinic_id text unique references clinics(id) on delete cascade,
    last_ticket integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- ==================== 6. POSTGRES FUNCTIONS ====================

-- Function to get daily PIN (idempotent)
create or replace function fn_get_daily_pin(p_clinic text)
returns text as $$
declare
  v_pin_rec record;
  v_pin text;
begin
  select * into v_pin_rec from clinic_pins where clinic_id = p_clinic and date = current_date;
  if found then
    return v_pin_rec.pin_hash; -- hashed stored value
  end if;
  v_pin := lpad((floor(random()*900000)+100000)::text,6,'0');
  insert into clinic_pins (clinic_id, date, pin_hash, created_at)
    values (p_clinic, current_date, crypt(v_pin, gen_salt('bf')), now());
  perform pg_notify('pin_generated_'||p_clinic::text, json_build_object('clinic_id', p_clinic, 'pin', v_pin)::text);
  return v_pin; -- for internal use only (do not expose in logs)
end;
$$ language plpgsql security definer;

-- Function to get next ticket number
create or replace function fn_get_next_ticket(p_clinic text)
returns integer as $$
declare
  v_counter integer;
begin
  update clinic_counters set last_ticket = last_ticket + 1, updated_at = now()
    where clinic_id = p_clinic
    returning last_ticket into v_counter;
  if not found then
    insert into clinic_counters (clinic_id, last_ticket, created_at, updated_at) 
      values (p_clinic, 1, now(), now());
    v_counter := 1;
  end if;
  return v_counter;
end;
$$ language plpgsql security definer;

-- Function to archive completed queue items
create or replace function fn_archive_completed()
returns trigger as $$
begin
  if NEW.status = 'DONE' or NEW.status = 'completed' then
    insert into queue_history (queue_id, clinic_id, patient_id, number, created_at, completed_at, meta)
      values (NEW.id, NEW.clinic_id, NEW.patient_id, NEW.position, NEW.created_at, now(), row_to_json(NEW)::jsonb);
    delete from queue where id = NEW.id;
    return null;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- ==================== 7. TRIGGERS ====================

-- Drop existing trigger if exists
drop trigger if exists archive_queue_on_complete on queue;
drop trigger if exists archive_queue_on_complete_v2 on queue;

-- Create trigger for archiving
create trigger archive_queue_on_complete 
after update on queue 
for each row 
when (NEW.status = 'DONE' or NEW.status = 'completed')
execute function fn_archive_completed();

-- ==================== 8. VIEWS FOR REPORTS ====================

-- Daily reports view
create or replace view v_reports_daily as
select 
  clinic_id, 
  date_trunc('day', completed_at) as day,
  count(*) filter (where completed_at is not null) as completed,
  count(*) filter (where completed_at is null) as active,
  avg(extract(epoch from (completed_at - created_at))) filter (where completed_at is not null) as avg_wait_seconds
from queue_history
group by clinic_id, date_trunc('day', completed_at);

-- Weekly reports view
create or replace view v_reports_weekly as
select 
  clinic_id,
  date_trunc('week', completed_at) as week,
  count(*) filter (where completed_at is not null) as completed,
  avg(extract(epoch from (completed_at - created_at))) filter (where completed_at is not null) as avg_wait_seconds
from queue_history
group by clinic_id, date_trunc('week', completed_at);

-- Monthly reports view
create or replace view v_reports_monthly as
select 
  clinic_id,
  date_trunc('month', completed_at) as month,
  count(*) filter (where completed_at is not null) as completed,
  avg(extract(epoch from (completed_at - created_at))) filter (where completed_at is not null) as avg_wait_seconds
from queue_history
group by clinic_id, date_trunc('month', completed_at);

-- ==================== 9. INDEXES FOR PERFORMANCE ====================

-- Queue table indexes
create index if not exists idx_queue_clinic_status on queue(clinic_id, status);
create index if not exists idx_queue_patient_id on queue(patient_id);
create index if not exists idx_queue_entered_at on queue(entered_at desc);

-- Notifications indexes
create index if not exists idx_notifications_target_user on notifications(target_user_id);
create index if not exists idx_notifications_target_clinic on notifications(target_clinic_id);

-- Patients indexes
create index if not exists idx_patients_clinic_id on patients(clinic_id);
create index if not exists idx_patients_created_by on patients(created_by);

-- ==================== 10. MIGRATION COMPLETION ====================

-- Log migration completion
insert into migration_log (name, executed_at, status) 
values ('20260108_fix_rls_and_functions', now(), 'completed')
on conflict (name) do update set executed_at = now(), status = 'completed';
