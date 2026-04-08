-- =====================================================
-- توحيد جدولي queue و queues في جدول واحد شامل
-- التاريخ: 2026-01-24
-- =====================================================

-- الخطوة 1: إنشاء جدول موحد جديد يجمع كل المزايا
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_queue (
    -- المعرفات الأساسية
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- بيانات المريض
    patient_id TEXT NOT NULL,
    patient_name VARCHAR(255),
    military_id TEXT,
    personal_id TEXT,
    
    -- بيانات العيادة
    clinic_id TEXT NOT NULL,
    exam_type VARCHAR(100),
    
    -- أرقام الدور
    queue_position INTEGER,
    display_number INTEGER,
    queue_number TEXT,
    
    -- الحالة
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'serving', 'in_progress', 'completed', 'cancelled', 'no_show', 'in_service', 'skipped', 'postponed')),
    
    -- التواريخ والأوقات
    queue_date DATE DEFAULT CURRENT_DATE,
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- بيانات إضافية
    qr_code VARCHAR(255),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    completed_by_pin TEXT,
    
    -- الأولوية والترحيل
    is_priority BOOLEAN DEFAULT FALSE,
    priority_reason TEXT,
    postpone_count INTEGER DEFAULT 0,
    is_temporary BOOLEAN DEFAULT FALSE,
    
    -- الفهارس والقيود
    CONSTRAINT unified_queue_clinic_fk FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
);

-- الخطوة 2: إنشاء الفهارس للأداء
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_unified_queue_patient_id ON unified_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_unified_queue_clinic_id ON unified_queue(clinic_id);
CREATE INDEX IF NOT EXISTS idx_unified_queue_status ON unified_queue(status);
CREATE INDEX IF NOT EXISTS idx_unified_queue_date ON unified_queue(queue_date);
CREATE INDEX IF NOT EXISTS idx_unified_queue_waiting ON unified_queue(status) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_unified_queue_clinic_status ON unified_queue(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_unified_queue_entered_at ON unified_queue(entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_queue_display_number ON unified_queue(clinic_id, display_number, queue_date);

-- الخطوة 3: ترحيل البيانات من جدول queues (الأحدث)
-- =====================================================

INSERT INTO unified_queue (
    id, patient_id, military_id, personal_id, clinic_id,
    display_number, queue_number, status, queue_date,
    entered_at, called_at, completed_at, completed_by_pin,
    is_priority, priority_reason, postpone_count
)
SELECT 
    id, patient_id, military_id, personal_id, clinic_id,
    display_number, queue_number, status, queue_date,
    entered_at, called_at, completed_at, completed_by_pin,
    COALESCE(is_priority, FALSE), priority_reason, COALESCE(postpone_count, 0)
FROM queues
ON CONFLICT (id) DO NOTHING;

-- الخطوة 4: ترحيل البيانات من جدول queue (القديم) التي ليست موجودة
-- =====================================================

INSERT INTO unified_queue (
    id, patient_id, patient_name, clinic_id, exam_type,
    queue_position, status, entered_at, called_at, completed_at,
    cancelled_at, qr_code, notes, metadata, is_temporary, postpone_count
)
SELECT 
    id, patient_id, patient_name, clinic_id, exam_type,
    position, status::TEXT, entered_at, called_at, completed_at,
    cancelled_at, qr_code, notes, metadata, COALESCE(is_temporary, FALSE), COALESCE(postpone_count, 0)
FROM queue
WHERE id NOT IN (SELECT id FROM unified_queue)
ON CONFLICT (id) DO NOTHING;

-- الخطوة 5: إنشاء VIEW للتوافق مع الكود القديم
-- =====================================================

-- View باسم queues للتوافق مع Frontend
DROP VIEW IF EXISTS v_queues;
CREATE OR REPLACE VIEW v_queues AS
SELECT 
    id, clinic_id, patient_id, display_number, status,
    entered_at, called_at, completed_at, completed_by_pin,
    queue_date, postpone_count, is_priority, priority_reason,
    queue_number, military_id, personal_id
FROM unified_queue;

-- View باسم queue للتوافق مع Backend القديم
DROP VIEW IF EXISTS v_queue;
CREATE OR REPLACE VIEW v_queue AS
SELECT 
    id, patient_id, patient_name, clinic_id, exam_type,
    queue_position, qr_code, entered_at, called_at, completed_at,
    notes, metadata, status, is_temporary, cancelled_at, postpone_count
FROM unified_queue;

-- الخطوة 6: إنشاء دالة لحساب رقم الدور التالي
-- =====================================================

CREATE OR REPLACE FUNCTION get_next_display_number(p_clinic_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(display_number), 0) + 1
    INTO v_next_number
    FROM unified_queue
    WHERE clinic_id = p_clinic_id
    AND queue_date = CURRENT_DATE;
    
    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- الخطوة 7: إنشاء دالة لإدخال مريض في الطابور
-- =====================================================

CREATE OR REPLACE FUNCTION enter_unified_queue(
    p_patient_id TEXT,
    p_clinic_id TEXT,
    p_patient_name TEXT DEFAULT NULL,
    p_military_id TEXT DEFAULT NULL,
    p_exam_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    display_number INTEGER,
    queue_position INTEGER,
    ahead INTEGER,
    total_waiting INTEGER
) AS $$
DECLARE
    v_id UUID;
    v_display_number INTEGER;
    v_queue_position INTEGER;
    v_ahead INTEGER;
    v_total INTEGER;
BEGIN
    -- الحصول على رقم الدور التالي
    v_display_number := get_next_display_number(p_clinic_id);
    
    -- حساب الموقع
    SELECT COUNT(*) + 1 INTO v_queue_position
    FROM unified_queue
    WHERE clinic_id = p_clinic_id
    AND queue_date = CURRENT_DATE
    AND status = 'waiting';
    
    -- إدخال السجل
    INSERT INTO unified_queue (
        patient_id, patient_name, military_id, clinic_id, exam_type,
        display_number, queue_position, status, queue_date
    ) VALUES (
        p_patient_id, p_patient_name, p_military_id, p_clinic_id, p_exam_type,
        v_display_number, v_queue_position, 'waiting', CURRENT_DATE
    )
    RETURNING unified_queue.id INTO v_id;
    
    -- حساب عدد من أمامك
    SELECT COUNT(*) INTO v_ahead
    FROM unified_queue
    WHERE clinic_id = p_clinic_id
    AND queue_date = CURRENT_DATE
    AND status = 'waiting'
    AND display_number < v_display_number;
    
    -- حساب إجمالي الانتظار
    SELECT COUNT(*) INTO v_total
    FROM unified_queue
    WHERE clinic_id = p_clinic_id
    AND queue_date = CURRENT_DATE
    AND status = 'waiting';
    
    RETURN QUERY SELECT v_id, v_display_number, v_queue_position, v_ahead, v_total;
END;
$$ LANGUAGE plpgsql;

-- الخطوة 8: إنشاء دالة للحصول على موقع المريض
-- =====================================================

CREATE OR REPLACE FUNCTION get_queue_position(
    p_clinic_id TEXT,
    p_patient_id TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    display_number INTEGER,
    current_number INTEGER,
    ahead INTEGER,
    status TEXT,
    total_waiting INTEGER
) AS $$
DECLARE
    v_patient_entry RECORD;
    v_current_number INTEGER;
    v_ahead INTEGER;
    v_total INTEGER;
BEGIN
    -- جلب بيانات المريض
    SELECT uq.display_number, uq.status, uq.entered_at
    INTO v_patient_entry
    FROM unified_queue uq
    WHERE uq.clinic_id = p_clinic_id
    AND uq.patient_id = p_patient_id
    AND uq.queue_date = CURRENT_DATE
    ORDER BY uq.entered_at DESC
    LIMIT 1;
    
    IF v_patient_entry IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0, 'not_found'::TEXT, 0;
        RETURN;
    END IF;
    
    -- جلب رقم من يُفحص الآن
    SELECT COALESCE(uq.display_number, 0)
    INTO v_current_number
    FROM unified_queue uq
    WHERE uq.clinic_id = p_clinic_id
    AND uq.queue_date = CURRENT_DATE
    AND uq.status = 'serving'
    ORDER BY uq.called_at DESC
    LIMIT 1;
    
    IF v_current_number IS NULL THEN
        v_current_number := 0;
    END IF;
    
    -- حساب عدد من أمامك
    SELECT COUNT(*)
    INTO v_ahead
    FROM unified_queue uq
    WHERE uq.clinic_id = p_clinic_id
    AND uq.queue_date = CURRENT_DATE
    AND uq.status = 'waiting'
    AND uq.display_number < v_patient_entry.display_number;
    
    -- حساب إجمالي الانتظار
    SELECT COUNT(*)
    INTO v_total
    FROM unified_queue uq
    WHERE uq.clinic_id = p_clinic_id
    AND uq.queue_date = CURRENT_DATE
    AND uq.status = 'waiting';
    
    RETURN QUERY SELECT 
        TRUE, 
        v_patient_entry.display_number, 
        v_current_number, 
        v_ahead, 
        v_patient_entry.status::TEXT, 
        v_total;
END;
$$ LANGUAGE plpgsql;

-- الخطوة 9: إنشاء دالة لاستدعاء المريض التالي
-- =====================================================

CREATE OR REPLACE FUNCTION call_next_patient(p_clinic_id TEXT)
RETURNS TABLE (
    success BOOLEAN,
    patient_id TEXT,
    display_number INTEGER,
    patient_name TEXT
) AS $$
DECLARE
    v_next RECORD;
BEGIN
    -- جلب المريض التالي
    SELECT uq.id, uq.patient_id, uq.display_number, uq.patient_name
    INTO v_next
    FROM unified_queue uq
    WHERE uq.clinic_id = p_clinic_id
    AND uq.queue_date = CURRENT_DATE
    AND uq.status = 'waiting'
    ORDER BY uq.display_number ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF v_next IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 0, NULL::TEXT;
        RETURN;
    END IF;
    
    -- تحديث الحالة
    UPDATE unified_queue
    SET status = 'serving', called_at = NOW()
    WHERE id = v_next.id;
    
    RETURN QUERY SELECT TRUE, v_next.patient_id, v_next.display_number, v_next.patient_name;
END;
$$ LANGUAGE plpgsql;

-- الخطوة 10: إنشاء سياسات RLS
-- =====================================================

ALTER TABLE unified_queue ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للجميع
DROP POLICY IF EXISTS unified_queue_select_all ON unified_queue;
CREATE POLICY unified_queue_select_all ON unified_queue
    FOR SELECT USING (true);

-- سياسة الإدخال للجميع
DROP POLICY IF EXISTS unified_queue_insert_all ON unified_queue;
CREATE POLICY unified_queue_insert_all ON unified_queue
    FOR INSERT WITH CHECK (true);

-- سياسة التحديث للجميع
DROP POLICY IF EXISTS unified_queue_update_all ON unified_queue;
CREATE POLICY unified_queue_update_all ON unified_queue
    FOR UPDATE USING (true);

-- سياسة الحذف للجميع
DROP POLICY IF EXISTS unified_queue_delete_all ON unified_queue;
CREATE POLICY unified_queue_delete_all ON unified_queue
    FOR DELETE USING (true);

-- الخطوة 11: تفعيل Realtime
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE unified_queue;

-- الخطوة 12: إنشاء Trigger لتحديث display_number تلقائياً
-- =====================================================

CREATE OR REPLACE FUNCTION set_display_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.display_number IS NULL THEN
        NEW.display_number := get_next_display_number(NEW.clinic_id);
    END IF;
    
    IF NEW.queue_position IS NULL THEN
        SELECT COUNT(*) + 1 INTO NEW.queue_position
        FROM unified_queue
        WHERE clinic_id = NEW.clinic_id
        AND queue_date = CURRENT_DATE
        AND status = 'waiting';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_display_number ON unified_queue;
CREATE TRIGGER trigger_set_display_number
    BEFORE INSERT ON unified_queue
    FOR EACH ROW
    EXECUTE FUNCTION set_display_number();

-- =====================================================
-- انتهى التوحيد
-- =====================================================
