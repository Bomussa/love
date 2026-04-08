-- ============================================================
-- MMC-MMS Final Comprehensive Fixes Migration
-- Date: 2026-01-24
-- Description: Complete implementation of all required fixes
-- ============================================================

-- 1. PERFORMANCE INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_unified_queue_status ON public.unified_queue(status);
CREATE INDEX IF NOT EXISTS idx_unified_queue_clinic_id ON public.unified_queue(clinic_id);
CREATE INDEX IF NOT EXISTS idx_unified_queue_queue_date ON public.unified_queue(queue_date);
CREATE INDEX IF NOT EXISTS idx_unified_queue_status_date ON public.unified_queue(status, queue_date);
CREATE INDEX IF NOT EXISTS idx_patient_routes_patient_id ON public.patient_routes(patient_id);

-- 2. ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 3. CLINIC WEIGHT SYSTEM
-- ============================================================
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1;

-- 4. ATOMIC FUNCTIONS
-- ============================================================

-- Get next queue number atomically
CREATE OR REPLACE FUNCTION get_next_queue_number(p_clinic_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(display_number), 0) + 1 INTO next_num
    FROM public.unified_queue
    WHERE clinic_id = p_clinic_id AND queue_date = CURRENT_DATE
    FOR UPDATE;
    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Secure postpone with limit
CREATE OR REPLACE FUNCTION postpone_patient_secure(p_queue_id UUID, p_max_postpones INTEGER DEFAULT 3)
RETURNS TABLE(new_status TEXT, new_count INTEGER) AS $$
DECLARE
    current_count INTEGER;
    result_status TEXT;
BEGIN
    SELECT COALESCE(postpone_count, 0) INTO current_count
    FROM public.unified_queue
    WHERE id = p_queue_id
    FOR UPDATE;
    
    IF current_count >= p_max_postpones THEN
        result_status := 'cancelled';
    ELSE
        result_status := 'postponed';
    END IF;
    
    UPDATE public.unified_queue
    SET status = result_status, postpone_count = current_count + 1
    WHERE id = p_queue_id;
    
    RETURN QUERY SELECT result_status, current_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Calculate weighted progress
CREATE OR REPLACE FUNCTION calculate_weighted_progress(p_patient_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_weight NUMERIC := 0;
    completed_weight NUMERIC := 0;
BEGIN
    SELECT 
        COALESCE(SUM(c.weight), 0),
        COALESCE(SUM(CASE WHEN uq.status = 'completed' THEN c.weight ELSE 0 END), 0)
    INTO total_weight, completed_weight
    FROM public.unified_queue uq
    JOIN public.clinics c ON uq.clinic_id = c.id
    WHERE uq.patient_id = p_patient_id AND uq.queue_date = CURRENT_DATE;
    
    IF total_weight = 0 THEN RETURN 0; END IF;
    RETURN ROUND((completed_weight / total_weight) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Verify clinic PIN securely
CREATE OR REPLACE FUNCTION verify_clinic_pin(p_clinic_id UUID, p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    stored_pin TEXT;
BEGIN
    SELECT pin_code INTO stored_pin FROM public.clinics WHERE id = p_clinic_id;
    RETURN stored_pin = p_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check route completion trigger
CREATE OR REPLACE FUNCTION check_route_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.stations) AS s 
        WHERE s->>'status' != 'completed'
    ) THEN
        UPDATE public.unified_queue 
        SET status = 'completed' 
        WHERE patient_id = NEW.patient_id AND queue_date = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. SECURITY POLICIES
-- ============================================================
DROP POLICY IF EXISTS "settings_update_anon" ON public.settings;
DROP POLICY IF EXISTS "settings_insert_anon" ON public.settings;
REVOKE ALL ON TABLE public.pins FROM anon;
GRANT SELECT ON TABLE public.pins TO authenticated;

-- 6. MATERIALIZED VIEW FOR STATS
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_stats_mv AS
SELECT 
    queue_date,
    clinic_id,
    COUNT(*) as total_patients,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))/60) as avg_wait_minutes
FROM public.unified_queue
GROUP BY queue_date, clinic_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stats_mv ON public.daily_stats_mv(queue_date, clinic_id);

-- 7. DAILY CLEANUP CRON (already created via MCP)
-- Runs at 00:00 daily to clean old queue data
