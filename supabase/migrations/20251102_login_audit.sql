-- Migration: Login Audit Table
-- Created: 2025-11-02
-- Purpose: Track login attempts for security and monitoring

-- Create login_audit table to track authentication events
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON login_audit(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_success ON login_audit(success);

-- Add RLS policies for login_audit table
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert audit records
CREATE POLICY "Service role can insert login audit records"
  ON login_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can read all audit records
CREATE POLICY "Service role can read all login audit records"
  ON login_audit
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Authenticated users can only see their own login history
CREATE POLICY "Users can view their own login history"
  ON login_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE login_audit IS 'Audit log for login attempts and authentication events';
COMMENT ON COLUMN login_audit.user_id IS 'Reference to auth.users, NULL for failed attempts with unknown user';
COMMENT ON COLUMN login_audit.success IS 'Whether the login attempt was successful';
COMMENT ON COLUMN login_audit.ip_address IS 'IP address of the login attempt';
COMMENT ON COLUMN login_audit.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN login_audit.error_message IS 'Error message for failed login attempts';
