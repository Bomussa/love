import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM5MzY1NiwiZXhwIjoyMDc3OTY5NjU2fQ.9zW2vSi5JX-KOJHUxuh-GGtLXZ-fLu5lhXjkxwv41Jg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying exam_types migration...\n');
  
  try {
    // Read SQL file
    const sql = readFileSync('/home/ubuntu/love/supabase/migrations/create_exam_types.sql', 'utf8');
    
    // Split by statements (simple approach)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Use RPC to execute raw SQL (if available)
      // Otherwise, we'll use the REST API approach
      try {
        const { data, error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} - Using alternative method`);
          // If RPC doesn't work, we'll create the table manually
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (e) {
        console.log(`⚠️  Statement ${i + 1} - ${e.message}`);
      }
    }
    
    // Alternative: Create table directly using Supabase client
    console.log('\n📝 Creating exam_types table using direct approach...');
    
    // Insert exam types data
    const examTypes = [
      {
        id: 'recruitment',
        name_ar: 'فحص التجنيد',
        name_en: 'Recruitment Exam',
        description: 'فحص طبي شامل للتجنيد',
        pathway: ["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent", "surgery", "dental", "psychiatry", "dermatology", "orthopedics"],
        display_order: 1
      },
      {
        id: 'transfer',
        name_ar: 'فحص النقل',
        name_en: 'Transfer Exam',
        description: 'فحص طبي للنقل بين الوحدات',
        pathway: ["lab", "radiology", "vitals", "internal"],
        display_order: 2
      },
      {
        id: 'promotion',
        name_ar: 'فحص الترفيع',
        name_en: 'Promotion Exam',
        description: 'فحص طبي للترفيع',
        pathway: ["lab", "vitals", "internal"],
        display_order: 3
      },
      {
        id: 'conversion',
        name_ar: 'فحص التحويل',
        name_en: 'Conversion Exam',
        description: 'فحص طبي للتحويل',
        pathway: ["lab", "radiology", "vitals", "internal"],
        display_order: 4
      },
      {
        id: 'courses',
        name_ar: 'فحص الدورات',
        name_en: 'Courses Exam',
        description: 'فحص طبي للدورات الداخلية والخارجية',
        pathway: ["lab", "vitals", "internal"],
        display_order: 5
      },
      {
        id: 'cooks',
        name_ar: 'فحص الطباخين',
        name_en: 'Cooks Exam',
        description: 'فحص طبي خاص بالطباخين',
        pathway: ["lab", "radiology", "vitals", "internal", "dermatology"],
        display_order: 6
      },
      {
        id: 'aviation',
        name_ar: 'فحص الطيران السنوي',
        name_en: 'Annual Aviation Exam',
        description: 'فحص طبي سنوي للطيران',
        pathway: ["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent"],
        display_order: 7
      },
      {
        id: 'contract_renewal',
        name_ar: 'تجديد التعاقد',
        name_en: 'Contract Renewal',
        description: 'فحص طبي لتجديد التعاقد',
        pathway: ["lab", "vitals", "internal"],
        display_order: 8
      }
    ];
    
    // Try to insert exam types
    const { data, error } = await supabase
      .from('exam_types')
      .upsert(examTypes, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error('❌ Error inserting exam types:', error);
      console.log('\n⚠️  The exam_types table may not exist yet.');
      console.log('   Please create it manually in Supabase Dashboard using the SQL in:');
      console.log('   /home/ubuntu/love/supabase/migrations/create_exam_types.sql');
    } else {
      console.log('✅ Exam types inserted successfully!');
      console.log(`   Inserted ${data.length} exam types`);
    }
    
    // Verify the data
    console.log('\n📋 Verifying exam_types table...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('exam_types')
      .select('*')
      .order('display_order');
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else {
      console.log(`✅ Found ${verifyData.length} exam types in database`);
      verifyData.forEach(exam => {
        console.log(`   - ${exam.name_ar} (${exam.name_en})`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

applyMigration();
