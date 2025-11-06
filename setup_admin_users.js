/**
 * Setup Admin Users Table in Supabase
 * إنشاء جدول المستخدمين الإداريين في Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdminUsers() {
  console.log('🚀 Setting up Admin Users in Supabase\n');
  
  try {
    // Check if admin_users table exists
    console.log('📋 Checking if admin_users table exists...');
    const { data: existingData, error: checkError } = await supabase
      .from('admin_users')
      .select('count', { count: 'exact', head: true });
    
    if (checkError && checkError.code === '42P01') {
      console.log('⚠️  Table does not exist. Creating SQL migration...\n');
      
      const createTableSQL = `
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

-- Create policy for admin users
CREATE POLICY "Admin users can view own data" ON admin_users
    FOR SELECT USING (true);

CREATE POLICY "Admin users can be inserted" ON admin_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin users can be updated" ON admin_users
    FOR UPDATE USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Insert default admin user
INSERT INTO admin_users (username, password, role, name, email) VALUES
('bomussa', '14490', 'SUPER_ADMIN', 'Bomussa Administrator', 'bomussa@hotmail.com'),
('admin', 'admin123', 'ADMIN', 'Administrator', 'admin@mmc-mms.com'),
('staff', 'staff123', 'STAFF', 'Staff Member', 'staff@mmc-mms.com')
ON CONFLICT (username) DO NOTHING;

COMMENT ON TABLE admin_users IS 'Admin users for the system';
`;
      
      console.log('📝 SQL Migration to create admin_users table:');
      console.log('=' .repeat(60));
      console.log(createTableSQL);
      console.log('=' .repeat(60));
      console.log('\n⚠️  Please run this SQL in Supabase SQL Editor:');
      console.log('   1. Go to https://supabase.com/dashboard/project/utgsoizsnqchiduzffxo/editor');
      console.log('   2. Open SQL Editor');
      console.log('   3. Copy and paste the SQL above');
      console.log('   4. Run the SQL script\n');
      
      return false;
    }
    
    if (checkError) {
      throw checkError;
    }
    
    console.log('✅ Table admin_users exists\n');
    
    // Check if bomussa user exists
    console.log('👤 Checking if bomussa user exists...');
    const { data: bomussaUser, error: bomussaError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', 'bomussa')
      .single();
    
    if (bomussaError && bomussaError.code !== 'PGRST116') {
      throw bomussaError;
    }
    
    if (!bomussaUser) {
      console.log('⚠️  User bomussa does not exist. Creating...');
      
      const { data: newUser, error: insertError } = await supabase
        .from('admin_users')
        .insert([{
          username: 'bomussa',
          password: '14490',
          role: 'SUPER_ADMIN',
          name: 'Bomussa Administrator',
          email: 'bomussa@hotmail.com',
          is_active: true
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      console.log('✅ User bomussa created successfully');
      console.log('   Username:', newUser.username);
      console.log('   Role:', newUser.role);
      console.log('   Name:', newUser.name);
    } else {
      console.log('✅ User bomussa already exists');
      console.log('   Username:', bomussaUser.username);
      console.log('   Role:', bomussaUser.role);
      console.log('   Name:', bomussaUser.name);
      console.log('   Active:', bomussaUser.is_active);
    }
    
    // List all admin users
    console.log('\n📋 All admin users:');
    const { data: allUsers, error: listError } = await supabase
      .from('admin_users')
      .select('username, role, name, is_active')
      .order('created_at', { ascending: true });
    
    if (listError) throw listError;
    
    console.log('=' .repeat(60));
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.role}) - ${user.name} - Active: ${user.is_active}`);
    });
    console.log('=' .repeat(60));
    
    console.log('\n✅ Admin users setup completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

setupAdminUsers().catch(console.error);
