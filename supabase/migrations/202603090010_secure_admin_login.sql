-- Secure admin login hardening
-- 1) Add secure hash columns for admin passwords
-- 2) Support legacy password fallback + rehash on first successful login
-- 3) Add per-username+IP rate limiting with lockout window

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  ip_address INET,
  failed_count INTEGER NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  lockout_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (username, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_lockout_until
  ON public.admin_login_attempts(lockout_until);

CREATE OR REPLACE FUNCTION public.admin_auth_login(
  p_username TEXT,
  p_password TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_id UUID,
  username TEXT,
  role TEXT,
  lockout_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin public.admin_users%ROWTYPE;
  v_attempt public.admin_login_attempts%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_valid BOOLEAN := FALSE;
  v_lockout_minutes INTEGER := 15;
  v_max_failures INTEGER := 5;
BEGIN
  IF COALESCE(TRIM(p_username), '') = '' OR COALESCE(p_password, '') = '' THEN
    RETURN QUERY SELECT FALSE, 'Invalid credentials', NULL::UUID, NULL::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  SELECT * INTO v_admin
  FROM public.admin_users
  WHERE LOWER(admin_users.username) = LOWER(p_username)
    AND COALESCE(admin_users.is_active, TRUE) = TRUE
  LIMIT 1;

  INSERT INTO public.admin_login_attempts (username, ip_address)
  VALUES (LOWER(p_username), p_ip_address)
  ON CONFLICT (username, ip_address) DO NOTHING;

  SELECT * INTO v_attempt
  FROM public.admin_login_attempts
  WHERE admin_login_attempts.username = LOWER(p_username)
    AND admin_login_attempts.ip_address IS NOT DISTINCT FROM p_ip_address
  LIMIT 1;

  IF v_attempt.lockout_until IS NOT NULL AND v_attempt.lockout_until > v_now THEN
    RETURN QUERY SELECT
      FALSE,
      'Invalid credentials',
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      GREATEST(1, EXTRACT(EPOCH FROM (v_attempt.lockout_until - v_now))::INTEGER);
    RETURN;
  END IF;

  IF v_admin.id IS NOT NULL THEN
    IF v_admin.password_hash IS NOT NULL AND v_admin.password_hash LIKE '$2%' THEN
      v_valid := crypt(p_password, v_admin.password_hash) = v_admin.password_hash;
    ELSIF v_admin.password IS NOT NULL THEN
      v_valid := (v_admin.password = p_password);
    END IF;
  END IF;

  IF NOT v_valid THEN
    UPDATE public.admin_login_attempts
    SET failed_count = COALESCE(failed_count, 0) + 1,
        first_failed_at = COALESCE(first_failed_at, v_now),
        last_failed_at = v_now,
        lockout_until = CASE
          WHEN COALESCE(failed_count, 0) + 1 >= v_max_failures THEN v_now + make_interval(mins => v_lockout_minutes)
          ELSE NULL
        END,
        updated_at = v_now
    WHERE username = LOWER(p_username)
      AND ip_address IS NOT DISTINCT FROM p_ip_address;

    UPDATE public.admin_users
    SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
        last_failed_login = v_now,
        lockout_until = CASE
          WHEN COALESCE(failed_login_attempts, 0) + 1 >= v_max_failures THEN v_now + make_interval(mins => v_lockout_minutes)
          ELSE NULL
        END,
        updated_at = v_now
    WHERE id = v_admin.id;

    RETURN QUERY SELECT FALSE, 'Invalid credentials', NULL::UUID, NULL::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  UPDATE public.admin_users
  SET password_hash = COALESCE(password_hash, crypt(p_password, gen_salt('bf', 12))),
      password = CASE WHEN password_hash IS NULL THEN NULL ELSE password END,
      failed_login_attempts = 0,
      lockout_until = NULL,
      last_failed_login = NULL,
      last_login = v_now,
      updated_at = v_now
  WHERE id = v_admin.id;

  UPDATE public.admin_login_attempts
  SET failed_count = 0,
      first_failed_at = NULL,
      last_failed_at = NULL,
      lockout_until = NULL,
      updated_at = v_now
  WHERE username = LOWER(p_username)
    AND ip_address IS NOT DISTINCT FROM p_ip_address;

  RETURN QUERY SELECT TRUE, 'OK', v_admin.id, v_admin.username, v_admin.role, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_auth_login(TEXT, TEXT, INET) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_auth_login(TEXT, TEXT, INET) TO service_role;
