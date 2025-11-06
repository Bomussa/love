/**
 * Apply Admin Users Migration to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTM2NTYsImV4cCI6MjA3Nzk2OTY1Nn0.Z0TXrIo1xEpe7QQrphVZXq30Fj5B4OoPuqEDfar4ZTs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying Admin Users Migration\n');
  
  try {
    // Read SQL file
    const sql = readFileSync('/home/ubuntu/love/supabase/migrations/002_create_admin_users.sql', 'utf8');
    
    console.log('📝 SQL Migration Content:');
    console.log('=' .repeat(60));
    console.log(sql);
    console.log('=' .repeat(60));
    console.log('\n⚠️  Note: Supabase client cannot execute DDL directly.');
    console.log('Please apply this SQL manually in Supabase SQL Editor.\n');
    console.log('Steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/utgsoizsnqchiduzffxo/sql/new');
    console.log('2. Copy the SQL above');
    console.log('3. Paste and run it\n');
    
    // Try to check if table exists after manual creation
    console.log('Alternatively, testing direct insert (will fail if table doesn\'t exist)...\n');
    
    const { data, error } = await supabase
      .from('admin_users')
      .insert([{
        username: 'bomussa',
        password: '14490',
        role: 'SUPER_ADMIN',
        name: 'Bomussa Administrator',
        email: 'bomussa@hotmail.com',
        is_active: true
      }])
      .select();
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does not exist. Please create it using the SQL above.');
      } else if (error.code === '23505') {
        console.log('✅ User bomussa already exists!');
        
        // Fetch existing user
        const { data: existing } = await supabase
          .from('admin_users')
          .select('*')
          .eq('username', 'bomussa')
          .single();
        
        if (existing) {
          console.log('   Username:', existing.username);
          console.log('   Role:', existing.role);
          console.log('   Name:', existing.name);
        }
      } else {
        throw error;
      }
    } else {
      console.log('✅ User bomussa created successfully!');
      console.log(data);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Code:', error.code);
  }
}

applyMigration().catch(console.error);
