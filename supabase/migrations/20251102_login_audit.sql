-- Migration: Login Audit Trail
-- Created: 2025-11-02
-- Purpose: Track login attempts for security monitoring and analytics

-- Create login_audit table
CREATE TABLE IF NOT EXISTS public.login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON public.login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON public.login_audit(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON public.login_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_success ON public.login_audit(success);

-- Enable Row Level Security (RLS)
ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authenticated users can see their own audit logs
CREATE POLICY "Users can view own login audit"
  ON public.login_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can insert audit records
CREATE POLICY "Service role can insert audit records"
  ON public.login_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.login_audit TO authenticated;
GRANT INSERT ON public.login_audit TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.login_audit IS 'Audit trail for login attempts';
COMMENT ON COLUMN public.login_audit.user_id IS 'Reference to authenticated user (null for failed attempts with invalid email)';
COMMENT ON COLUMN public.login_audit.email IS 'Email address used in login attempt';
COMMENT ON COLUMN public.login_audit.success IS 'Whether login attempt succeeded';
COMMENT ON COLUMN public.login_audit.ip_address IS 'IP address of login attempt';
COMMENT ON COLUMN public.login_audit.user_agent IS 'User agent string from login request';
COMMENT ON COLUMN public.login_audit.error_message IS 'Error message if login failed';
