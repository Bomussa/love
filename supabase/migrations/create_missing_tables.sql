-- إنشاء جدول exam_types
CREATE TABLE IF NOT EXISTS public.exam_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    pathway JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء جدول queues
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    exam_type_id UUID REFERENCES public.exam_types(id),
    clinic_id UUID,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'cancelled')),
    position INTEGER,
    priority INTEGER DEFAULT 0,
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_wait_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء جدول pathways
CREATE TABLE IF NOT EXISTS public.pathways (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id TEXT NOT NULL,
    exam_type_id UUID REFERENCES public.exam_types(id),
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_queues_patient_id ON public.queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_queues_status ON public.queues(status);
CREATE INDEX IF NOT EXISTS idx_queues_clinic_id ON public.queues(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pathways_patient_id ON public.pathways(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathways_status ON public.pathways(status);

-- إنشاء triggers للتحديث التلقائي
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_exam_types_updated_at BEFORE UPDATE ON public.exam_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pathways_updated_at BEFORE UPDATE ON public.pathways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- تفعيل RLS
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathways ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للقراءة العامة
CREATE POLICY "Allow public read access on exam_types" ON public.exam_types
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on queues" ON public.queues
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on pathways" ON public.pathways
    FOR SELECT USING (true);

-- سياسات RLS للكتابة (مصادقة مطلوبة)
CREATE POLICY "Allow authenticated insert on queues" ON public.queues
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on queues" ON public.queues
    FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated insert on pathways" ON public.pathways
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on pathways" ON public.pathways
    FOR UPDATE USING (true);

-- إدراج أنواع الفحوصات الطبية الثمانية
INSERT INTO public.exam_types (name_ar, name_en, code, pathway, duration_minutes) VALUES
('فحص التجنيد', 'Recruitment Exam', 'recruitment', 
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "dental", "name_ar": "فحص الأسنان", "name_en": "Dental Exam"},
   {"step": 5, "clinic": "ent", "name_ar": "الأنف والأذن والحنجرة", "name_en": "ENT"},
   {"step": 6, "clinic": "cardiology", "name_ar": "القلب", "name_en": "Cardiology"},
   {"step": 7, "clinic": "chest", "name_ar": "الصدر", "name_en": "Chest"},
   {"step": 8, "clinic": "surgery", "name_ar": "الجراحة", "name_en": "Surgery"},
   {"step": 9, "clinic": "orthopedic", "name_ar": "العظام", "name_en": "Orthopedic"},
   {"step": 10, "clinic": "neurology", "name_ar": "الأعصاب", "name_en": "Neurology"},
   {"step": 11, "clinic": "psychiatry", "name_ar": "الطب النفسي", "name_en": "Psychiatry"},
   {"step": 12, "clinic": "lab", "name_ar": "المختبر", "name_en": "Laboratory"},
   {"step": 13, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb, 
 180),

('فحص النقل', 'Transfer Exam', 'transfer',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 60),

('فحص الترفيع', 'Promotion Exam', 'promotion',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 45),

('فحص التحويل', 'Conversion Exam', 'conversion',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 60),

('فحص الدورات', 'Courses Exam', 'courses',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 45),

('فحص الطباخين', 'Cooks Exam', 'cooks',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "dental", "name_ar": "فحص الأسنان", "name_en": "Dental Exam"},
   {"step": 4, "clinic": "lab", "name_ar": "المختبر", "name_en": "Laboratory"},
   {"step": 5, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 75),

('فحص الطيران السنوي', 'Annual Aviation Exam', 'aviation',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "ent", "name_ar": "الأنف والأذن والحنجرة", "name_en": "ENT"},
   {"step": 5, "clinic": "cardiology", "name_ar": "القلب", "name_en": "Cardiology"},
   {"step": 6, "clinic": "neurology", "name_ar": "الأعصاب", "name_en": "Neurology"},
   {"step": 7, "clinic": "lab", "name_ar": "المختبر", "name_en": "Laboratory"},
   {"step": 8, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 120),

('تجديد التعاقد', 'Contract Renewal', 'renewal',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 45)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.exam_types IS 'أنواع الفحوصات الطبية المتاحة';
COMMENT ON TABLE public.queues IS 'طوابير الانتظار للمرضى';
COMMENT ON TABLE public.pathways IS 'مسارات الفحص للمرضى';
