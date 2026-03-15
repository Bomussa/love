-- Create exam_types table
-- This table stores different types of medical examinations

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

-- Add RLS policies
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.exam_types
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update
CREATE POLICY "Allow authenticated insert" ON public.exam_types
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.exam_types
  FOR UPDATE USING (true);

-- Insert default exam types
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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_exam_types_active ON public.exam_types(is_active);
CREATE INDEX IF NOT EXISTS idx_exam_types_order ON public.exam_types(display_order);
