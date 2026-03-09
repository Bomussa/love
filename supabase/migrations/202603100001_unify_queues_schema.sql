-- Unify public.queues schema and queue RPC contracts.

-- 1) Canonical columns
ALTER TABLE IF EXISTS public.queues
  ADD COLUMN IF NOT EXISTS patient_id TEXT,
  ADD COLUMN IF NOT EXISTS display_number INTEGER,
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS exam_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by_pin TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) Safe type normalization + data mapping
DO $$
DECLARE
  v_clinic_type TEXT;
BEGIN
  SELECT data_type INTO v_clinic_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'queues' AND column_name = 'clinic_id';

  -- clinic_id: text/varchar -> uuid (safe cast with clinic code mapping fallback)
  IF v_clinic_type IN ('text', 'character varying') THEN
    ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS clinic_id_uuid UUID;

    UPDATE public.queues q
    SET clinic_id_uuid = CASE
      WHEN q.clinic_id IS NULL THEN NULL
      WHEN q.clinic_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN q.clinic_id::uuid
      ELSE c.id
    END
    FROM public.clinics c
    WHERE c.code = q.clinic_id
      AND q.clinic_id_uuid IS NULL;

    UPDATE public.queues q
    SET clinic_id_uuid = q.clinic_id::uuid
    WHERE q.clinic_id_uuid IS NULL
      AND q.clinic_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    ALTER TABLE public.queues DROP COLUMN clinic_id;
    ALTER TABLE public.queues RENAME COLUMN clinic_id_uuid TO clinic_id;
  END IF;
END $$;

-- user_id -> patient_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'queues' AND column_name = 'user_id'
  ) THEN
    UPDATE public.queues
    SET patient_id = COALESCE(patient_id, user_id::text)
    WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- number -> display_number
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'queues' AND column_name = 'number'
  ) THEN
    UPDATE public.queues
    SET display_number = COALESCE(display_number, number)
    WHERE number IS NOT NULL;
  END IF;
END $$;

-- status normalization
UPDATE public.queues
SET status = CASE
  WHEN status IN ('in_service', 'in_progress', 'called') THEN 'serving'
  WHEN status = 'done' THEN 'completed'
  WHEN status = 'skipped' THEN 'cancelled'
  ELSE status
END;

-- Safe numeric cleanup for display_number
UPDATE public.queues
SET display_number = COALESCE(display_number, 0)
WHERE display_number IS NULL;

-- 3) Constraints (final contract)
ALTER TABLE public.queues
  ALTER COLUMN clinic_id TYPE UUID USING clinic_id::uuid,
  ALTER COLUMN clinic_id SET NOT NULL,
  ALTER COLUMN patient_id SET NOT NULL,
  ALTER COLUMN display_number SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'waiting',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_status_check;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_status_check
  CHECK (status IN ('waiting', 'serving', 'completed', 'cancelled'));

ALTER TABLE public.queues
  DROP CONSTRAINT IF EXISTS queues_clinic_id_fkey;

ALTER TABLE public.queues
  ADD CONSTRAINT queues_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Drop legacy columns once mapping is done
ALTER TABLE public.queues
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS number,
  DROP COLUMN IF EXISTS position,
  DROP COLUMN IF EXISTS left_at,
  DROP COLUMN IF EXISTS exam_type_id,
  DROP COLUMN IF EXISTS estimated_wait_minutes,
  DROP COLUMN IF EXISTS notes;

-- Keep patient_name/exam_type/priority metadata if they exist; they are optional

-- 4) Indexes
DROP INDEX IF EXISTS idx_queues_user_status;
DROP INDEX IF EXISTS idx_queues_patient;
DROP INDEX IF EXISTS idx_queues_patient_id;
DROP INDEX IF EXISTS idx_queues_status;
DROP INDEX IF EXISTS idx_queues_clinic_id;

CREATE INDEX IF NOT EXISTS idx_queues_clinic_status_display
  ON public.queues (clinic_id, status, display_number);
CREATE INDEX IF NOT EXISTS idx_queues_patient_status
  ON public.queues (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_entered_at
  ON public.queues (entered_at DESC);

-- 5) RLS policies (single contract)
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS queues_select_self ON public.queues;
DROP POLICY IF EXISTS queues_insert_via_func ON public.queues;
DROP POLICY IF EXISTS queues_update_via_func ON public.queues;
DROP POLICY IF EXISTS "Allow public read access on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated insert on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated update on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated delete on queues" ON public.queues;

CREATE POLICY queues_select_patient_or_staff ON public.queues
  FOR SELECT USING (
    auth.uid()::text = patient_id
    OR EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.user_id = auth.uid() AND r.role IN ('admin', 'operator')
    )
  );

CREATE POLICY queues_insert_via_rpc_only ON public.queues
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY queues_update_via_rpc_only ON public.queues
  FOR UPDATE USING (FALSE) WITH CHECK (FALSE);

-- 6) RPC contract unification
CREATE OR REPLACE FUNCTION public.generate_pin_safe(p_clinic_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_pin INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id::text || CURRENT_DATE::text));

  SELECT COALESCE(MAX(display_number), 0) + 1
  INTO next_pin
  FROM public.queues
  WHERE clinic_id = p_clinic_id
    AND DATE(entered_at) = CURRENT_DATE;

  RETURN next_pin;
END;
$$;

CREATE OR REPLACE FUNCTION public.enter_queue_safe(
  p_clinic_id UUID,
  p_patient_id TEXT,
  p_patient_name TEXT DEFAULT NULL,
  p_exam_type TEXT DEFAULT 'general'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin INTEGER;
  v_queue_id UUID;
  v_existing RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id::text || p_patient_id || CURRENT_DATE::text));

  SELECT * INTO v_existing
  FROM public.queues
  WHERE clinic_id = p_clinic_id
    AND patient_id = p_patient_id
    AND DATE(entered_at) = CURRENT_DATE
    AND status IN ('waiting', 'serving')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_IN_QUEUE',
      'clinic', p_clinic_id,
      'user', p_patient_id,
      'number', v_existing.display_number
    );
  END IF;

  v_pin := public.generate_pin_safe(p_clinic_id);

  INSERT INTO public.queues (clinic_id, patient_id, patient_name, exam_type, display_number, status, entered_at)
  VALUES (p_clinic_id, p_patient_id, p_patient_name, p_exam_type, v_pin, 'waiting', NOW())
  RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object(
    'status', 'OK',
    'queue_id', v_queue_id,
    'clinic', p_clinic_id,
    'user', p_patient_id,
    'number', v_pin
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_create(p_clinic_id UUID)
RETURNS TABLE (
  queue_id UUID,
  clinic_id UUID,
  patient_id TEXT,
  display_number INTEGER,
  status TEXT,
  entered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id TEXT := auth.uid()::text;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_result := public.enter_queue_safe(p_clinic_id, v_patient_id, NULL, 'general');
  IF (v_result->>'status') <> 'OK' THEN
    RAISE EXCEPTION '%', COALESCE(v_result->>'reason', v_result->>'status');
  END IF;

  RETURN QUERY
  SELECT
    (v_result->>'queue_id')::uuid,
    p_clinic_id,
    v_patient_id,
    (v_result->>'number')::integer,
    'waiting'::text,
    NOW();
END;
$$;

-- Backward-compatible wrappers for old TEXT signatures
CREATE OR REPLACE FUNCTION public.generate_pin_safe(p_clinic_id TEXT)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public.generate_pin_safe(p_clinic_id::uuid);
$$;

CREATE OR REPLACE FUNCTION public.enter_queue_safe(
  p_clinic_id TEXT,
  p_patient_id TEXT,
  p_patient_name TEXT DEFAULT NULL,
  p_exam_type TEXT DEFAULT 'general'
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public.enter_queue_safe(p_clinic_id::uuid, p_patient_id, p_patient_name, p_exam_type);
$$;

REVOKE ALL ON FUNCTION public.generate_pin_safe(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_pin_safe(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enter_queue_safe(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enter_queue_safe(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_create(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_pin_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pin_safe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enter_queue_safe(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enter_queue_safe(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_create(UUID) TO authenticated;
