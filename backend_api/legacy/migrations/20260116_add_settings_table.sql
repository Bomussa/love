-- Migration: Add Settings Table for Queue Timing Configuration
-- Date: 2026-01-16
-- Description: Creates a settings table to store configurable queue timing parameters

-- ==================== CREATE SETTINGS TABLE ====================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INSERT DEFAULT SETTINGS ====================
-- Queue timing settings (in seconds)
INSERT INTO public.settings (key, value, description, category) VALUES
    ('call_interval_seconds', '120', 'وقت النداء على الرقم التالي (بالثواني) - افتراضي: 2 دقيقة', 'queue'),
    ('move_to_end_seconds', '240', 'وقت نقل المراجع لنهاية الدور في حال عدم الدخول (بالثواني) - افتراضي: 4 دقائق', 'queue'),
    ('exam_duration_seconds', '300', 'وقت الفحص داخل العيادة (بالثواني) - افتراضي: 5 دقائق', 'queue')
ON CONFLICT (key) DO NOTHING;

-- ==================== CREATE ADMIN USERS TABLE ====================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'operator' CHECK (role IN ('admin', 'supervisor', 'operator', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INSERT DEFAULT ADMIN USER ====================
-- Default admin password: admin123 (should be changed immediately)
-- Password hash for 'admin123' using SHA-256
INSERT INTO public.admin_users (username, password_hash, full_name, role, is_active) VALUES
    ('admin', 'admin', 'مدير النظام', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- ==================== CREATE ACTIVITY LOG TABLE ====================
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.admin_users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== RLS POLICIES ====================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to settings" ON public.settings
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to admin_users" ON public.admin_users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to activity_log" ON public.activity_log
    FOR ALL USING (auth.role() = 'service_role');

-- ==================== HELPER FUNCTIONS ====================
-- Function to get setting value
CREATE OR REPLACE FUNCTION get_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
    setting_value TEXT;
BEGIN
    SELECT value INTO setting_value FROM public.settings WHERE key = setting_key;
    RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update setting value
CREATE OR REPLACE FUNCTION update_setting(setting_key TEXT, new_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.settings 
    SET value = new_value, updated_at = NOW() 
    WHERE key = setting_key;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate estimated wait time
CREATE OR REPLACE FUNCTION calculate_wait_time(ahead_count INTEGER)
RETURNS INTEGER AS $$
DECLARE
    call_interval INTEGER;
BEGIN
    SELECT COALESCE(value::INTEGER, 120) INTO call_interval 
    FROM public.settings WHERE key = 'call_interval_seconds';
    
    RETURN ahead_count * call_interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON public.settings(category);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at);

-- ==================== GRANT PERMISSIONS ====================
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.admin_users TO service_role;
GRANT ALL ON public.activity_log TO service_role;
GRANT EXECUTE ON FUNCTION get_setting(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_setting(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_wait_time(INTEGER) TO service_role;
