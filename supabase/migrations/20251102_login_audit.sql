-- Migration: Login Audit Trail
-- Created: 2025-11-02
-- Purpose: Track login attempts for security and analytics

-- Create login_audit table
CREATE TABLE IF NOT EXISTS public.login_audit (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON public.login_audit(email);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON public.login_audit(created_at DESC);

-- Create index on success for filtering failed attempts
CREATE INDEX IF NOT EXISTS idx_login_audit_success ON public.login_audit(success);

-- Enable Row Level Security
ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert audit records
CREATE POLICY "Service role can insert login audit"
  ON public.login_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Only service role and authenticated admins can read audit records
CREATE POLICY "Service role can read login audit"
  ON public.login_audit
  FOR SELECT
  TO service_role
  USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.login_audit TO service_role;

-- Add comment to table
COMMENT ON TABLE public.login_audit IS 'Audit trail for login attempts - tracks both successful and failed authentication events';

-- Add comments to columns
COMMENT ON COLUMN public.login_audit.email IS 'Email address used in login attempt';
COMMENT ON COLUMN public.login_audit.success IS 'Whether the login attempt was successful';
COMMENT ON COLUMN public.login_audit.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN public.login_audit.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN public.login_audit.error_message IS 'Error message if login failed';
COMMENT ON COLUMN public.login_audit.created_at IS 'Timestamp when the login attempt occurred';
