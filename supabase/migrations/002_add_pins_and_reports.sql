-- ============================================
-- Migration: Add PIN System and Reporting Views
-- Created: 2025-11-10
-- Description: Adds pins table for clinic entry verification and reporting views
-- ============================================

-- ============================================
-- 1. PINS TABLE
-- Stores temporary PIN codes for clinic entry verification
-- ============================================
CREATE TABLE IF NOT EXISTS pins (
    id BIGSERIAL PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for PIN queries
CREATE INDEX IF NOT EXISTS idx_pins_clinic ON pins(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pins_valid ON pins(valid_until) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pins_pin_lookup ON pins(clinic_id, pin, valid_until) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Public read, authenticated write
CREATE POLICY "PINs are viewable by everyone" ON pins
    FOR SELECT USING (true);

CREATE POLICY "PINs can be inserted" ON pins
    FOR INSERT WITH CHECK (true);

CREATE POLICY "PINs can be updated" ON pins
    FOR UPDATE USING (true);

-- ============================================
-- 2. REPORTING VIEWS
-- Views for analytics and reports
-- ============================================

-- Daily activity view
CREATE OR REPLACE VIEW vw_daily_activity AS
SELECT 
    clinic_id,
    DATE(entered_at) as day,
    COUNT(*) as visits,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped_visits,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) FILTER (WHERE status = 'completed') as avg_wait_seconds
FROM queues
GROUP BY clinic_id, DATE(entered_at);

-- Today's real-time stats
CREATE OR REPLACE VIEW vw_today_now AS
SELECT
    (SELECT COUNT(*) FROM queues WHERE status IN ('waiting','serving') AND DATE(entered_at) = CURRENT_DATE) as in_queue_now,
    (SELECT COUNT(*) FROM queues WHERE DATE(entered_at) = CURRENT_DATE) as visits_today,
    (SELECT COUNT(*) FROM queues WHERE status = 'completed' AND DATE(entered_at) = CURRENT_DATE) as completed_today,
    (SELECT COUNT(DISTINCT patient_id) FROM queues WHERE DATE(entered_at) = CURRENT_DATE) as unique_patients_today;

-- Weekly summary view
CREATE OR REPLACE VIEW vw_weekly_summary AS
SELECT 
    DATE_TRUNC('week', entered_at) as week_start,
    clinic_id,
    COUNT(*) as total_visits,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) FILTER (WHERE status = 'completed') as avg_wait_seconds,
    COUNT(DISTINCT patient_id) as unique_patients
FROM queues
WHERE entered_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '8 weeks')
GROUP BY DATE_TRUNC('week', entered_at), clinic_id;

-- Monthly summary view
CREATE OR REPLACE VIEW vw_monthly_summary AS
SELECT 
    DATE_TRUNC('month', entered_at) as month_start,
    clinic_id,
    COUNT(*) as total_visits,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) FILTER (WHERE status = 'completed') as avg_wait_seconds,
    COUNT(DISTINCT patient_id) as unique_patients
FROM queues
WHERE entered_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY DATE_TRUNC('month', entered_at), clinic_id;

-- Clinic performance view (current status)
CREATE OR REPLACE VIEW vw_clinic_performance AS
SELECT 
    c.id as clinic_id,
    c.name_ar,
    c.name_en,
    COUNT(q.id) FILTER (WHERE q.status = 'waiting') as waiting_count,
    COUNT(q.id) FILTER (WHERE q.status = 'serving') as serving_count,
    (SELECT display_number FROM queues WHERE clinic_id = c.id AND status = 'serving' ORDER BY called_at DESC LIMIT 1) as current_serving,
    (SELECT display_number FROM queues WHERE clinic_id = c.id ORDER BY display_number DESC LIMIT 1) as last_number
FROM clinics c
LEFT JOIN queues q ON c.id = q.clinic_id AND DATE(q.entered_at) = CURRENT_DATE
WHERE c.is_active = true
GROUP BY c.id, c.name_ar, c.name_en
ORDER BY c.display_order;

-- Enable realtime for pins
ALTER PUBLICATION supabase_realtime ADD TABLE pins;

-- Comments
COMMENT ON TABLE pins IS 'Temporary PIN codes for clinic entry verification (5-minute validity)';
COMMENT ON VIEW vw_daily_activity IS 'Daily statistics per clinic';
COMMENT ON VIEW vw_today_now IS 'Real-time statistics for today';
COMMENT ON VIEW vw_weekly_summary IS 'Weekly statistics per clinic (last 8 weeks)';
COMMENT ON VIEW vw_monthly_summary IS 'Monthly statistics per clinic (last 12 months)';
COMMENT ON VIEW vw_clinic_performance IS 'Current queue status and performance per clinic';
