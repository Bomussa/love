/**
 * نظام تتبع زيارات المراجعين وحفظ معلومات الفحص
 * تاريخ: 15 يناير 2026
 * 
 * الهدف: حفظ معلومات المراجع مع نوع الفحص والمدة المستهلكة لكل عيادة
 */

-- ========== 1. إنشاء جدول patient_visits ==========
-- يحفظ معلومات كل زيارة للمراجع
CREATE TABLE IF NOT EXISTS patient_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id VARCHAR(50) NOT NULL,
  patient_name VARCHAR(200),
  patient_type VARCHAR(20) NOT NULL, -- 'military' أو 'civilian'
  exam_type VARCHAR(50) NOT NULL,
  exam_type_ar VARCHAR(100),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  total_duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, cancelled
  pathway JSONB, -- المسار الطبي الكامل
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========== 2. إنشاء جدول clinic_visits ==========
-- يحفظ معلومات كل زيارة لعيادة محددة
CREATE TABLE IF NOT EXISTS clinic_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_visit_id UUID NOT NULL REFERENCES patient_visits(id) ON DELETE CASCADE,
  patient_id VARCHAR(50) NOT NULL,
  clinic_id VARCHAR(50) NOT NULL,
  clinic_name VARCHAR(200),
  clinic_name_ar VARCHAR(200),
  queue_number INTEGER,
  entered_at TIMESTAMP,
  exited_at TIMESTAMP,
  duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'assigned', -- assigned, active, completed, skipped
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========== 3. إنشاء فهارس لتحسين الأداء ==========
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_date ON patient_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_patient_visits_exam ON patient_visits(exam_type);
CREATE INDEX IF NOT EXISTS idx_patient_visits_status ON patient_visits(status);

CREATE INDEX IF NOT EXISTS idx_clinic_visits_patient_visit ON clinic_visits(patient_visit_id);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_patient ON clinic_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_clinic ON clinic_visits(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_visits_status ON clinic_visits(status);

-- ========== 4. إنشاء دالة لبدء زيارة جديدة ==========
CREATE OR REPLACE FUNCTION start_patient_visit(
  p_patient_id VARCHAR,
  p_patient_name VARCHAR,
  p_patient_type VARCHAR,
  p_exam_type VARCHAR,
  p_exam_type_ar VARCHAR,
  p_pathway JSONB
) RETURNS UUID AS $$
DECLARE
  v_visit_id UUID;
BEGIN
  -- إنشاء سجل الزيارة
  INSERT INTO patient_visits (
    patient_id,
    patient_name,
    patient_type,
    exam_type,
    exam_type_ar,
    visit_date,
    start_time,
    status,
    pathway
  ) VALUES (
    p_patient_id,
    p_patient_name,
    p_patient_type,
    p_exam_type,
    p_exam_type_ar,
    CURRENT_DATE,
    NOW(),
    'in_progress',
    p_pathway
  ) RETURNING id INTO v_visit_id;
  
  -- إنشاء سجلات العيادات من المسار
  IF p_pathway IS NOT NULL THEN
    INSERT INTO clinic_visits (
      patient_visit_id,
      patient_id,
      clinic_id,
      clinic_name,
      clinic_name_ar,
      status
    )
    SELECT 
      v_visit_id,
      p_patient_id,
      clinic->>'id',
      clinic->>'name',
      clinic->>'nameAr',
      'assigned'
    FROM jsonb_array_elements(p_pathway) AS clinic;
  END IF;
  
  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

-- ========== 5. إنشاء دالة لتسجيل دخول عيادة ==========
CREATE OR REPLACE FUNCTION enter_clinic(
  p_patient_id VARCHAR,
  p_clinic_id VARCHAR,
  p_queue_number INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  UPDATE clinic_visits
  SET 
    entered_at = NOW(),
    queue_number = p_queue_number,
    status = 'active',
    updated_at = NOW()
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND patient_visit_id IN (
      SELECT id FROM patient_visits 
      WHERE patient_id = p_patient_id 
      AND visit_date = v_today 
      AND status = 'in_progress'
    )
    AND status = 'assigned';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ========== 6. إنشاء دالة لتسجيل خروج من عيادة ==========
CREATE OR REPLACE FUNCTION exit_clinic(
  p_patient_id VARCHAR,
  p_clinic_id VARCHAR,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  duration_minutes INTEGER,
  clinic_name VARCHAR
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_entered_at TIMESTAMP;
  v_duration INTEGER;
  v_clinic_name VARCHAR;
BEGIN
  -- الحصول على وقت الدخول
  SELECT cv.entered_at, cv.clinic_name_ar INTO v_entered_at, v_clinic_name
  FROM clinic_visits cv
  WHERE cv.patient_id = p_patient_id
    AND cv.clinic_id = p_clinic_id
    AND cv.patient_visit_id IN (
      SELECT id FROM patient_visits 
      WHERE patient_id = p_patient_id 
      AND visit_date = v_today 
      AND status = 'in_progress'
    )
    AND cv.status = 'active';
  
  -- حساب المدة
  IF v_entered_at IS NOT NULL THEN
    v_duration := EXTRACT(EPOCH FROM (NOW() - v_entered_at)) / 60;
  ELSE
    v_duration := 0;
  END IF;
  
  -- تحديث السجل
  UPDATE clinic_visits
  SET 
    exited_at = NOW(),
    duration_minutes = v_duration,
    status = 'completed',
    notes = p_notes,
    updated_at = NOW()
  WHERE patient_id = p_patient_id
    AND clinic_id = p_clinic_id
    AND patient_visit_id IN (
      SELECT id FROM patient_visits 
      WHERE patient_id = p_patient_id 
      AND visit_date = v_today 
      AND status = 'in_progress'
    )
    AND status = 'active';
  
  RETURN QUERY SELECT v_duration, v_clinic_name;
END;
$$ LANGUAGE plpgsql;

-- ========== 7. إنشاء دالة لإنهاء الزيارة ==========
CREATE OR REPLACE FUNCTION complete_patient_visit(
  p_patient_id VARCHAR
) RETURNS TABLE (
  visit_id UUID,
  total_duration INTEGER,
  clinics_count INTEGER
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_visit_id UUID;
  v_start_time TIMESTAMP;
  v_duration INTEGER;
  v_count INTEGER;
BEGIN
  -- الحصول على معلومات الزيارة
  SELECT id, start_time INTO v_visit_id, v_start_time
  FROM patient_visits
  WHERE patient_id = p_patient_id
    AND visit_date = v_today
    AND status = 'in_progress';
  
  IF v_visit_id IS NULL THEN
    RETURN;
  END IF;
  
  -- حساب المدة الإجمالية
  v_duration := EXTRACT(EPOCH FROM (NOW() - v_start_time)) / 60;
  
  -- عدد العيادات المكتملة
  SELECT COUNT(*) INTO v_count
  FROM clinic_visits
  WHERE patient_visit_id = v_visit_id
    AND status = 'completed';
  
  -- تحديث الزيارة
  UPDATE patient_visits
  SET 
    end_time = NOW(),
    total_duration_minutes = v_duration,
    status = 'completed',
    updated_at = NOW()
  WHERE id = v_visit_id;
  
  RETURN QUERY SELECT v_visit_id, v_duration, v_count;
END;
$$ LANGUAGE plpgsql;

-- ========== 8. إنشاء view لتقارير الزيارات ==========
CREATE OR REPLACE VIEW patient_visits_report AS
SELECT 
  pv.id AS visit_id,
  pv.patient_id,
  pv.patient_name,
  pv.patient_type,
  pv.exam_type,
  pv.exam_type_ar,
  pv.visit_date,
  pv.start_time,
  pv.end_time,
  pv.total_duration_minutes,
  pv.status AS visit_status,
  COUNT(cv.id) AS total_clinics,
  COUNT(CASE WHEN cv.status = 'completed' THEN 1 END) AS completed_clinics,
  SUM(cv.duration_minutes) AS total_clinic_time,
  AVG(cv.duration_minutes) AS avg_clinic_time,
  jsonb_agg(
    jsonb_build_object(
      'clinic_id', cv.clinic_id,
      'clinic_name', cv.clinic_name_ar,
      'queue_number', cv.queue_number,
      'entered_at', cv.entered_at,
      'exited_at', cv.exited_at,
      'duration_minutes', cv.duration_minutes,
      'status', cv.status
    ) ORDER BY cv.created_at
  ) AS clinics_details
FROM patient_visits pv
LEFT JOIN clinic_visits cv ON pv.id = cv.patient_visit_id
GROUP BY pv.id, pv.patient_id, pv.patient_name, pv.patient_type, 
         pv.exam_type, pv.exam_type_ar, pv.visit_date, pv.start_time, 
         pv.end_time, pv.total_duration_minutes, pv.status;

-- ========== 9. إنشاء view لإحصائيات العيادات ==========
CREATE OR REPLACE VIEW clinic_statistics AS
SELECT 
  cv.clinic_id,
  cv.clinic_name_ar,
  DATE(cv.created_at) AS date,
  COUNT(*) AS total_visits,
  COUNT(CASE WHEN cv.status = 'completed' THEN 1 END) AS completed_visits,
  AVG(cv.duration_minutes) AS avg_duration,
  MIN(cv.duration_minutes) AS min_duration,
  MAX(cv.duration_minutes) AS max_duration,
  SUM(cv.duration_minutes) AS total_duration
FROM clinic_visits cv
WHERE cv.duration_minutes IS NOT NULL
GROUP BY cv.clinic_id, cv.clinic_name_ar, DATE(cv.created_at);

-- ========== 10. إنشاء دالة للحصول على تقرير مراجع ==========
CREATE OR REPLACE FUNCTION get_patient_visit_report(
  p_patient_id VARCHAR,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  visit_id UUID,
  patient_name VARCHAR,
  exam_type_ar VARCHAR,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  total_duration_minutes INTEGER,
  status VARCHAR,
  clinics JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id,
    pv.patient_name,
    pv.exam_type_ar,
    pv.start_time,
    pv.end_time,
    pv.total_duration_minutes,
    pv.status,
    jsonb_agg(
      jsonb_build_object(
        'clinic_name', cv.clinic_name_ar,
        'queue_number', cv.queue_number,
        'entered_at', cv.entered_at,
        'exited_at', cv.exited_at,
        'duration_minutes', cv.duration_minutes,
        'status', cv.status
      ) ORDER BY cv.created_at
    ) AS clinics
  FROM patient_visits pv
  LEFT JOIN clinic_visits cv ON pv.id = cv.patient_visit_id
  WHERE pv.patient_id = p_patient_id
    AND pv.visit_date = p_date
  GROUP BY pv.id, pv.patient_name, pv.exam_type_ar, pv.start_time, 
           pv.end_time, pv.total_duration_minutes, pv.status;
END;
$$ LANGUAGE plpgsql;

-- ========== 11. إنشاء triggers ==========
CREATE TRIGGER update_patient_visits_updated_at
  BEFORE UPDATE ON patient_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_visits_updated_at
  BEFORE UPDATE ON clinic_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== 12. منح الصلاحيات ==========
GRANT SELECT, INSERT, UPDATE ON patient_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON clinic_visits TO authenticated;
GRANT SELECT ON patient_visits_report TO authenticated;
GRANT SELECT ON clinic_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION start_patient_visit TO authenticated;
GRANT EXECUTE ON FUNCTION enter_clinic TO authenticated;
GRANT EXECUTE ON FUNCTION exit_clinic TO authenticated;
GRANT EXECUTE ON FUNCTION complete_patient_visit TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_visit_report TO authenticated;

-- ========== 13. إنشاء سياسات RLS ==========
ALTER TABLE patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read patient visits" ON patient_visits
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert patient visits" ON patient_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update patient visits" ON patient_visits
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can read clinic visits" ON clinic_visits
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert clinic visits" ON clinic_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update clinic visits" ON clinic_visits
  FOR UPDATE USING (true);

-- ========== 14. إنشاء دالة لتنظيف البيانات القديمة ==========
CREATE OR REPLACE FUNCTION cleanup_old_visit_data()
RETURNS void AS $$
BEGIN
  -- حذف الزيارات الأقدم من 90 يوم
  DELETE FROM patient_visits WHERE visit_date < CURRENT_DATE - INTERVAL '90 days';
  -- clinic_visits سيتم حذفها تلقائياً بسبب ON DELETE CASCADE
END;
$$ LANGUAGE plpgsql;

-- ========== ملاحظات التطبيق ==========
/**
 * استخدام النظام:
 * 
 * 1. عند بدء الزيارة:
 *    SELECT start_patient_visit('123456', 'أحمد محمد', 'military', 'recruitment', 
 *                                'فحص التجنيد', '[{"id":"clinic_001","nameAr":"الأشعة"}]'::jsonb);
 * 
 * 2. عند دخول عيادة:
 *    SELECT enter_clinic('123456', 'clinic_001', 5);
 * 
 * 3. عند الخروج من عيادة:
 *    SELECT * FROM exit_clinic('123456', 'clinic_001', 'فحص طبيعي');
 * 
 * 4. عند إنهاء الزيارة:
 *    SELECT * FROM complete_patient_visit('123456');
 * 
 * 5. للحصول على تقرير:
 *    SELECT * FROM get_patient_visit_report('123456', CURRENT_DATE);
 */
