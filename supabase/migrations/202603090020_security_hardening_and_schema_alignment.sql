-- ============================================================
-- Security hardening + schema alignment
-- - Removes permissive USING (true) / WITH CHECK (true) policies
-- - Adds identity/role-aware RLS for sensitive tables
-- - Ensures compatibility entities used in code exist
-- ============================================================

-- ----------
-- Helpers
-- ----------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() ->> 'role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_actor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    auth.role() = 'service_role'
    OR public.current_app_role() IN ('admin', 'super_admin', 'operator')
    OR EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('admin', 'operator')
    )
  );
$$;

-- ----------
-- Ensure compatibility entities used by code
-- ----------
CREATE TABLE IF NOT EXISTS public.unified_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  exam_type TEXT,
  queue_number INTEGER,
  display_number INTEGER,
  priority_type TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_queue_clinic_status
  ON public.unified_queue(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_unified_queue_patient
  ON public.unified_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_unified_queue_entered
  ON public.unified_queue(entered_at DESC);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value)
VALUES ('system_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.vw_daily_activity AS
SELECT
  q.clinic_id,
  DATE(q.entered_at) AS day,
  COUNT(*) AS visits,
  COUNT(*) FILTER (WHERE q.status = 'completed') AS completed_visits,
  COUNT(*) FILTER (WHERE q.status = 'skipped') AS skipped_visits,
  AVG(EXTRACT(EPOCH FROM (q.completed_at - q.entered_at))) FILTER (WHERE q.status = 'completed') AS avg_wait_seconds
FROM public.queues q
GROUP BY q.clinic_id, DATE(q.entered_at);

CREATE OR REPLACE VIEW public.vw_today_now AS
SELECT
  (SELECT COUNT(*) FROM public.queues WHERE status IN ('waiting','serving') AND DATE(entered_at) = CURRENT_DATE) AS in_queue_now,
  (SELECT COUNT(*) FROM public.queues WHERE DATE(entered_at) = CURRENT_DATE) AS visits_today,
  (SELECT COUNT(*) FROM public.queues WHERE status = 'completed' AND DATE(entered_at) = CURRENT_DATE) AS completed_today,
  (SELECT COUNT(DISTINCT patient_id) FROM public.queues WHERE DATE(entered_at) = CURRENT_DATE) AS unique_patients_today;

-- ----------
-- Harden RLS for sensitive tables
-- ----------
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view their own data" ON public.patients;
DROP POLICY IF EXISTS "Patients can insert their own data" ON public.patients;
DROP POLICY IF EXISTS "Users can view queues" ON public.queues;
DROP POLICY IF EXISTS "Users can insert into queues" ON public.queues;
DROP POLICY IF EXISTS "Users can update their queue entries" ON public.queues;
DROP POLICY IF EXISTS "Allow public read access on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated insert on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated update on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated delete on queues" ON public.queues;
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "PINs are viewable by everyone" ON public.pins;
DROP POLICY IF EXISTS "PINs can be inserted" ON public.pins;
DROP POLICY IF EXISTS "PINs can be updated" ON public.pins;
DROP POLICY IF EXISTS "System settings are viewable by everyone" ON public.system_settings;

CREATE POLICY "patients_select_self_or_admin" ON public.patients
FOR SELECT
USING (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "patients_insert_self_or_admin" ON public.patients
FOR INSERT
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "patients_update_self_or_admin" ON public.patients
FOR UPDATE
USING (public.is_admin_actor() OR auth.uid()::text = patient_id)
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "queues_select_related_or_admin" ON public.queues
FOR SELECT
USING (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "queues_insert_related_or_admin" ON public.queues
FOR INSERT
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "queues_update_admin_only" ON public.queues
FOR UPDATE
USING (public.is_admin_actor())
WITH CHECK (public.is_admin_actor());

CREATE POLICY "queues_delete_admin_only" ON public.queues
FOR DELETE
USING (public.is_admin_actor());

CREATE POLICY "notifications_select_related_or_admin" ON public.notifications
FOR SELECT
USING (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "notifications_insert_admin_only" ON public.notifications
FOR INSERT
WITH CHECK (public.is_admin_actor());

CREATE POLICY "notifications_update_related_or_admin" ON public.notifications
FOR UPDATE
USING (public.is_admin_actor() OR auth.uid()::text = patient_id)
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "notifications_delete_admin_only" ON public.notifications
FOR DELETE
USING (public.is_admin_actor());

CREATE POLICY "pins_select_admin_only" ON public.pins
FOR SELECT
USING (public.is_admin_actor());

CREATE POLICY "pins_insert_admin_only" ON public.pins
FOR INSERT
WITH CHECK (public.is_admin_actor());

CREATE POLICY "pins_update_admin_only" ON public.pins
FOR UPDATE
USING (public.is_admin_actor())
WITH CHECK (public.is_admin_actor());

CREATE POLICY "system_settings_select_admin_only" ON public.system_settings
FOR SELECT
USING (public.is_admin_actor());

CREATE POLICY "system_settings_insert_admin_only" ON public.system_settings
FOR INSERT
WITH CHECK (public.is_admin_actor());

CREATE POLICY "system_settings_update_admin_only" ON public.system_settings
FOR UPDATE
USING (public.is_admin_actor())
WITH CHECK (public.is_admin_actor());

CREATE POLICY "system_settings_delete_admin_only" ON public.system_settings
FOR DELETE
USING (public.is_admin_actor());
