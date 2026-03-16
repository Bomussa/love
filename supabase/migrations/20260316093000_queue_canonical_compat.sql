-- Canonical queue compatibility layer
-- Canonical source of truth: public.queues

-- 1) Ensure canonical columns exist on public.queues
alter table if exists public.queues add column if not exists display_number integer;
alter table if exists public.queues add column if not exists queue_date date;
alter table if exists public.queues add column if not exists patient_name text;
alter table if exists public.queues add column if not exists exam_type text;
alter table if exists public.queues add column if not exists called_at timestamptz;
alter table if exists public.queues add column if not exists completed_at timestamptz;
alter table if exists public.queues add column if not exists updated_at timestamptz not null default now();

-- Backfill display_number / queue_date from legacy columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='queues' AND column_name='queue_number'
  ) THEN
    EXECUTE 'update public.queues set display_number = coalesce(display_number, queue_number) where display_number is null';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='queues' AND column_name='number'
  ) THEN
    EXECUTE 'update public.queues set display_number = coalesce(display_number, number) where display_number is null';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='queues' AND column_name='created_at'
  ) THEN
    EXECUTE 'update public.queues set queue_date = coalesce(queue_date, created_at::date) where queue_date is null';
  ELSE
    EXECUTE 'update public.queues set queue_date = coalesce(queue_date, current_date) where queue_date is null';
  END IF;
END $$;

-- Broaden status compatibility to support runtime aliases
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.queues'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('alter table public.queues drop constraint %I', c.conname);
  END LOOP;

  alter table public.queues
    add constraint queues_status_compat_check
    check (status in ('waiting','serving','called','in_service','completed','done','skipped','cancelled','postponed'));
END $$;

-- Normalize historical synonyms to canonical runtime status values
update public.queues
set status = 'serving'
where status = 'in_service';

update public.queues
set status = 'completed'
where status = 'done';

-- Keep queue_date consistent
update public.queues
set queue_date = coalesce(queue_date, created_at::date, current_date)
where queue_date is null;

-- 2) If legacy unified_queue table exists, migrate to queues and replace with compatibility view
DO $$
BEGIN
  IF to_regclass('public.unified_queue') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='unified_queue' AND c.relkind='r') THEN

    EXECUTE $mig$
      insert into public.queues (id, clinic_id, patient_id, patient_name, exam_type, display_number, status, entered_at, called_at, completed_at, queue_date, created_at, updated_at)
      select
        uq.id,
        uq.clinic_id,
        uq.patient_id,
        uq.patient_name,
        uq.exam_type,
        uq.display_number,
        case
          when uq.status = 'in_service' then 'serving'
          when uq.status = 'done' then 'completed'
          else uq.status
        end,
        uq.entered_at,
        uq.called_at,
        uq.completed_at,
        coalesce(uq.queue_date, uq.entered_at::date, current_date),
        coalesce(uq.created_at, now()),
        coalesce(uq.updated_at, now())
      from public.unified_queue uq
      on conflict (id) do update set
        clinic_id = excluded.clinic_id,
        patient_id = excluded.patient_id,
        patient_name = excluded.patient_name,
        exam_type = excluded.exam_type,
        display_number = excluded.display_number,
        status = excluded.status,
        entered_at = excluded.entered_at,
        called_at = excluded.called_at,
        completed_at = excluded.completed_at,
        queue_date = excluded.queue_date,
        updated_at = excluded.updated_at
    $mig$;

    EXECUTE 'drop table public.unified_queue';
  END IF;
END $$;

-- 3) If legacy queue table exists, migrate to queues and replace with compatibility view
DO $$
BEGIN
  IF to_regclass('public.queue') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='queue' AND c.relkind='r') THEN

    EXECUTE $mig$
      insert into public.queues (id, clinic_id, patient_id, patient_name, exam_type, display_number, status, entered_at, called_at, completed_at, queue_date, created_at, updated_at)
      select
        q.id,
        q.clinic_id,
        q.patient_id,
        q.patient_name,
        q.exam_type,
        coalesce(q.display_number, q.position),
        case
          when q.status = 'in_service' then 'serving'
          when q.status = 'done' then 'completed'
          else q.status
        end,
        q.entered_at,
        q.called_at,
        q.completed_at,
        coalesce(q.queue_date, q.entered_at::date, current_date),
        coalesce(q.created_at, now()),
        coalesce(q.updated_at, now())
      from public.queue q
      on conflict (id) do update set
        clinic_id = excluded.clinic_id,
        patient_id = excluded.patient_id,
        patient_name = excluded.patient_name,
        exam_type = excluded.exam_type,
        display_number = excluded.display_number,
        status = excluded.status,
        entered_at = excluded.entered_at,
        called_at = excluded.called_at,
        completed_at = excluded.completed_at,
        queue_date = excluded.queue_date,
        updated_at = excluded.updated_at
    $mig$;

    EXECUTE 'drop table public.queue';
  END IF;
END $$;

-- 4) Compatibility views
create or replace view public.unified_queue as
select
  id,
  clinic_id,
  patient_id,
  patient_name,
  exam_type,
  display_number,
  status,
  entered_at,
  called_at,
  completed_at,
  queue_date,
  created_at,
  updated_at
from public.queues;

create or replace view public.queue as
select
  id,
  clinic_id,
  patient_id,
  patient_name,
  exam_type,
  display_number as position,
  status,
  entered_at,
  called_at,
  completed_at,
  queue_date,
  created_at,
  updated_at
from public.queues;
