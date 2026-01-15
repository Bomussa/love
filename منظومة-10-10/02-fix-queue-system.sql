/**
 * إصلاح نظام الدور وربطه بالمراجع والعيادات
 * تاريخ: 15 يناير 2026
 * 
 * المشكلة: أرقام الدور عشوائية وتتغير عند تحديث الصفحة
 * الحل: إنشاء نظام دور ثابت مرتبط بالمراجع والعيادة ونوع الفحص
 */

-- ========== 1. إنشاء جدول patient_queue_numbers ==========
-- هذا الجدول يحفظ رقم الدور الثابت لكل مراجع في كل عيادة
CREATE TABLE IF NOT EXISTS patient_queue_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id VARCHAR(50) NOT NULL,
  clinic_id VARCHAR(50) NOT NULL,
  exam_type VARCHAR(50) NOT NULL,
  queue_number INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'assigned', -- assigned, active, completed, cancelled
  assigned_at TIMESTAMP DEFAULT NOW(),
  activated_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- فهرس فريد لضمان عدم تكرار الرقم لنفس المراجع في نفس اليوم
  CONSTRAINT unique_patient_clinic_date UNIQUE (patient_id, clinic_id, exam_type, date)
);

-- ========== 2. إنشاء فهارس لتحسين الأداء ==========
CREATE INDEX IF NOT EXISTS idx_patient_queue_patient ON patient_queue_numbers(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_queue_clinic ON patient_queue_numbers(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_queue_date ON patient_queue_numbers(date);
CREATE INDEX IF NOT EXISTS idx_patient_queue_status ON patient_queue_numbers(status);
CREATE INDEX IF NOT EXISTS idx_patient_queue_number ON patient_queue_numbers(queue_number);

-- ========== 3. إنشاء جدول queue_counters ==========
-- هذا الجدول يحفظ العداد الحالي لكل عيادة في كل يوم
CREATE TABLE IF NOT EXISTS queue_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id VARCHAR(50) NOT NULL,
  exam_type VARCHAR(50) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_number INTEGER DEFAULT 0,
  last_assigned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- فهرس فريد لكل عيادة في كل يوم
  CONSTRAINT unique_clinic_date UNIQUE (clinic_id, exam_type, date)
);

-- ========== 4. إنشاء فهارس لجدول queue_counters ==========
CREATE INDEX IF NOT EXISTS idx_queue_counters_clinic ON queue_counters(clinic_id);
CREATE INDEX IF NOT EXISTS idx_queue_counters_date ON queue_counters(date);

-- ========== 5. إنشاء دالة للحصول على رقم دور جديد ==========
CREATE OR REPLACE FUNCTION get_next_queue_number(
  p_patient_id VARCHAR,
  p_clinic_id VARCHAR,
  p_exam_type VARCHAR
) RETURNS INTEGER AS $$
DECLARE
  v_queue_number INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- التحقق من وجود رقم سابق لنفس المراجع في نفس اليوم
  SELECT queue_number INTO v_queue_number
  FROM patient_queue_numbers
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND exam_type = p_exam_type
    AND date = v_today;
  
  -- إذا وجد رقم سابق، نرجعه
  IF v_queue_number IS NOT NULL THEN
    RETURN v_queue_number;
  END IF;
  
  -- إذا لم يوجد، نحصل على رقم جديد من العداد
  INSERT INTO queue_counters (clinic_id, exam_type, date, last_assigned)
  VALUES (p_clinic_id, p_exam_type, v_today, 1)
  ON CONFLICT (clinic_id, exam_type, date)
  DO UPDATE SET 
    last_assigned = queue_counters.last_assigned + 1,
    updated_at = NOW()
  RETURNING last_assigned INTO v_queue_number;
  
  -- حفظ الرقم الجديد للمراجع
  INSERT INTO patient_queue_numbers (
    patient_id,
    clinic_id,
    exam_type,
    queue_number,
    date,
    status
  ) VALUES (
    p_patient_id,
    p_clinic_id,
    p_exam_type,
    v_queue_number,
    v_today,
    'assigned'
  );
  
  RETURN v_queue_number;
END;
$$ LANGUAGE plpgsql;

-- ========== 6. إنشاء دالة لتفعيل رقم الدور ==========
CREATE OR REPLACE FUNCTION activate_queue_number(
  p_patient_id VARCHAR,
  p_clinic_id VARCHAR,
  p_exam_type VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  UPDATE patient_queue_numbers
  SET 
    status = 'active',
    activated_at = NOW(),
    updated_at = NOW()
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND exam_type = p_exam_type
    AND date = v_today
    AND status = 'assigned';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ========== 7. إنشاء دالة لإكمال رقم الدور ==========
CREATE OR REPLACE FUNCTION complete_queue_number(
  p_patient_id VARCHAR,
  p_clinic_id VARCHAR,
  p_exam_type VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  UPDATE patient_queue_numbers
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND exam_type = p_exam_type
    AND date = v_today
    AND status = 'active';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ========== 8. إنشاء دالة للحصول على موقع المراجع في الطابور ==========
CREATE OR REPLACE FUNCTION get_queue_position(
  p_patient_id VARCHAR,
  p_clinic_id VARCHAR,
  p_exam_type VARCHAR
) RETURNS TABLE (
  queue_number INTEGER,
  position INTEGER,
  ahead INTEGER,
  total_waiting INTEGER,
  status VARCHAR
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_queue_number INTEGER;
  v_status VARCHAR;
BEGIN
  -- الحصول على رقم المراجع وحالته
  SELECT pqn.queue_number, pqn.status INTO v_queue_number, v_status
  FROM patient_queue_numbers pqn
  WHERE pqn.patient_id = p_patient_id
    AND pqn.clinic_id = p_clinic_id
    AND pqn.exam_type = p_exam_type
    AND pqn.date = v_today;
  
  -- إذا لم يوجد رقم، نرجع null
  IF v_queue_number IS NULL THEN
    RETURN;
  END IF;
  
  -- حساب الموقع في الطابور
  RETURN QUERY
  SELECT 
    v_queue_number AS queue_number,
    (SELECT COUNT(*) + 1 FROM patient_queue_numbers 
     WHERE clinic_id = p_clinic_id 
       AND exam_type = p_exam_type
       AND date = v_today
       AND status = 'active'
       AND queue_number < v_queue_number) AS position,
    (SELECT COUNT(*) FROM patient_queue_numbers 
     WHERE clinic_id = p_clinic_id 
       AND exam_type = p_exam_type
       AND date = v_today
       AND status = 'active'
       AND queue_number < v_queue_number) AS ahead,
    (SELECT COUNT(*) FROM patient_queue_numbers 
     WHERE clinic_id = p_clinic_id 
       AND exam_type = p_exam_type
       AND date = v_today
       AND status IN ('assigned', 'active')) AS total_waiting,
    v_status AS status;
END;
$$ LANGUAGE plpgsql;

-- ========== 9. إنشاء trigger لتحديث updated_at تلقائياً ==========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_queue_numbers_updated_at
  BEFORE UPDATE ON patient_queue_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_counters_updated_at
  BEFORE UPDATE ON queue_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== 10. إنشاء view لعرض حالة الطوابير ==========
CREATE OR REPLACE VIEW queue_status_view AS
SELECT 
  qc.clinic_id,
  qc.exam_type,
  qc.date,
  qc.current_number,
  qc.last_assigned,
  COUNT(CASE WHEN pqn.status = 'assigned' THEN 1 END) AS assigned_count,
  COUNT(CASE WHEN pqn.status = 'active' THEN 1 END) AS active_count,
  COUNT(CASE WHEN pqn.status = 'completed' THEN 1 END) AS completed_count,
  qc.updated_at
FROM queue_counters qc
LEFT JOIN patient_queue_numbers pqn 
  ON qc.clinic_id = pqn.clinic_id 
  AND qc.exam_type = pqn.exam_type 
  AND qc.date = pqn.date
GROUP BY qc.clinic_id, qc.exam_type, qc.date, qc.current_number, qc.last_assigned, qc.updated_at;

-- ========== 11. منح الصلاحيات ==========
GRANT SELECT, INSERT, UPDATE ON patient_queue_numbers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON queue_counters TO authenticated;
GRANT SELECT ON queue_status_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_queue_number TO authenticated;
GRANT EXECUTE ON FUNCTION activate_queue_number TO authenticated;
GRANT EXECUTE ON FUNCTION complete_queue_number TO authenticated;
GRANT EXECUTE ON FUNCTION get_queue_position TO authenticated;

-- ========== 12. إنشاء سياسات RLS (Row Level Security) ==========
ALTER TABLE patient_queue_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_counters ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة: الجميع يمكنهم القراءة
CREATE POLICY "Anyone can read queue numbers" ON patient_queue_numbers
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read queue counters" ON queue_counters
  FOR SELECT USING (true);

-- سياسة للكتابة: الجميع يمكنهم الكتابة (سيتم تقييدها لاحقاً حسب الحاجة)
CREATE POLICY "Anyone can insert queue numbers" ON patient_queue_numbers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update queue numbers" ON patient_queue_numbers
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert queue counters" ON queue_counters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update queue counters" ON queue_counters
  FOR UPDATE USING (true);

-- ========== 13. إنشاء وظيفة لتنظيف البيانات القديمة ==========
-- تحذف البيانات الأقدم من 30 يوم
CREATE OR REPLACE FUNCTION cleanup_old_queue_data()
RETURNS void AS $$
BEGIN
  DELETE FROM patient_queue_numbers WHERE date < CURRENT_DATE - INTERVAL '30 days';
  DELETE FROM queue_counters WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ========== ملاحظات التطبيق ==========
/**
 * 1. قم بتشغيل هذا الملف على قاعدة بيانات Supabase
 * 2. تأكد من وجود extension uuid-ossp: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 * 3. اختبر الدوال باستخدام:
 *    SELECT get_next_queue_number('123456', 'clinic_001', 'recruitment');
 *    SELECT activate_queue_number('123456', 'clinic_001', 'recruitment');
 *    SELECT * FROM get_queue_position('123456', 'clinic_001', 'recruitment');
 * 4. قم بجدولة تنفيذ cleanup_old_queue_data() يومياً
 */
