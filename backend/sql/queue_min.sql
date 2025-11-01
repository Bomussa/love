-- Minimal queue backend (no frontend changed)
-- Safe to run multiple times (uses IF NOT EXISTS)

-- 1) Table
CREATE TABLE IF NOT EXISTS public.queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  patient_name text,
  clinic_id text NOT NULL,
  exam_type text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','called','completed','cancelled')),
  position integer,
  qr_code text,
  entered_at timestamptz DEFAULT now(),
  called_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_queue_clinic ON public.queue (clinic_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON public.queue (status);
CREATE INDEX IF NOT EXISTS idx_queue_entered_at ON public.queue (entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_meta_gin ON public.queue USING GIN (metadata);

-- 3) Prevent duplicates for active items
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_patient_active
  ON public.queue (patient_id)
  WHERE status IN ('waiting','called');

CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_clinic_position_active
  ON public.queue (clinic_id, COALESCE(position, -1))
  WHERE status IN ('waiting','called');

-- 4) (Optional) Basic RLS scaffold – disabled by default for simplicity.
-- Uncomment to enable strict access for authenticated backoffice only.
-- ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS queue_ro ON public.queue;
-- CREATE POLICY queue_ro ON public.queue FOR SELECT USING (true);
-- (For write policies, bind to your roles/claims.)

-- 5) Helpful view (optional)
CREATE OR REPLACE VIEW public.queue_active AS
SELECT * FROM public.queue WHERE status IN ('waiting','called') ORDER BY clinic_id, position NULLS LAST, entered_at;
