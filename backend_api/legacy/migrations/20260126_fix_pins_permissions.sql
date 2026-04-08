-- منح الصلاحيات لجدول pins لضمان ظهوره في شاشة الإدارة
-- التحقق من وجود الجدول أولاً
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pins') THEN
        -- تفعيل RLS إذا لم يكن مفعلاً
        ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

        -- حذف السياسات القديمة لتجنب التعارض
        DROP POLICY IF EXISTS "Allow authenticated select on pins" ON public.pins;
        DROP POLICY IF EXISTS "Allow authenticated insert on pins" ON public.pins;
        DROP POLICY IF EXISTS "Allow authenticated update on pins" ON public.pins;

        -- إضافة سياسات جديدة للمستخدمين المصادق عليهم (الأدمن)
        CREATE POLICY "Allow authenticated select on pins" ON public.pins
            FOR SELECT TO authenticated USING (true);
            
        CREATE POLICY "Allow authenticated insert on pins" ON public.pins
            FOR INSERT TO authenticated WITH CHECK (true);
            
        CREATE POLICY "Allow authenticated update on pins" ON public.pins
            FOR UPDATE TO authenticated USING (true);

        -- منح الصلاحيات الكاملة للأدوار المصادق عليها
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pins TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pins TO service_role;
        
        -- التأكد من أن anon يمكنه فقط التحقق (إذا لزم الأمر) أو منعه تماماً حسب الحاجة
        -- هنا سنسمح بالتحقق فقط عبر RPC لزيادة الأمان
        REVOKE ALL ON TABLE public.pins FROM anon;
    END IF;
END $$;
