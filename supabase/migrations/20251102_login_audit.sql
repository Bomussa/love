-- Migration: Login Audit Table
-- Date: 2025-11-02
-- Purpose: Track login attempts for security monitoring and analytics

-- Create login_audit table
CREATE TABLE IF NOT EXISTS public.login_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  email VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON public.login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON public.login_audit(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON public.login_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_success ON public.login_audit(success);
CREATE INDEX IF NOT EXISTS idx_login_audit_ip_address ON public.login_audit(ip_address);

-- Create composite index for failed login monitoring
CREATE INDEX IF NOT EXISTS idx_login_audit_failed_attempts 
  ON public.login_audit(email, created_at DESC) 
  WHERE success = false;

-- Add RLS (Row Level Security) policies
ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything
CREATE POLICY service_role_all ON public.login_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view their own audit logs
CREATE POLICY user_view_own_audit ON public.login_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.login_audit IS 'Audit trail of all login attempts for security monitoring';
COMMENT ON COLUMN public.login_audit.user_id IS 'UUID of the user (null for failed attempts with invalid users)';
COMMENT ON COLUMN public.login_audit.email IS 'Email address used in login attempt';
COMMENT ON COLUMN public.login_audit.success IS 'Whether the login attempt was successful';
COMMENT ON COLUMN public.login_audit.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN public.login_audit.user_agent IS 'User agent string of the client';
COMMENT ON COLUMN public.login_audit.error_message IS 'Error message if login failed';
COMMENT ON COLUMN public.login_audit.created_at IS 'Timestamp of the login attempt';

-- Create a function to clean up old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_audit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.login_audit
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_old_login_audit() TO service_role;

-- Add comment to function
COMMENT ON FUNCTION public.cleanup_old_login_audit() IS 'Removes login audit records older than 90 days';
