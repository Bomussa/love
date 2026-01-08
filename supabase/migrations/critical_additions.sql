-- ============================================
-- Critical Additions Migration
-- الإضافات الحرجة التسع للنظام
-- ============================================

-- 1) جدول الأدوار (Roles) - فصل صلاحيات المشغل عن المستخدم العادي
CREATE TABLE IF NOT EXISTS public.roles (
  user_id UUID PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'patient')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) جدول سجل التدقيق غير القابل للحذف (Immutable Audit Log)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  old_state JSONB,
  new_state JSONB,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) إضافة عمود system_enabled للعيادات (Kill Switch)
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS system_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 4) جدول إعدادات النظام للـ Kill Switch العام
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- إدخال Kill Switch العام
INSERT INTO public.system_config (key, value) 
VALUES ('system_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- إدخال الحدود القصوى
INSERT INTO public.system_config (key, value) 
VALUES 
  ('max_pins_per_day', '9999'::jsonb),
  ('max_wait_time_minutes', '480'::jsonb),
  ('max_realtime_channels', '100'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5) تفعيل RLS على الجداول الجديدة
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 6) سياسات RLS للأدوار
CREATE POLICY IF NOT EXISTS "roles_read_own" ON public.roles
FOR SELECT USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.roles WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
));

CREATE POLICY IF NOT EXISTS "roles_insert_admin" ON public.roles
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM public.roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- 7) سياسات RLS لسجل التدقيق (إدخال فقط، لا حذف)
CREATE POLICY IF NOT EXISTS "audit_insert_auth" ON public.audit_log
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "audit_read_admin" ON public.audit_log
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.roles WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
));

-- 8) سياسات RLS لإعدادات النظام
CREATE POLICY IF NOT EXISTS "config_read_all" ON public.system_config
FOR SELECT USING (TRUE);

CREATE POLICY IF NOT EXISTS "config_update_admin" ON public.system_config
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM public.roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- 9) دالة توليد PIN آمنة مع القفل التنافسي (Concurrency Lock)
CREATE OR REPLACE FUNCTION public.generate_pin_safe(p_clinic_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_pin INTEGER;
  clinic_enabled BOOLEAN;
  system_enabled BOOLEAN;
BEGIN
  -- التحقق من Kill Switch العام
  SELECT (value::text)::boolean INTO system_enabled
  FROM public.system_config WHERE key = 'system_enabled';
  
  IF NOT COALESCE(system_enabled, TRUE) THEN
    RAISE EXCEPTION 'SYSTEM_DISABLED: النظام متوقف مؤقتًا';
  END IF;

  -- التحقق من حالة العيادة
  SELECT c.system_enabled INTO clinic_enabled
  FROM public.clinics c WHERE c.id = p_clinic_id;
  
  IF NOT COALESCE(clinic_enabled, TRUE) THEN
    RAISE EXCEPTION 'CLINIC_DISABLED: العيادة متوقفة مؤقتًا';
  END IF;

  -- القفل التنافسي لمنع التكرار
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id || current_date::text));

  -- الحصول على الرقم التالي
  SELECT COALESCE(MAX(display_number), 0) + 1
  INTO next_pin
  FROM public.queues
  WHERE clinic_id = p_clinic_id
    AND DATE(entered_at) = CURRENT_DATE;

  -- التحقق من الحد الأقصى
  IF next_pin > 9999 THEN
    RAISE EXCEPTION 'MAX_PIN_REACHED: تم الوصول للحد الأقصى من الأرقام اليوم';
  END IF;

  -- تسجيل في Audit Log
  INSERT INTO public.audit_log (action, payload)
  VALUES ('PIN_GENERATED', jsonb_build_object(
    'clinic_id', p_clinic_id, 
    'pin', next_pin,
    'generated_at', NOW() AT TIME ZONE 'UTC'
  ));

  RETURN next_pin;
END;
$$;

-- 10) دالة دخول الطابور الآمنة مع القفل التنافسي
CREATE OR REPLACE FUNCTION public.enter_queue_safe(
  p_clinic_id TEXT,
  p_patient_id TEXT,
  p_patient_name TEXT DEFAULT NULL,
  p_exam_type TEXT DEFAULT 'general'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin INTEGER;
  v_queue_id UUID;
  v_existing RECORD;
  v_result JSONB;
BEGIN
  -- التحقق من Kill Switch
  IF NOT COALESCE((SELECT (value::text)::boolean FROM public.system_config WHERE key = 'system_enabled'), TRUE) THEN
    RETURN jsonb_build_object('status', 'ABORTED', 'reason', 'SYSTEM_DISABLED');
  END IF;

  -- القفل التنافسي
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id || p_patient_id || current_date::text));

  -- التحقق من وجود المريض في الطابور اليوم
  SELECT * INTO v_existing
  FROM public.queues
  WHERE clinic_id = p_clinic_id
    AND patient_id = p_patient_id
    AND DATE(entered_at) = CURRENT_DATE
    AND status IN ('waiting', 'serving')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_IN_QUEUE',
      'clinic', p_clinic_id,
      'user', p_patient_id,
      'number', v_existing.display_number,
      'message', 'المريض موجود بالفعل في الطابور'
    );
  END IF;

  -- توليد الرقم الآمن
  v_pin := public.generate_pin_safe(p_clinic_id);

  -- إدخال في الطابور
  INSERT INTO public.queues (clinic_id, patient_id, display_number, status, entered_at)
  VALUES (p_clinic_id, p_patient_id, v_pin, 'waiting', NOW())
  RETURNING id INTO v_queue_id;

  -- تسجيل في Audit Log
  INSERT INTO public.audit_log (action, payload)
  VALUES ('QUEUE_ENTERED', jsonb_build_object(
    'queue_id', v_queue_id,
    'clinic_id', p_clinic_id,
    'patient_id', p_patient_id,
    'pin', v_pin,
    'entered_at', NOW() AT TIME ZONE 'UTC'
  ));

  RETURN jsonb_build_object(
    'status', 'OK',
    'clinic', p_clinic_id,
    'user', p_patient_id,
    'number', v_pin,
    'message', 'تم الدخول للطابور بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- تسجيل الخطأ
    INSERT INTO public.audit_log (action, payload)
    VALUES ('QUEUE_ENTER_FAILED', jsonb_build_object(
      'clinic_id', p_clinic_id,
      'patient_id', p_patient_id,
      'error', SQLERRM
    ));
    
    RETURN jsonb_build_object('status', 'ABORTED', 'reason', SQLERRM);
END;
$$;

-- 11) دالة نداء المريض التالي مع القفل
CREATE OR REPLACE FUNCTION public.call_next_patient_safe(
  p_clinic_id TEXT,
  p_operator_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next RECORD;
  v_old_state JSONB;
BEGIN
  -- التحقق من Kill Switch
  IF NOT COALESCE((SELECT (value::text)::boolean FROM public.system_config WHERE key = 'system_enabled'), TRUE) THEN
    RETURN jsonb_build_object('status', 'ABORTED', 'reason', 'SYSTEM_DISABLED');
  END IF;

  -- القفل التنافسي
  PERFORM pg_advisory_xact_lock(hashtext('call_' || p_clinic_id));

  -- إنهاء أي مريض يتم خدمته حاليًا
  UPDATE public.queues
  SET status = 'completed', completed_at = NOW(), completed_by_pin = p_operator_pin
  WHERE clinic_id = p_clinic_id AND status = 'serving';

  -- الحصول على المريض التالي
  SELECT * INTO v_next
  FROM public.queues
  WHERE clinic_id = p_clinic_id
    AND status = 'waiting'
    AND DATE(entered_at) = CURRENT_DATE
  ORDER BY display_number ASC
  LIMIT 1;

  IF v_next IS NULL THEN
    RETURN jsonb_build_object('status', 'NO_WAITING', 'message', 'لا يوجد مرضى في الانتظار');
  END IF;

  -- حفظ الحالة القديمة
  v_old_state := to_jsonb(v_next);

  -- تحديث حالة المريض
  UPDATE public.queues
  SET status = 'serving', called_at = NOW()
  WHERE id = v_next.id;

  -- تسجيل في Audit Log
  INSERT INTO public.audit_log (action, old_state, new_state, payload)
  VALUES ('PATIENT_CALLED', 
    v_old_state,
    jsonb_build_object('status', 'serving', 'called_at', NOW()),
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'patient_id', v_next.patient_id,
      'pin', v_next.display_number
    )
  );

  RETURN jsonb_build_object(
    'status', 'OK',
    'clinic', p_clinic_id,
    'patient', v_next.patient_id,
    'number', v_next.display_number,
    'message', 'تم نداء المريض'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'ABORTED', 'reason', SQLERRM);
END;
$$;

-- 12) دالة إنهاء الفحص مع التسجيل
CREATE OR REPLACE FUNCTION public.complete_exam_safe(
  p_clinic_id TEXT,
  p_patient_id TEXT,
  p_operator_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue RECORD;
  v_old_state JSONB;
BEGIN
  -- القفل التنافسي
  PERFORM pg_advisory_xact_lock(hashtext('complete_' || p_clinic_id || p_patient_id));

  -- الحصول على سجل الطابور
  SELECT * INTO v_queue
  FROM public.queues
  WHERE clinic_id = p_clinic_id
    AND patient_id = p_patient_id
    AND status IN ('waiting', 'serving')
    AND DATE(entered_at) = CURRENT_DATE
  LIMIT 1;

  IF v_queue IS NULL THEN
    RETURN jsonb_build_object('status', 'NOT_FOUND', 'message', 'لم يتم العثور على المريض في الطابور');
  END IF;

  v_old_state := to_jsonb(v_queue);

  -- تحديث الحالة
  UPDATE public.queues
  SET status = 'completed', 
      completed_at = NOW(),
      completed_by_pin = p_operator_pin
  WHERE id = v_queue.id;

  -- تسجيل في Audit Log
  INSERT INTO public.audit_log (action, old_state, new_state, payload)
  VALUES ('EXAM_COMPLETED',
    v_old_state,
    jsonb_build_object('status', 'completed', 'completed_at', NOW()),
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'patient_id', p_patient_id,
      'pin', v_queue.display_number,
      'operator_pin', p_operator_pin
    )
  );

  RETURN jsonb_build_object(
    'status', 'OK',
    'clinic', p_clinic_id,
    'patient', p_patient_id,
    'number', v_queue.display_number,
    'message', 'تم إنهاء الفحص بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'ABORTED', 'reason', SQLERRM);
END;
$$;

-- 13) دالة Health Check
CREATE OR REPLACE FUNCTION public.health_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_system_enabled BOOLEAN;
  v_clinics_count INTEGER;
BEGIN
  SELECT (value::text)::boolean INTO v_system_enabled
  FROM public.system_config WHERE key = 'system_enabled';

  SELECT COUNT(*) INTO v_clinics_count FROM public.clinics;

  RETURN jsonb_build_object(
    'status', 'OK',
    'system_enabled', COALESCE(v_system_enabled, TRUE),
    'clinics_count', v_clinics_count,
    'timestamp', NOW() AT TIME ZONE 'UTC'
  );
END;
$$;

-- 14) منح الصلاحيات للدوال
GRANT EXECUTE ON FUNCTION public.generate_pin_safe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enter_queue_safe(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.call_next_patient_safe(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_exam_safe(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_check() TO anon, authenticated;

-- 15) إضافة Realtime للجداول الجديدة
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- ============================================
-- نهاية الإضافات الحرجة
-- ============================================
