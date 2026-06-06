-- Security hardening migration
-- هدفها: إزالة bypass عبر policies المفتوحة، تعطيل EXECUTE الافتراضي على RPCs،
-- وتفعيل security_invoker للـ views التي تقرأ من جداول محمية بـ RLS.

-- ============================================================================
-- 1) RLS hardening for sensitive tables
-- ============================================================================

alter table if exists public.clinics        enable row level security;
alter table if exists public.patients       enable row level security;
alter table if exists public.pathways       enable row level security;
alter table if exists public.queues         enable row level security;
alter table if exists public.notifications   enable row level security;
alter table if exists public.reports        enable row level security;
alter table if exists public.system_settings enable row level security;
alter table if exists public.admin_users    enable row level security;
alter table if exists public.audit_log      enable row level security;
alter table if exists public.login_audit    enable row level security;
alter table if exists public.qa_runs        enable row level security;
alter table if exists public.qa_findings    enable row level security;
alter table if exists public.repair_runs    enable row level security;

alter table if exists public.clinics        force row level security;
alter table if exists public.patients       force row level security;
alter table if exists public.pathways       force row level security;
alter table if exists public.queues         force row level security;
alter table if exists public.notifications   force row level security;
alter table if exists public.reports        force row level security;
alter table if exists public.system_settings force row level security;
alter table if exists public.admin_users    force row level security;
alter table if exists public.audit_log      force row level security;
alter table if exists public.login_audit    force row level security;
alter table if exists public.qa_runs        force row level security;
alter table if exists public.qa_findings    force row level security;
alter table if exists public.repair_runs    force row level security;

-- Drop permissive policies where the qual / with_check is literally TRUE.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname in ('public', 'core', 'archive')
      and (
        qual = 'true'
        or with_check = 'true'
      )
      and tablename ~ '^(admins?|activity_logs|api_logs|patients|clinics|queues|queue_events|notifications|reports|system_settings|login_audit|audit_log|unified_queue(_[0-9]{4}_[0-9]{2})?|unified_queue_historical|qa_runs|qa_findings|repair_runs)$'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Recreate safer policies for the schema files that ship in this repo.
-- Clinics: public read is acceptable, but not as a literal TRUE bypass.
drop policy if exists clinics_read_public on public.clinics;
drop policy if exists clinics_select_all on public.clinics;
create policy clinics_select_authenticated_or_anon on public.clinics
  for select
  to anon, authenticated
  using (auth.role() in ('anon', 'authenticated'));

-- Patients: authenticated only.
drop policy if exists patients_authenticated_all on public.patients;
drop policy if exists "Patients can view their own data" on public.patients;
drop policy if exists "Patients can insert their own data" on public.patients;
create policy patients_authenticated_all on public.patients
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Pathways: authenticated only.
drop policy if exists pathways_authenticated_all on public.pathways;
drop policy if exists "Pathways are viewable by patient" on public.pathways;
drop policy if exists "Pathways can be inserted" on public.pathways;
drop policy if exists "Pathways can be updated" on public.pathways;
create policy pathways_authenticated_all on public.pathways
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Queues: authenticated only; the view layer should be used for public summaries.
drop policy if exists queues_authenticated_all on public.queues;
drop policy if exists "Users can view queues" on public.queues;
drop policy if exists "Users can insert into queues" on public.queues;
drop policy if exists "Users can update their queue entries" on public.queues;
create policy queues_authenticated_all on public.queues
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Notifications: authenticated only.
drop policy if exists notifications_authenticated_all on public.notifications;
drop policy if exists "Users can view notifications" on public.notifications;
drop policy if exists "Users can insert notifications" on public.notifications;
create policy notifications_authenticated_all on public.notifications
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Reports: authenticated only.
drop policy if exists reports_authenticated_read on public.reports;
drop policy if exists "Reports are publicly readable" on public.reports;
create policy reports_authenticated_read on public.reports
  for select
  to authenticated
  using (auth.role() = 'authenticated');

-- System settings: authenticated only.
drop policy if exists system_settings_authenticated_read on public.system_settings;
drop policy if exists "System settings are viewable by everyone" on public.system_settings;
create policy system_settings_authenticated_read on public.system_settings
  for select
  to authenticated
  using (auth.role() = 'authenticated');

-- Admin / audit tables: explicit deny.
drop policy if exists admin_users_no_access on public.admin_users;
drop policy if exists "Admin users restricted" on public.admin_users;
create policy admin_users_no_access on public.admin_users
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists audit_log_no_access on public.audit_log;
drop policy if exists "Audit log restricted" on public.audit_log;
create policy audit_log_no_access on public.audit_log
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Login audit remains service-role only, but ensure RLS is on.
alter table if exists public.login_audit enable row level security;
alter table if exists public.login_audit force row level security;

-- QA / repair tables: authenticated only.
drop policy if exists qa_runs_authenticated_all on public.qa_runs;
drop policy if exists qa_findings_authenticated_all on public.qa_findings;
drop policy if exists repair_runs_authenticated_all on public.repair_runs;
create policy qa_runs_authenticated_all on public.qa_runs
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy qa_findings_authenticated_all on public.qa_findings
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy repair_runs_authenticated_all on public.repair_runs
  for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- 2) RPC hardening: remove PUBLIC / anon EXECUTE defaults, then re-grant only
--    the functions that this repo intentionally exposes.
-- ============================================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as regproc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'core', 'archive')
  loop
    execute format('revoke execute on function %s from public', fn.regproc);
    execute format('revoke execute on function %s from anon', fn.regproc);
  end loop;
end $$;

-- Publicly intended helper RPCs from the shipped schema.
grant execute on function public.clinics_list()                 to authenticated, service_role;
grant execute on function public.today_qatar()                  to authenticated, service_role;
grant execute on function public.queue_create(uuid)             to authenticated, service_role;
grant execute on function public.queue_enter(uuid)              to authenticated, service_role;
grant execute on function public.queue_leave(uuid, text)        to authenticated, service_role;
grant execute on function public.notify_user(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.generate_daily_pin(varchar)    to authenticated, service_role;
grant execute on function public.get_next_queue_number(varchar) to authenticated, service_role;
grant execute on function public.get_queue_position(varchar, varchar) to authenticated, service_role;
grant execute on function public.get_next_display_number(text)  to authenticated, service_role;
grant execute on function public.get_queue_status(text)         to authenticated, service_role;

-- ============================================================================
-- 3) View hardening: make queue-facing views respect RLS.
-- ============================================================================

create or replace view public.clinic_status
with (security_invoker = true)
as
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

create or replace view public.active_queues
with (security_invoker = true)
as
select 
  q.id,
  q.queue_number,
  q.patient_id,
  q.clinic_id,
  c.name_ar as clinic_name_ar,
  c.name_en as clinic_name_en,
  q.status,
  q.entered_at,
  q.exam_type,
  q.gender,
  EXTRACT(EPOCH FROM (NOW() - q.entered_at))/60 as wait_time_minutes
from public.queues q
join public.clinics c on q.clinic_id = c.clinic_id
where q.status in ('waiting', 'called')
  and date(q.entered_at) = current_date
order by q.clinic_id, q.queue_number;

create or replace view public.clinic_stats
with (security_invoker = true)
as
select 
  c.clinic_id,
  c.name_ar,
  c.name_en,
  c.is_open,
  c.current_number,
  count(case when q.status = 'waiting' then 1 end) as waiting_count,
  count(case when q.status = 'done' then 1 end) as completed_today,
  avg(case 
    when q.status = 'done' 
    then extract(epoch from (q.completed_at - q.entered_at))/60 
  end) as avg_service_time_minutes
from public.clinics c
left join public.queues q
  on c.clinic_id = q.clinic_id 
  and date(q.entered_at) = current_date
group by c.id, c.clinic_id, c.name_ar, c.name_en, c.is_open, c.current_number;

-- ============================================================================
-- End of hardening migration
-- ============================================================================