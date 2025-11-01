-- Minimal Queue backend hardening (safe to run once)
CREATE TYPE IF NOT EXISTS queue_status AS ENUM ('waiting','called','done','cancelled');
ALTER TABLE IF EXISTS public.queue
  ALTER COLUMN status TYPE queue_status USING status::queue_status,
  ALTER COLUMN clinic_id SET NOT NULL,
  ALTER COLUMN patient_id SET NOT NULL,
  ALTER COLUMN position SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_patient_active ON public.queue(patient_id) WHERE status IN ('waiting','called');
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_clinic_position_active ON public.queue(clinic_id, position) WHERE status IN ('waiting','called');
CREATE INDEX IF NOT EXISTS idx_queue_clinic_status_pos ON public.queue(clinic_id, status, position);
CREATE INDEX IF NOT EXISTS idx_queue_entered_at ON public.queue(entered_at);
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.clinic_staff (user_id uuid NOT NULL, clinic_id text NOT NULL, role text NOT NULL CHECK (role IN ('admin','staff')), PRIMARY KEY (user_id, clinic_id));
CREATE POLICY IF NOT EXISTS queue_read_auth ON public.queue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_staff s WHERE s.user_id = auth.uid() AND s.clinic_id = clinic_id) OR patient_id::text = auth.uid()::text);
CREATE POLICY IF NOT EXISTS queue_insert_staff ON public.queue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.clinic_staff s WHERE s.user_id = auth.uid() AND s.clinic_id = clinic_id));
CREATE POLICY IF NOT EXISTS queue_update_staff ON public.queue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_staff s WHERE s.user_id = auth.uid() AND s.clinic_id = clinic_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.clinic_staff s WHERE s.user_id = auth.uid() AND s.clinic_id = clinic_id));
