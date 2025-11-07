import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujwuruuosffcxazymit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDgxMjcxNywiZXhwIjoyMDQ2Mzg4NzE3fQ.9Ik-FLpXZNWEfvFHZJQ1cJpNLTt-YPvmxmLxQvlXCpg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAdmin() {
  try {
    console.log('🔄 Adding admin user...');
    
    // إضافة مستخدم الإدارة
    const { data, error } = await supabase
      .from('admins')
      .upsert({
        username: 'bomussa',
        password_hash: '14490',
        role: 'SUPER_ADMIN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'username'
      })
      .select();

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Admin user added successfully!');
    console.log('📊 Data:', data);

    // التحقق من المستخدم
    const { data: users, error: fetchError } = await supabase
      .from('admins')
      .select('*');

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return;
    }

    console.log('\n📋 All admins:');
    console.table(users);

  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

addAdmin();
