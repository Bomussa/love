-- Canonical queue unification
-- Source of truth: public.queues

BEGIN;

-- 1) Ensure canonical columns exist on public.queues
ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS exam_type TEXT,
  ADD COLUMN IF NOT EXISTS queue_number_int INTEGER,
  ADD COLUMN IF NOT EXISTS queue_number TEXT,
  ADD COLUMN IF NOT EXISTS queue_date DATE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by_pin TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.queues
  ALTER COLUMN entered_at SET DEFAULT NOW();

UPDATE public.queues
SET
  queue_number_int = COALESCE(queue_number_int, display_number),
  display_number = COALESCE(display_number, queue_number_int),
  queue_date = COALESCE(queue_date, (entered_at AT TIME ZONE 'UTC')::date),
  status = CASE
    WHEN status IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show', 'skipped') THEN status
    WHEN status IN ('in_progress', 'in_service') THEN 'called'
    WHEN status = 'postponed' THEN 'skipped'
    ELSE 'waiting'
  END,
  updated_at = NOW();

ALTER TABLE public.queues
  ALTER COLUMN queue_number_int SET NOT NULL,
  ALTER COLUMN display_number SET NOT NULL,
  ALTER COLUMN queue_date SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'queues_status_check'
      AND conrelid = 'public.queues'::regclass
  ) THEN
    ALTER TABLE public.queues DROP CONSTRAINT queues_status_check;
  END IF;
END $$;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_status_check
  CHECK (status IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_queues_clinic_date_status ON public.queues(clinic_id, queue_date, status);
CREATE INDEX IF NOT EXISTS idx_queues_clinic_queue_number ON public.queues(clinic_id, queue_date, queue_number_int);

-- 2) Data migration from public.queue (legacy singular table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'queue'
  ) THEN
    INSERT INTO public.queues (
      id,
      clinic_id,
      patient_id,
      patient_name,
      exam_type,
      queue_number_int,
      display_number,
      queue_number,
      status,
      entered_at,
      called_at,
      completed_at,
      cancelled_at,
      queue_date,
      metadata,
      created_at,
      updated_at
    )
    SELECT
      q.id,
      q.clinic_id,
      q.patient_id::TEXT,
      q.patient_name,
      q.exam_type,
      COALESCE(q.position, q.ticket_number::INTEGER, 0),
      COALESCE(q.position, q.ticket_number::INTEGER, 0),
      q.ticket_number,
      CASE
        WHEN q.status::TEXT IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show', 'skipped') THEN q.status::TEXT
        WHEN q.status::TEXT IN ('in_progress', 'in_service') THEN 'called'
        WHEN q.status::TEXT = 'postponed' THEN 'skipped'
        ELSE 'waiting'
      END,
      COALESCE(q.entered_at, NOW()),
      q.called_at,
      q.completed_at,
      q.cancelled_at,
      COALESCE((q.entered_at AT TIME ZONE 'UTC')::date, CURRENT_DATE),
      COALESCE(q.metadata, '{}'::jsonb),
      COALESCE(q.created_at, NOW()),
      COALESCE(q.updated_at, NOW())
    FROM public.queue q
    ON CONFLICT (id) DO UPDATE
      SET
        clinic_id = EXCLUDED.clinic_id,
        patient_id = EXCLUDED.patient_id,
        patient_name = COALESCE(EXCLUDED.patient_name, public.queues.patient_name),
        exam_type = COALESCE(EXCLUDED.exam_type, public.queues.exam_type),
        queue_number_int = EXCLUDED.queue_number_int,
        display_number = EXCLUDED.display_number,
        queue_number = COALESCE(EXCLUDED.queue_number, public.queues.queue_number),
        status = EXCLUDED.status,
        entered_at = EXCLUDED.entered_at,
        called_at = COALESCE(EXCLUDED.called_at, public.queues.called_at),
        completed_at = COALESCE(EXCLUDED.completed_at, public.queues.completed_at),
        cancelled_at = COALESCE(EXCLUDED.cancelled_at, public.queues.cancelled_at),
        queue_date = EXCLUDED.queue_date,
        metadata = COALESCE(public.queues.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
        updated_at = NOW();
  END IF;
END $$;

-- 3) Data migration from public.unified_queue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unified_queue'
  ) THEN
    INSERT INTO public.queues (
      id,
      clinic_id,
      patient_id,
      patient_name,
      exam_type,
      queue_number_int,
      display_number,
      queue_number,
      status,
      entered_at,
      called_at,
      completed_at,
      cancelled_at,
      queue_date,
      completed_by_pin,
      metadata,
      created_at,
      updated_at
    )
    SELECT
      uq.id,
      uq.clinic_id,
      uq.patient_id::TEXT,
      uq.patient_name,
      uq.exam_type,
      COALESCE(uq.queue_position, uq.display_number, 0),
      COALESCE(uq.display_number, uq.queue_position, 0),
      uq.queue_number,
      CASE
        WHEN uq.status IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show', 'skipped') THEN uq.status
        WHEN uq.status IN ('in_progress', 'in_service') THEN 'called'
        WHEN uq.status = 'postponed' THEN 'skipped'
        ELSE 'waiting'
      END,
      COALESCE(uq.entered_at, NOW()),
      uq.called_at,
      uq.completed_at,
      uq.cancelled_at,
      COALESCE(uq.queue_date, (uq.entered_at AT TIME ZONE 'UTC')::date, CURRENT_DATE),
      uq.completed_by_pin,
      COALESCE(uq.metadata, '{}'::jsonb),
      COALESCE(uq.entered_at, NOW()),
      NOW()
    FROM public.unified_queue uq
    ON CONFLICT (id) DO UPDATE
      SET
        clinic_id = EXCLUDED.clinic_id,
        patient_id = EXCLUDED.patient_id,
        patient_name = COALESCE(EXCLUDED.patient_name, public.queues.patient_name),
        exam_type = COALESCE(EXCLUDED.exam_type, public.queues.exam_type),
        queue_number_int = EXCLUDED.queue_number_int,
        display_number = EXCLUDED.display_number,
        queue_number = COALESCE(EXCLUDED.queue_number, public.queues.queue_number),
        status = EXCLUDED.status,
        entered_at = EXCLUDED.entered_at,
        called_at = COALESCE(EXCLUDED.called_at, public.queues.called_at),
        completed_at = COALESCE(EXCLUDED.completed_at, public.queues.completed_at),
        cancelled_at = COALESCE(EXCLUDED.cancelled_at, public.queues.cancelled_at),
        queue_date = EXCLUDED.queue_date,
        completed_by_pin = COALESCE(EXCLUDED.completed_by_pin, public.queues.completed_by_pin),
        metadata = COALESCE(public.queues.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
        updated_at = NOW();
  END IF;
END $$;

-- 4) Temporary compatibility views for legacy reads
CREATE OR REPLACE VIEW public.queue_compat AS
SELECT
  id,
  clinic_id,
  patient_id,
  patient_name,
  exam_type,
  queue_number_int AS position,
  status,
  entered_at,
  called_at,
  completed_at,
  cancelled_at,
  metadata
FROM public.queues;

CREATE OR REPLACE VIEW public.unified_queue_compat AS
SELECT
  id,
  clinic_id,
  patient_id,
  patient_name,
  exam_type,
  queue_number_int AS queue_position,
  display_number,
  queue_number,
  status,
  queue_date,
  entered_at,
  called_at,
  completed_at,
  cancelled_at,
  completed_by_pin,
  metadata
FROM public.queues;

COMMIT;
