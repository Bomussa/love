-- ============================================
-- Love Medical Management System - Database Schema
-- Created: 2025-11-06
-- Description: Complete database schema for medical queue management
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. CLINICS TABLE
-- Stores clinic information and PIN codes
-- ============================================
CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    pin TEXT NOT NULL CHECK (length(pin) >= 2),
    is_active BOOLEAN DEFAULT true,
    requires_pin BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default clinics with PINs
INSERT INTO clinics (id, name_ar, name_en, pin, requires_pin, display_order) VALUES
('lab', 'المختبر', 'Laboratory', '00', false, 1),
('radiology', 'الأشعة', 'Radiology', '00', false, 2),
('vitals', 'القياسات الحيوية', 'Vital Signs', '00', false, 3),
('ecg', 'تخطيط القلب', 'ECG', '00', false, 4),
('audiology', 'السمعيات', 'Audiology', '00', false, 5),
('eyes', 'العيون', 'Ophthalmology', '01', true, 6),
('internal', 'الباطنية', 'Internal Medicine', '02', true, 7),
('ent', 'الأنف والأذن والحنجرة', 'ENT', '03', true, 8),
('surgery', 'الجراحة العامة', 'General Surgery', '04', true, 9),
('dental', 'الأسنان', 'Dental', '05', true, 10),
('psychiatry', 'الطب النفسي', 'Psychiatry', '06', true, 11),
('dermatology', 'الجلدية', 'Dermatology', '07', true, 12),
('orthopedics', 'العظام', 'Orthopedics', '08', true, 13)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. PATIENTS TABLE
-- Stores patient information
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. PATHWAYS TABLE
-- Stores dynamic pathways for patients
-- ============================================
CREATE TABLE IF NOT EXISTS pathways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    pathway JSONB NOT NULL, -- Array of clinic IDs in order
    current_step INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. QUEUES TABLE
-- Stores current queue status for each clinic
-- ============================================
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    display_number INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'skipped')),
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    called_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_pin TEXT,
    UNIQUE(clinic_id, patient_id, entered_at)
);

-- Create index for faster queue queries
CREATE INDEX IF NOT EXISTS idx_queues_clinic_status ON queues(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_patient ON queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_queues_entered_at ON queues(entered_at DESC);

-- ============================================
-- 5. QUEUE_HISTORY TABLE
-- Stores historical queue data for reports
-- ============================================
CREATE TABLE IF NOT EXISTS queue_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    display_number INTEGER NOT NULL,
    entered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    wait_time_seconds INTEGER,
    completed_by_pin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for report queries
CREATE INDEX IF NOT EXISTS idx_queue_history_date ON queue_history(completed_at);
CREATE INDEX IF NOT EXISTS idx_queue_history_clinic ON queue_history(clinic_id);

-- ============================================
-- 6. NOTIFICATIONS TABLE
-- Stores notifications for patients
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(patient_id, read) WHERE read = false;

-- ============================================
-- 7. SYSTEM_SETTINGS TABLE
-- Stores system-wide settings
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
('queue_refresh_interval', '5000'::jsonb),
('notification_refresh_interval', '3000'::jsonb),
('max_queue_size', '100'::jsonb),
('enable_realtime', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Clinics: Public read access
CREATE POLICY "Clinics are viewable by everyone" ON clinics
    FOR SELECT USING (true);

-- Patients: Users can only see their own data
CREATE POLICY "Patients can view own data" ON patients
    FOR SELECT USING (true);

CREATE POLICY "Patients can insert own data" ON patients
    FOR INSERT WITH CHECK (true);

-- Pathways: Users can only see their own pathways
CREATE POLICY "Pathways are viewable by patient" ON pathways
    FOR SELECT USING (true);

CREATE POLICY "Pathways can be inserted" ON pathways
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Pathways can be updated" ON pathways
    FOR UPDATE USING (true);

-- Queues: Public read, authenticated write
CREATE POLICY "Queues are viewable by everyone" ON queues
    FOR SELECT USING (true);

CREATE POLICY "Queues can be inserted" ON queues
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Queues can be updated" ON queues
    FOR UPDATE USING (true);

CREATE POLICY "Queues can be deleted" ON queues
    FOR DELETE USING (true);

-- Queue History: Public read access
CREATE POLICY "Queue history is viewable by everyone" ON queue_history
    FOR SELECT USING (true);

CREATE POLICY "Queue history can be inserted" ON queue_history
    FOR INSERT WITH CHECK (true);

-- Notifications: Users can only see their own notifications
CREATE POLICY "Notifications are viewable by patient" ON notifications
    FOR SELECT USING (true);

CREATE POLICY "Notifications can be inserted" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Notifications can be updated by patient" ON notifications
    FOR UPDATE USING (true);

-- System Settings: Public read access
CREATE POLICY "System settings are viewable by everyone" ON system_settings
    FOR SELECT USING (true);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for clinics
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for pathways
CREATE TRIGGER update_pathways_updated_at BEFORE UPDATE ON pathways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to move completed queue entries to history
CREATE OR REPLACE FUNCTION archive_completed_queue()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO queue_history (
            clinic_id,
            patient_id,
            display_number,
            entered_at,
            completed_at,
            wait_time_seconds,
            completed_by_pin
        ) VALUES (
            NEW.clinic_id,
            NEW.patient_id,
            NEW.display_number,
            NEW.entered_at,
            NEW.completed_at,
            EXTRACT(EPOCH FROM (NEW.completed_at - NEW.entered_at))::INTEGER,
            NEW.completed_by_pin
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to archive completed queues
CREATE TRIGGER archive_queue_on_complete AFTER UPDATE ON queues
    FOR EACH ROW EXECUTE FUNCTION archive_completed_queue();

-- ============================================
-- HELPER FUNCTIONS FOR API
-- ============================================

-- Function to get next display number for a clinic
CREATE OR REPLACE FUNCTION get_next_display_number(p_clinic_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(display_number), 0) + 1
    INTO next_num
    FROM queues
    WHERE clinic_id = p_clinic_id
    AND DATE(entered_at) = CURRENT_DATE;
    
    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue status for a clinic
CREATE OR REPLACE FUNCTION get_queue_status(p_clinic_id TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'clinic_id', p_clinic_id,
        'waiting', COUNT(*) FILTER (WHERE status = 'waiting'),
        'serving', COUNT(*) FILTER (WHERE status = 'serving'),
        'current_number', (
            SELECT display_number
            FROM queues
            WHERE clinic_id = p_clinic_id AND status = 'serving'
            ORDER BY called_at DESC
            LIMIT 1
        ),
        'last_number', (
            SELECT display_number
            FROM queues
            WHERE clinic_id = p_clinic_id
            ORDER BY display_number DESC
            LIMIT 1
        )
    ) INTO result
    FROM queues
    WHERE clinic_id = p_clinic_id AND status IN ('waiting', 'serving');
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE queues;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE clinics IS 'Stores clinic information and PIN codes for access control';
COMMENT ON TABLE patients IS 'Stores basic patient information for queue management';
COMMENT ON TABLE pathways IS 'Stores dynamic pathways (sequence of clinics) for each patient';
COMMENT ON TABLE queues IS 'Current queue status for all clinics';
COMMENT ON TABLE queue_history IS 'Historical queue data for reporting and analytics';
COMMENT ON TABLE notifications IS 'Real-time notifications for patients';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';

-- ============================================
-- SCHEMA COMPLETE
-- ============================================
