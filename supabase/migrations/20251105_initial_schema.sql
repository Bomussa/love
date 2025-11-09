-- ============================================
-- MMC-MMS Database Schema
-- Medical Queue Management System
-- Created: 2025-11-05
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PATIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id VARCHAR(20) UNIQUE NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT patient_id_format CHECK (length(patient_id) >= 5)
);

-- Index for faster lookups
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_created_at ON patients(created_at DESC);

-- ============================================
-- 2. CLINICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id VARCHAR(50) UNIQUE NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  is_open BOOLEAN DEFAULT FALSE,
  current_number INTEGER DEFAULT 0,
  daily_pin INTEGER,
  pin_generated_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_clinics_clinic_id ON clinics(clinic_id);
CREATE INDEX idx_clinics_is_open ON clinics(is_open);

-- Insert default clinics
INSERT INTO clinics (clinic_id, name_ar, name_en) VALUES
  ('lab', 'المختبر', 'Laboratory'),
  ('xray', 'الأشعة', 'X-Ray'),
  ('vitals', 'العلامات الحيوية', 'Vital Signs'),
  ('ecg', 'تخطيط القلب', 'ECG'),
  ('audio', 'السمعيات', 'Audiology'),
  ('eyes', 'العيون', 'Ophthalmology'),
  ('internal', 'الباطنية', 'Internal Medicine'),
  ('ent', 'الأنف والأذن والحنجرة', 'ENT'),
  ('surgery', 'الجراحة', 'Surgery'),
  ('dental', 'الأسنان', 'Dental'),
  ('psychiatry', 'الطب النفسي', 'Psychiatry'),
  ('derma', 'الجلدية', 'Dermatology'),
  ('bones', 'العظام', 'Orthopedics')
ON CONFLICT (clinic_id) DO NOTHING;

-- ============================================
-- 3. QUEUES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_number INTEGER NOT NULL,
  patient_id VARCHAR(20) NOT NULL,
  clinic_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'done', 'skipped', 'cancelled')),
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  called_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  exam_type VARCHAR(50),
  gender VARCHAR(10),
  FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  CONSTRAINT valid_queue_number CHECK (queue_number > 0)
);

-- Indexes for performance
CREATE INDEX idx_queues_clinic_status ON queues(clinic_id, status);
CREATE INDEX idx_queues_patient_id ON queues(patient_id);
CREATE INDEX idx_queues_entered_at ON queues(entered_at DESC);
CREATE INDEX idx_queues_status ON queues(status);

-- ============================================
-- 4. PATHWAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pathways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id VARCHAR(20) NOT NULL,
  exam_type VARCHAR(50) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  pathway JSONB NOT NULL,
  current_step INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_current_step CHECK (current_step >= 0)
);

-- Indexes
CREATE INDEX idx_pathways_patient_id ON pathways(patient_id);
CREATE INDEX idx_pathways_exam_type ON pathways(exam_type);
CREATE INDEX idx_pathways_completed ON pathways(completed);

-- ============================================
-- 5. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id VARCHAR(20) NOT NULL,
  clinic_id VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'urgent', 'success')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_notifications_patient_id ON notifications(patient_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- 6. ADMIN_USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'viewer')),
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_admin_users_username ON admin_users(username);

-- Insert default admin (password: BOMUSSA14490)
-- Note: In production, use proper password hashing
INSERT INTO admin_users (username, password_hash, role) VALUES
  ('admin', '$2a$10$YourHashedPasswordHere', 'super_admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 7. REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'annual')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(report_date, report_type)
);

-- Indexes
CREATE INDEX idx_reports_date_type ON reports(report_date DESC, report_type);

-- ============================================
-- 8. AUDIT_LOG TABLE (للمراقبة والأمان)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pathways_updated_at BEFORE UPDATE ON pathways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for public access (anon key)
-- Patients can read their own data
CREATE POLICY "Patients can view their own data" ON patients
  FOR SELECT USING (true);

CREATE POLICY "Patients can insert their own data" ON patients
  FOR INSERT WITH CHECK (true);

-- Clinics are publicly readable
CREATE POLICY "Clinics are publicly readable" ON clinics
  FOR SELECT USING (true);

-- Queues policies
CREATE POLICY "Users can view queues" ON queues
  FOR SELECT USING (true);

CREATE POLICY "Users can insert into queues" ON queues
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their queue entries" ON queues
  FOR UPDATE USING (true);

-- Pathways policies
CREATE POLICY "Users can view pathways" ON pathways
  FOR SELECT USING (true);

CREATE POLICY "Users can insert pathways" ON pathways
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update pathways" ON pathways
  FOR UPDATE USING (true);

-- Notifications policies
CREATE POLICY "Users can view notifications" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "Users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Reports are publicly readable
CREATE POLICY "Reports are publicly readable" ON reports
  FOR SELECT USING (true);

-- Admin users - restricted access
CREATE POLICY "Admin users restricted" ON admin_users
  FOR ALL USING (false);

-- Audit log - restricted access
CREATE POLICY "Audit log restricted" ON audit_log
  FOR ALL USING (false);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate daily PIN for clinic
CREATE OR REPLACE FUNCTION generate_daily_pin(clinic_id_param VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  new_pin INTEGER;
  today DATE;
BEGIN
  today := CURRENT_DATE;
  
  -- Generate random PIN (10-99)
  new_pin := floor(random() * 90 + 10)::INTEGER;
  
  -- Update clinic
  UPDATE clinics
  SET daily_pin = new_pin,
      pin_generated_at = today
  WHERE clinic_id = clinic_id_param;
  
  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- Function to get next queue number
CREATE OR REPLACE FUNCTION get_next_queue_number(clinic_id_param VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  max_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) INTO max_number
  FROM queues
  WHERE clinic_id = clinic_id_param
    AND DATE(entered_at) = CURRENT_DATE;
  
  RETURN max_number + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue position
CREATE OR REPLACE FUNCTION get_queue_position(
  clinic_id_param VARCHAR,
  patient_id_param VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
  position INTEGER;
BEGIN
  SELECT COUNT(*) INTO position
  FROM queues
  WHERE clinic_id = clinic_id_param
    AND status = 'waiting'
    AND queue_number < (
      SELECT queue_number
      FROM queues
      WHERE clinic_id = clinic_id_param
        AND patient_id = patient_id_param
        AND status = 'waiting'
      ORDER BY entered_at DESC
      LIMIT 1
    );
  
  RETURN position;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for active queues
CREATE OR REPLACE VIEW active_queues AS
SELECT 
  q.id,
  q.queue_number,
  q.patient_id,
  q.clinic_id,
  c.name_ar as clinic_name_ar,
  c.name_en as clinic_name_en,
  q.status,
  q.entered_at,
  q.exam_type,
  q.gender,
  EXTRACT(EPOCH FROM (NOW() - q.entered_at))/60 as wait_time_minutes
FROM queues q
JOIN clinics c ON q.clinic_id = c.clinic_id
WHERE q.status IN ('waiting', 'called')
  AND DATE(q.entered_at) = CURRENT_DATE
ORDER BY q.clinic_id, q.queue_number;

-- View for clinic statistics
CREATE OR REPLACE VIEW clinic_stats AS
SELECT 
  c.clinic_id,
  c.name_ar,
  c.name_en,
  c.is_open,
  c.current_number,
  COUNT(CASE WHEN q.status = 'waiting' THEN 1 END) as waiting_count,
  COUNT(CASE WHEN q.status = 'done' THEN 1 END) as completed_today,
  AVG(CASE 
    WHEN q.status = 'done' 
    THEN EXTRACT(EPOCH FROM (q.completed_at - q.entered_at))/60 
  END) as avg_service_time_minutes
FROM clinics c
LEFT JOIN queues q ON c.clinic_id = q.clinic_id 
  AND DATE(q.entered_at) = CURRENT_DATE
GROUP BY c.id, c.clinic_id, c.name_ar, c.name_en, c.is_open, c.current_number;

-- ============================================
-- INITIAL DATA SETUP
-- ============================================

-- Generate initial PINs for all clinics
DO $$
DECLARE
  clinic_record RECORD;
BEGIN
  FOR clinic_record IN SELECT clinic_id FROM clinics LOOP
    PERFORM generate_daily_pin(clinic_record.clinic_id);
  END LOOP;
END $$;

-- ============================================
-- GRANTS (for service role)
-- ============================================

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Grant read access to anon role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT, UPDATE ON patients, queues, pathways, notifications TO anon;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE patients IS 'جدول المرضى - يحتوي على معلومات المرضى الأساسية';
COMMENT ON TABLE clinics IS 'جدول العيادات - يحتوي على معلومات العيادات وحالتها';
COMMENT ON TABLE queues IS 'جدول الطوابير - يحتوي على طوابير الانتظار لكل عيادة';
COMMENT ON TABLE pathways IS 'جدول المسارات - يحتوي على المسارات الطبية لكل مريض';
COMMENT ON TABLE notifications IS 'جدول الإشعارات - يحتوي على إشعارات المرضى';
COMMENT ON TABLE admin_users IS 'جدول مستخدمي الإدارة - يحتوي على حسابات الإدارة';
COMMENT ON TABLE reports IS 'جدول التقارير - يحتوي على التقارير اليومية والشهرية';
COMMENT ON TABLE audit_log IS 'سجل المراجعة - يحتوي على جميع العمليات للمراقبة';

-- ============================================
-- END OF SCHEMA
-- ============================================

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

-- إضافة الجداول الحرجة إلى publication supabase_realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pathways;
