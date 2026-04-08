-- ==================== Add Sessions Table for QR Code System ====================
-- Date: 2026-01-24
-- Description: Creates a sessions table for QR code authentication system
-- ==================== CREATE SESSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    patient_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    device_type VARCHAR(50),
    device_info JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON public.sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- ==================== RLS POLICIES ====================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for session validation (QR scan)
CREATE POLICY "Allow anonymous session read" ON public.sessions
    FOR SELECT USING (true);

-- Allow anonymous session creation (from admin panel)
CREATE POLICY "Allow anonymous session insert" ON public.sessions
    FOR INSERT WITH CHECK (true);

-- Allow anonymous session update (mark as used)
CREATE POLICY "Allow anonymous session update" ON public.sessions
    FOR UPDATE USING (true);

-- ==================== HELPER FUNCTIONS ====================

-- Function to create a new session
CREATE OR REPLACE FUNCTION create_session(p_patient_id TEXT)
RETURNS TABLE(token TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
    new_token TEXT;
    new_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate unique token
    new_token := encode(gen_random_bytes(32), 'hex');
    new_expires := NOW() + INTERVAL '24 hours';
    
    -- Insert session
    INSERT INTO public.sessions (token, patient_id, expires_at)
    VALUES (new_token, p_patient_id, new_expires);
    
    RETURN QUERY SELECT new_token, new_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate session
CREATE OR REPLACE FUNCTION validate_session(p_token TEXT)
RETURNS TABLE(
    valid BOOLEAN,
    patient_id TEXT,
    error_code TEXT
) AS $$
DECLARE
    session_record RECORD;
BEGIN
    -- Find session
    SELECT * INTO session_record FROM public.sessions WHERE token = p_token;
    
    -- Check if exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'SESSION_NOT_FOUND'::TEXT;
        RETURN;
    END IF;
    
    -- Check if expired
    IF session_record.expires_at < NOW() THEN
        UPDATE public.sessions SET status = 'expired' WHERE token = p_token;
        RETURN QUERY SELECT false, NULL::TEXT, 'SESSION_EXPIRED'::TEXT;
        RETURN;
    END IF;
    
    -- Check if already used
    IF session_record.status = 'used' THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'SESSION_ALREADY_USED'::TEXT;
        RETURN;
    END IF;
    
    -- Mark as used
    UPDATE public.sessions 
    SET status = 'used', used_at = NOW() 
    WHERE token = p_token;
    
    RETURN QUERY SELECT true, session_record.patient_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update session device info
CREATE OR REPLACE FUNCTION update_session_device(p_token TEXT, p_device_type TEXT, p_device_info JSONB DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.sessions 
    SET device_type = p_device_type, device_info = p_device_info
    WHERE token = p_token;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get session statistics
CREATE OR REPLACE FUNCTION get_session_stats()
RETURNS TABLE(
    total BIGINT,
    active BIGINT,
    used BIGINT,
    expired BIGINT,
    ios_count BIGINT,
    android_count BIGINT,
    desktop_count BIGINT
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active,
        COUNT(*) FILTER (WHERE status = 'used')::BIGINT as used,
        COUNT(*) FILTER (WHERE status = 'expired' OR expires_at < NOW())::BIGINT as expired,
        COUNT(*) FILTER (WHERE device_type = 'iOS')::BIGINT as ios_count,
        COUNT(*) FILTER (WHERE device_type = 'Android')::BIGINT as android_count,
        COUNT(*) FILTER (WHERE device_type = 'Desktop')::BIGINT as desktop_count
    FROM public.sessions
    WHERE created_at >= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== GRANT PERMISSIONS ====================
GRANT ALL ON public.sessions TO anon;
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
GRANT EXECUTE ON FUNCTION create_session(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_session(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_device(TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION update_session_device(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_session_stats() TO authenticated;

-- ==================== ADD THEME SETTINGS ====================
-- Add theme settings to existing settings table
INSERT INTO public.settings (key, value, description, category) VALUES
    ('theme_current', 'professional-medical', 'الثيم الحالي للتطبيق', 'theme'),
    ('theme_selector_enabled', 'true', 'تفعيل اختيار الثيم', 'theme'),
    ('theme_preview_enabled', 'true', 'تفعيل معاينة الثيم', 'theme')
ON CONFLICT (key) DO NOTHING;
