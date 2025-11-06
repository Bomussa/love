import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utgsoizsnqchiduzffxo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z3NvaXpzbnFjaGlkdXpmZnhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM5MzY1NiwiZXhwIjoyMDc3OTY5NjU2fQ.9zW2vSi5JX-KOJHUxuh-GGtLXZ-fLu5lhXjkxwv41Jg';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function createExamTypesTable() {
  console.log('🔧 Creating exam_types table via SQL...\n');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.exam_types (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description TEXT,
      pathway JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN DEFAULT TRUE,
      display_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  try {
    // Execute SQL using PostgreSQL connection
    const { data, error } = await supabase.rpc('exec', { sql: createTableSQL });
    
    if (error) {
      console.log('⚠️  Direct SQL execution not available');
      console.log('   Error:', error.message);
      console.log('\n📝 Please execute this SQL manually in Supabase SQL Editor:\n');
      console.log(createTableSQL);
      console.log('\n   Then run this script again to insert data.');
      
      // Try to check if table exists by querying it
      console.log('\n🔍 Checking if table already exists...');
      const { data: checkData, error: checkError } = await supabase
        .from('exam_types')
        .select('count')
        .limit(1);
      
      if (!checkError) {
        console.log('✅ Table exists! Proceeding with data insertion...');
        await insertExamTypes();
      } else {
        console.log('❌ Table does not exist. Please create it manually.');
      }
    } else {
      console.log('✅ Table created successfully!');
      await insertExamTypes();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to insert data anyway
    console.log('\n🔍 Attempting to insert data...');
    await insertExamTypes();
  }
}

async function insertExamTypes() {
  console.log('\n📝 Inserting exam types data...');
  
  const examTypes = [
    {
      id: 'recruitment',
      name_ar: 'فحص التجنيد',
      name_en: 'Recruitment Exam',
      description: 'فحص طبي شامل للتجنيد',
      pathway: ["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent", "surgery", "dental", "psychiatry", "dermatology", "orthopedics"],
      is_active: true,
      display_order: 1
    },
    {
      id: 'transfer',
      name_ar: 'فحص النقل',
      name_en: 'Transfer Exam',
      description: 'فحص طبي للنقل بين الوحدات',
      pathway: ["lab", "radiology", "vitals", "internal"],
      is_active: true,
      display_order: 2
    },
    {
      id: 'promotion',
      name_ar: 'فحص الترفيع',
      name_en: 'Promotion Exam',
      description: 'فحص طبي للترفيع',
      pathway: ["lab", "vitals", "internal"],
      is_active: true,
      display_order: 3
    },
    {
      id: 'conversion',
      name_ar: 'فحص التحويل',
      name_en: 'Conversion Exam',
      description: 'فحص طبي للتحويل',
      pathway: ["lab", "radiology", "vitals", "internal"],
      is_active: true,
      display_order: 4
    },
    {
      id: 'courses',
      name_ar: 'فحص الدورات',
      name_en: 'Courses Exam',
      description: 'فحص طبي للدورات الداخلية والخارجية',
      pathway: ["lab", "vitals", "internal"],
      is_active: true,
      display_order: 5
    },
    {
      id: 'cooks',
      name_ar: 'فحص الطباخين',
      name_en: 'Cooks Exam',
      description: 'فحص طبي خاص بالطباخين',
      pathway: ["lab", "radiology", "vitals", "internal", "dermatology"],
      is_active: true,
      display_order: 6
    },
    {
      id: 'aviation',
      name_ar: 'فحص الطيران السنوي',
      name_en: 'Annual Aviation Exam',
      description: 'فحص طبي سنوي للطيران',
      pathway: ["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent"],
      is_active: true,
      display_order: 7
    },
    {
      id: 'contract_renewal',
      name_ar: 'تجديد التعاقد',
      name_en: 'Contract Renewal',
      description: 'فحص طبي لتجديد التعاقد',
      pathway: ["lab", "vitals", "internal"],
      is_active: true,
      display_order: 8
    }
  ];
  
  const { data, error } = await supabase
    .from('exam_types')
    .upsert(examTypes, { onConflict: 'id' })
    .select();
  
  if (error) {
    console.error('❌ Error inserting exam types:', error);
    console.log('\n💡 SQL to create table manually:');
    console.log(`
CREATE TABLE IF NOT EXISTS public.exam_types (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  pathway JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.exam_types FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.exam_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.exam_types FOR UPDATE USING (true);
    `);
  } else {
    console.log('✅ Exam types inserted successfully!');
    console.log(`   Inserted ${data.length} exam types\n`);
    
    data.forEach((exam, index) => {
      console.log(`   ${index + 1}. ${exam.name_ar} (${exam.name_en})`);
    });
  }
}

createExamTypesTable();
