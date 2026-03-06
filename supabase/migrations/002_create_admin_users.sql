-- ============================================
-- Admin Users Table
-- Created: 2025-11-06
-- Description: Admin users authentication table
-- ============================================

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STAFF')),
    name TEXT NOT NULL,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin users can view own data" ON admin_users
    FOR SELECT USING (true);

CREATE POLICY "Admin users can be inserted" ON admin_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin users can be updated" ON admin_users
    FOR UPDATE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Insert default admin users
INSERT INTO admin_users (username, password, role, name, email) VALUES
('bomussa', '14490', 'SUPER_ADMIN', 'Bomussa Administrator', 'bomussa@hotmail.com'),
('admin', 'admin123', 'ADMIN', 'Administrator', 'admin@mmc-mms.com'),
('staff', 'staff123', 'STAFF', 'Staff Member', 'staff@mmc-mms.com')
ON CONFLICT (username) DO NOTHING;

-- Add comment
COMMENT ON TABLE admin_users IS 'Admin users for system authentication and authorization';

-- ============================================
-- ADMIN USERS TABLE COMPLETE
-- ============================================
