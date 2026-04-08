-- Migration: Add UI Settings Table for Dynamic Content and Styling
-- Date: 2026-03-05

CREATE TABLE IF NOT EXISTS public.ui_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    label_ar TEXT NOT NULL,
    label_en TEXT NOT NULL,
    value_ar TEXT NOT NULL,
    value_en TEXT NOT NULL,
    font_size VARCHAR(20) DEFAULT '16px',
    font_weight VARCHAR(20) DEFAULT 'normal',
    color VARCHAR(50) DEFAULT 'inherit',
    category VARCHAR(50) DEFAULT 'general',
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default UI settings for Patient Screens
INSERT INTO public.ui_settings (key, label_ar, label_en, value_ar, value_en, category, font_weight, color) VALUES
    ('header_logo_text', 'نص الشعار', 'Logo Text', 'اللجنة الطبية العسكرية', 'Military Medical Committee', 'header', 'bold', '#1e3a8a'),
    ('header_center_name', 'اسم المركز', 'Center Name', 'مركز الفحوصات الطبية', 'Medical Examination Center', 'header', 'bold', '#1e3a8a'),
    ('login_welcome', 'رسالة الترحيب', 'Welcome Message', 'مرحباً بك في نظام اللجنة الطبية', 'Welcome to the Medical Committee System', 'login', 'bold', '#1e3a8a'),
    ('floor_1_name', 'اسم الطابق الأول', 'Floor 1 Name', 'الطابق الأرضي', 'Ground Floor', 'floors', 'normal', 'inherit'),
    ('floor_2_name', 'اسم الطابق الثاني', 'Floor 2 Name', 'الطابق الأول', 'First Floor', 'floors', 'normal', 'inherit'),
    ('clinic_lab_name', 'اسم عيادة المختبر', 'Lab Clinic Name', 'المختبر والأشعة', 'Laboratory & Radiology', 'clinics', 'bold', 'inherit'),
    ('status_ready', 'نص حالة جاهز', 'Ready Status Text', 'جاهز', 'Ready', 'status', 'bold', '#10b981'),
    ('status_locked', 'نص حالة مغلق', 'Locked Status Text', 'مغلق', 'Locked', 'status', 'bold', '#ef4444'),
    ('ticket_number_label', 'تسمية رقم الدور', 'Ticket Number Label', 'رقمك الحالي', 'Your Current Number', 'patient_page', 'bold', 'inherit')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.ui_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to ui_settings" ON public.ui_settings
    FOR ALL USING (auth.role() = 'service_role');

-- Allow public read access for real-time updates on patient screens
CREATE POLICY "Public read access to ui_settings" ON public.ui_settings
    FOR SELECT USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ui_settings_key ON public.ui_settings(key);
CREATE INDEX IF NOT EXISTS idx_ui_settings_category ON public.ui_settings(category);
INSERT INTO public.ui_settings (key, label_ar, label_en, value_ar, value_en, category, font_weight, color) VALUES ('your_medical_route', 'عنوان مسارك الطبي', 'Your Medical Route Title', 'مسارك الطبي', 'Your Medical Route', 'patient_page', 'bold', '#1e3a8a') ON CONFLICT (key) DO NOTHING;
