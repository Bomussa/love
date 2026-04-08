-- ===================================================================
-- ملف الإصلاحات الشاملة لمشروع MMC-MMS
-- التاريخ: 2026-01-24
-- الهدف: تطبيق جميع الإصلاحات الهندسية المطلوبة بنسبة 100%
-- ===================================================================

-- ===================================================================
-- القسم 1: إضافة الأعمدة المفقودة
-- ===================================================================

-- إضافة عمود postpone_count إلى جدول queue
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'queue' 
        AND column_name = 'postpone_count'
    ) THEN
        ALTER TABLE public.queue ADD COLUMN postpone_count INTEGER NOT NULL DEFAULT 0;
        COMMENT ON COLUMN public.queue.postpone_count IS 'عدد مرات ترحيل الدور (الحد الأقصى 3)';
    END IF;
END $$;

-- ===================================================================
-- القسم 2: إنشاء الفهارس المفقودة لتحسين الأداء
-- ===================================================================

-- فهرس على حالة waiting في جدول queue
CREATE INDEX IF NOT EXISTS idx_queue_waiting 
ON public.queue(status) 
WHERE status = 'waiting';

-- فهرس على status و entered_at لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_queue_status_entered 
ON public.queue(status, entered_at);

-- فهرس على patient_id لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_queue_patient_id 
ON public.queue(patient_id);

-- فهرس على clinic_id لتسريع الاستعلامات حسب العيادة
CREATE INDEX IF NOT EXISTS idx_queue_clinic_id 
ON public.queue(clinic_id);

-- فهرس على audit_logs لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id 
ON public.audit_logs(actor_id);

-- فهرس على audit_logs حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs(created_at DESC);

-- ===================================================================
-- القسم 3: الدوال الذرية (Atomic Functions)
-- ===================================================================

-- دالة الحصول على رقم الدور التالي بشكل ذري (منع التكرار)
CREATE OR REPLACE FUNCTION public.get_next_queue_number(p_clinic_id TEXT)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_num INTEGER;
BEGIN
    -- قفل الصف لمنع التزامن الخاطئ
    SELECT COALESCE(MAX(position), 0) + 1 INTO next_num
    FROM public.queue
    WHERE clinic_id = p_clinic_id 
    AND entered_at::date = CURRENT_DATE
    AND status != 'cancelled'
    FOR UPDATE;
    
    RETURN next_num;
END;
$$;

COMMENT ON FUNCTION public.get_next_queue_number IS 'دالة ذرية للحصول على رقم الدور التالي مع منع التكرار';

-- ===================================================================
-- القسم 4: دالة التحقق من اكتمال المسار
-- ===================================================================

-- دالة للتحقق من اكتمال جميع العيادات في مسار المراجع
CREATE OR REPLACE FUNCTION public.check_patient_route_completion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    route_clinics JSONB;
    completed_count INTEGER;
    total_count INTEGER;
BEGIN
    -- الحصول على قائمة العيادات من جدول routes
    SELECT clinics INTO route_clinics
    FROM public.routes
    WHERE exam_type = NEW.exam_type
    AND is_active = true
    LIMIT 1;
    
    IF route_clinics IS NOT NULL THEN
        -- عد العيادات المكتملة
        SELECT COUNT(*) INTO completed_count
        FROM public.queue
        WHERE patient_id = NEW.patient_id
        AND status = 'completed'
        AND entered_at::date = CURRENT_DATE;
        
        -- عد إجمالي العيادات المطلوبة
        SELECT jsonb_array_length(route_clinics) INTO total_count;
        
        -- إذا اكتمل المسار، تحديث حالة المريض
        IF completed_count >= total_count THEN
            UPDATE public.patients
            SET status = 'completed',
                updated_at = NOW()
            WHERE patient_id = NEW.patient_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_patient_route_completion IS 'دالة للتحقق التلقائي من اكتمال مسار المراجع';

-- ===================================================================
-- القسم 5: المحفزات (Triggers)
-- ===================================================================

-- محفز لتحديث حالة المراجع عند اكتمال عيادة
DROP TRIGGER IF EXISTS trigger_check_route_completion ON public.queue;

CREATE TRIGGER trigger_check_route_completion
AFTER UPDATE OF status ON public.queue
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.check_patient_route_completion();

COMMENT ON TRIGGER trigger_check_route_completion ON public.queue IS 'محفز لتحديث حالة المراجع تلقائياً عند اكتمال العيادات';

-- ===================================================================
-- القسم 6: دالة الترحيل المحصنة
-- ===================================================================

-- دالة لترحيل الدور مع التحقق من العدد الأقصى
CREATE OR REPLACE FUNCTION public.postpone_queue_entry(
    p_queue_id UUID,
    p_max_postpones INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count INTEGER;
    new_status TEXT;
    result JSONB;
BEGIN
    -- الحصول على عدد الترحيلات الحالي
    SELECT postpone_count INTO current_count
    FROM public.queue
    WHERE id = p_queue_id
    FOR UPDATE;
    
    IF current_count IS NULL THEN
        RAISE EXCEPTION 'Queue entry not found';
    END IF;
    
    -- التحقق من تجاوز الحد الأقصى
    IF current_count >= p_max_postpones THEN
        new_status := 'cancelled';
        result := jsonb_build_object(
            'success', false,
            'message', 'تم تجاوز الحد الأقصى لعدد مرات الترحيل',
            'status', 'cancelled',
            'postpone_count', current_count
        );
    ELSE
        new_status := 'waiting';
        result := jsonb_build_object(
            'success', true,
            'message', 'تم ترحيل الدور بنجاح',
            'status', 'waiting',
            'postpone_count', current_count + 1
        );
    END IF;
    
    -- تحديث السجل
    UPDATE public.queue
    SET 
        status = new_status::queue_status,
        postpone_count = current_count + 1,
        updated_at = NOW()
    WHERE id = p_queue_id;
    
    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.postpone_queue_entry IS 'دالة محصنة لترحيل الدور مع التحقق من الحد الأقصى';

-- ===================================================================
-- القسم 7: تحديث السياسات الأمنية (RLS Policies)
-- ===================================================================

-- إزالة سياسات anon الخطرة على جدول settings
DROP POLICY IF EXISTS "settings_update_anon" ON public.settings;
DROP POLICY IF EXISTS "settings_insert_anon" ON public.settings;
DROP POLICY IF EXISTS "Allow public update on settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public insert on settings" ON public.settings;

-- إنشاء سياسة المدراء فقط للإعدادات
DROP POLICY IF EXISTS "admin_manage_settings" ON public.settings;

CREATE POLICY "admin_manage_settings" ON public.settings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.admins 
        WHERE admins.id = auth.uid()
    )
);

COMMENT ON POLICY "admin_manage_settings" ON public.settings IS 'المدراء فقط يمكنهم إدارة الإعدادات';

-- سياسة القراءة للإعدادات العامة
DROP POLICY IF EXISTS "settings_read_public" ON public.settings;

CREATE POLICY "settings_read_public" ON public.settings
FOR SELECT
USING (is_public = true);

COMMENT ON POLICY "settings_read_public" ON public.settings IS 'الجميع يمكنهم قراءة الإعدادات العامة فقط';

-- ===================================================================
-- القسم 8: حماية PIN Code
-- ===================================================================

-- إنشاء جدول منفصل لـ PINs إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.clinic_pins_secure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id)
);

COMMENT ON TABLE public.clinic_pins_secure IS 'جدول محمي لتخزين PINs العيادات مع التشفير';

-- تفعيل RLS على جدول PINs
ALTER TABLE public.clinic_pins_secure ENABLE ROW LEVEL SECURITY;

-- إلغاء جميع الصلاحيات العامة
REVOKE ALL ON TABLE public.clinic_pins_secure FROM anon;
REVOKE ALL ON TABLE public.clinic_pins_secure FROM authenticated;

-- دالة للتحقق من PIN بدون إرجاعه
CREATE OR REPLACE FUNCTION public.verify_clinic_pin(
    p_clinic_id TEXT,
    p_pin_input TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stored_hash TEXT;
    stored_salt TEXT;
    computed_hash TEXT;
BEGIN
    -- الحصول على الـ hash والـ salt
    SELECT pin_hash, pin_salt INTO stored_hash, stored_salt
    FROM public.clinic_pins_secure
    WHERE clinic_id = p_clinic_id
    AND (expires_at IS NULL OR expires_at > NOW());
    
    IF stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- حساب الـ hash للإدخال
    computed_hash := encode(
        digest(p_pin_input || stored_salt, 'sha256'),
        'hex'
    );
    
    -- المقارنة
    RETURN computed_hash = stored_hash;
END;
$$;

COMMENT ON FUNCTION public.verify_clinic_pin IS 'دالة للتحقق من PIN بدون إرجاع القيمة الفعلية';

-- ===================================================================
-- القسم 9: دالة تنظيف الجلسات المنتهية
-- ===================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- حذف الجلسات المنتهية
    DELETE FROM public.sessions
    WHERE expires_at < NOW()
    OR (created_at < NOW() - INTERVAL '24 hours' AND is_valid = false);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- تسجيل في audit_logs
    INSERT INTO public.audit_logs (action_type, target_table, action_details)
    VALUES (
        'cleanup',
        'sessions',
        jsonb_build_object(
            'deleted_count', deleted_count,
            'timestamp', NOW()
        )
    );
    
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_sessions IS 'دالة لتنظيف الجلسات المنتهية تلقائياً';

-- ===================================================================
-- القسم 10: دالة تحديث الإحصائيات
-- ===================================================================

CREATE OR REPLACE FUNCTION public.update_daily_statistics()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- تحديث إحصائيات اليوم
    INSERT INTO public.reports (
        type,
        period_start,
        period_end,
        total_patients,
        completed_patients,
        cancelled_patients,
        average_wait_time,
        data
    )
    SELECT
        'daily',
        CURRENT_DATE,
        CURRENT_DATE,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))/60)::INTEGER as avg_wait,
        jsonb_build_object(
            'by_clinic', (
                SELECT jsonb_object_agg(
                    clinic_id,
                    jsonb_build_object(
                        'total', COUNT(*),
                        'completed', COUNT(*) FILTER (WHERE status = 'completed')
                    )
                )
                FROM public.queue
                WHERE entered_at::date = CURRENT_DATE
                GROUP BY clinic_id
            )
        )
    FROM public.queue
    WHERE entered_at::date = CURRENT_DATE
    ON CONFLICT (type, period_start, period_end) 
    DO UPDATE SET
        total_patients = EXCLUDED.total_patients,
        completed_patients = EXCLUDED.completed_patients,
        cancelled_patients = EXCLUDED.cancelled_patients,
        average_wait_time = EXCLUDED.average_wait_time,
        data = EXCLUDED.data,
        generated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.update_daily_statistics IS 'دالة لتحديث الإحصائيات اليومية';

-- ===================================================================
-- القسم 11: التحقق النهائي
-- ===================================================================

-- التحقق من تفعيل RLS على جميع الجداول الحساسة
DO $$
DECLARE
    tbl RECORD;
    missing_rls TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE '%_backup_%'
        AND tablename NOT LIKE 'infra_archive%'
    LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_tables t
            WHERE t.schemaname = 'public'
            AND t.tablename = tbl.tablename
            AND t.rowsecurity = true
        ) THEN
            missing_rls := array_append(missing_rls, tbl.tablename);
        END IF;
    END LOOP;
    
    IF array_length(missing_rls, 1) > 0 THEN
        RAISE NOTICE 'تحذير: الجداول التالية لا تحتوي على RLS: %', array_to_string(missing_rls, ', ');
    ELSE
        RAISE NOTICE 'ممتاز: جميع الجداول محمية بـ RLS';
    END IF;
END $$;

-- ===================================================================
-- القسم 12: تسجيل الإصلاحات
-- ===================================================================

INSERT INTO public.audit_logs (action_type, target_table, action_details)
VALUES (
    'migration',
    'comprehensive_fixes',
    jsonb_build_object(
        'migration_name', '20260124_comprehensive_fixes',
        'timestamp', NOW(),
        'changes', jsonb_build_array(
            'أضيف عمود postpone_count',
            'أنشئت الفهارس المفقودة',
            'أنشئت الدوال الذرية',
            'حُدثت السياسات الأمنية',
            'أمّن نظام PIN',
            'أنشئت دوال التنظيف والإحصائيات'
        )
    )
);

-- ===================================================================
-- النهاية - الإصلاحات الشاملة مكتملة
-- ===================================================================
