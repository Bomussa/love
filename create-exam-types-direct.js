import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://postgres.utgsoizsnqchiduzffxo:Bomussa%401012@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';

const client = new Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

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

ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.exam_types;
DROP POLICY IF EXISTS "Allow public insert" ON public.exam_types;
DROP POLICY IF EXISTS "Allow public update" ON public.exam_types;

CREATE POLICY "Allow public read" ON public.exam_types FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.exam_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.exam_types FOR UPDATE USING (true);

INSERT INTO public.exam_types (id, name_ar, name_en, description, pathway, display_order) VALUES
  ('recruitment', 'فحص التجنيد', 'Recruitment Exam', 'فحص طبي شامل للتجنيد', '["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent", "surgery", "dental", "psychiatry", "dermatology", "orthopedics"]'::jsonb, 1),
  ('transfer', 'فحص النقل', 'Transfer Exam', 'فحص طبي للنقل بين الوحدات', '["lab", "radiology", "vitals", "internal"]'::jsonb, 2),
  ('promotion', 'فحص الترفيع', 'Promotion Exam', 'فحص طبي للترفيع', '["lab", "vitals", "internal"]'::jsonb, 3),
  ('conversion', 'فحص التحويل', 'Conversion Exam', 'فحص طبي للتحويل', '["lab", "radiology", "vitals", "internal"]'::jsonb, 4),
  ('courses', 'فحص الدورات', 'Courses Exam', 'فحص طبي للدورات الداخلية والخارجية', '["lab", "vitals", "internal"]'::jsonb, 5),
  ('cooks', 'فحص الطباخين', 'Cooks Exam', 'فحص طبي خاص بالطباخين', '["lab", "radiology", "vitals", "internal", "dermatology"]'::jsonb, 6),
  ('aviation', 'فحص الطيران السنوي', 'Annual Aviation Exam', 'فحص طبي سنوي للطيران', '["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent"]'::jsonb, 7),
  ('contract_renewal', 'تجديد التعاقد', 'Contract Renewal', 'فحص طبي لتجديد التعاقد', '["lab", "vitals", "internal"]'::jsonb, 8)
ON CONFLICT (id) DO NOTHING;
`;

async function createTable() {
  try {
    console.log('🔧 Connecting to PostgreSQL...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    console.log('📝 Creating exam_types table...\n');
    await client.query(createTableSQL);
    console.log('✅ Table created and data inserted successfully!\n');
    
    // Verify
    const result = await client.query('SELECT * FROM public.exam_types ORDER BY display_order');
    console.log(`📊 Found ${result.rows.length} exam types:\n`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.name_ar} (${row.name_en})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createTable();
