-- Create admin_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create login_audit table for tracking login attempts
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (username: bomussa, password: 14490)
INSERT INTO admin_users (username, password_hash, role, is_active)
VALUES ('bomussa', crypt('14490', gen_salt('bf')), 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- Create the admin_auth_login function
CREATE OR REPLACE FUNCTION admin_auth_login(
  p_username TEXT,
  p_password TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  user_id UUID,
  username TEXT,
  role TEXT,
  lockout_seconds INTEGER,
  message TEXT
) AS $$
DECLARE
  v_user admin_users;
  v_lockout_seconds INTEGER := 0;
BEGIN
  -- Find the user
  SELECT * INTO v_user FROM admin_users WHERE admin_users.username = p_username LIMIT 1;

  -- Check if user exists
  IF v_user IS NULL THEN
    INSERT INTO login_audit (username, ip_address, success) VALUES (p_username, p_ip_address, false);
    RETURN QUERY SELECT false, NULL::UUID, p_username, NULL::TEXT, 0, 'Invalid credentials'::TEXT;
    RETURN;
  END IF;

  -- Check if user is active
  IF NOT v_user.is_active THEN
    INSERT INTO login_audit (username, ip_address, success) VALUES (p_username, p_ip_address, false);
    RETURN QUERY SELECT false, v_user.id, v_user.username, v_user.role, 0, 'User account is inactive'::TEXT;
    RETURN;
  END IF;

  -- Verify password
  IF v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
    -- Update last login
    UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = v_user.id;
    
    -- Log successful login
    INSERT INTO login_audit (username, ip_address, success) VALUES (p_username, p_ip_address, true);
    
    RETURN QUERY SELECT true, v_user.id, v_user.username, v_user.role, 0, 'Login successful'::TEXT;
  ELSE
    -- Log failed login
    INSERT INTO login_audit (username, ip_address, success) VALUES (p_username, p_ip_address, false);
    RETURN QUERY SELECT false, v_user.id, v_user.username, v_user.role, 0, 'Invalid credentials'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage admin users
CREATE OR REPLACE FUNCTION create_admin_user(
  p_username TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  success BOOLEAN,
  user_id UUID,
  message TEXT
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  BEGIN
    INSERT INTO admin_users (username, password_hash, role)
    VALUES (p_username, crypt(p_password, gen_salt('bf')), p_role)
    RETURNING id INTO v_user_id;
    
    RETURN QUERY SELECT true, v_user_id, 'Admin user created successfully'::TEXT;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Username already exists'::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete admin user
CREATE OR REPLACE FUNCTION delete_admin_user(p_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  DELETE FROM admin_users WHERE id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Admin user deleted successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Admin user not found'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update admin user
CREATE OR REPLACE FUNCTION update_admin_user(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  UPDATE admin_users SET
    username = COALESCE(p_username, username),
    password_hash = CASE WHEN p_password IS NOT NULL THEN crypt(p_password, gen_salt('bf')) ELSE password_hash END,
    role = COALESCE(p_role, role),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Admin user updated successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Admin user not found'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to list admin users
CREATE OR REPLACE FUNCTION list_admin_users()
RETURNS TABLE (
  id UUID,
  username TEXT,
  role TEXT,
  is_active BOOLEAN,
  last_login TIMESTAMP,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY SELECT
    admin_users.id,
    admin_users.username,
    admin_users.role,
    admin_users.is_active,
    admin_users.last_login,
    admin_users.created_at
  FROM admin_users
  ORDER BY admin_users.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_auth_login(TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_admin_user(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_admin_user(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION list_admin_users() TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_login_audit_username ON login_audit(username);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit(created_at);
