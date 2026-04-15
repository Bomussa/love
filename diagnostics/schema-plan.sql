-- ============================================================================
-- Supabase PostgreSQL Schema Plan
-- Migration from Cloudflare KV to Supabase PostgreSQL
-- Project: love (Medical Queue Management System)
-- Date: 2025-10-24
-- ============================================================================

-- ============================================================================
-- PHASE 1: جداول أساسية (Basic Tables)
-- ============================================================================

-- Table: users (المستخدمين)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'patient')),
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

COMMENT ON TABLE users IS 'جدول المستخدمين (Admin + Patients)';
COMMENT ON COLUMN users.role IS 'نوع المستخدم: admin أو patient';

-- Table: sessions (الجلسات)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_valid BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

COMMENT ON TABLE sessions IS 'جدول الجلسات النشطة';

-- Table: clinics (العيادات)
CREATE TABLE clinics (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  description TEXT,
  pin_code VARCHAR(10),
  pin_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  call_interval INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clinics_is_active ON clinics(is_active);
CREATE INDEX idx_clinics_pin_expires_at ON clinics(pin_expires_at);

COMMENT ON TABLE clinics IS 'جدول العيادات';
COMMENT ON COLUMN clinics.pin_code IS 'رمز PIN لفتح العيادة';
COMMENT ON COLUMN clinics.call_interval IS 'الفترة الزمنية بين الاستدعاءات (بالثواني)';

-- ============================================================================
-- PHASE 2: جداول البيانات الرئيسية (Main Data Tables)
-- ============================================================================

-- Table: queue (الطوابير) - CRITICAL
CREATE TABLE queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(100) NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  clinic_id VARCHAR(50) REFERENCES clinics(id),
  exam_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'cancelled')),
  position INTEGER,
  qr_code VARCHAR(255),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB
);

CREATE INDEX idx_queue_patient_id ON queue(patient_id);
CREATE INDEX idx_queue_clinic_id ON queue(clinic_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_entered_at ON queue(entered_at);
CREATE INDEX idx_queue_position ON queue(position);

COMMENT ON TABLE queue IS 'جدول الطوابير - الجدول الأهم في النظام';
COMMENT ON COLUMN queue.status IS 'حالة المريض: waiting, called, in_progress, completed, cancelled';
COMMENT ON COLUMN queue.metadata IS 'بيانات إضافية بصيغة JSON';

-- Table: notifications (الإشعارات)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(100),
  clinic_id VARCHAR(50) REFERENCES clinics(id),
  type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'update', 'alert', 'info')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX idx_notifications_patient_id ON notifications(patient_id);
CREATE INDEX idx_notifications_clinic_id ON notifications(clinic_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

COMMENT ON TABLE notifications IS 'جدول الإشعارات للمرضى';

-- Table: routes (المسارات الديناميكية)
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type VARCHAR(100) NOT NULL,
  route_name VARCHAR(255) NOT NULL,
  clinics JSONB NOT NULL,
  order_sequence INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routes_exam_type ON routes(exam_type);
CREATE INDEX idx_routes_is_active ON routes(is_active);

COMMENT ON TABLE routes IS 'جدول المسارات الديناميكية للفحوصات';
COMMENT ON COLUMN routes.clinics IS 'قائمة العيادات في المسار (JSON array)';

-- ============================================================================
-- PHASE 3: جداول التقارير والإعدادات (Reports & Settings)
-- ============================================================================

-- Table: reports (التقارير)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'yearly')),
  clinic_id VARCHAR(50) REFERENCES clinics(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_patients INTEGER DEFAULT 0,
  completed_patients INTEGER DEFAULT 0,
  cancelled_patients INTEGER DEFAULT 0,
  average_wait_time INTEGER,
  data JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_clinic_id ON reports(clinic_id);
CREATE INDEX idx_reports_period_start ON reports(period_start);
CREATE INDEX idx_reports_generated_at ON reports(generated_at);

COMMENT ON TABLE reports IS 'جدول التقارير (يومية، أسبوعية، شهرية، سنوية)';
COMMENT ON COLUMN reports.data IS 'بيانات التقرير التفصيلية (JSON)';

-- Table: settings (الإعدادات)
CREATE TABLE settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_public BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_settings_category ON settings(category);
CREATE INDEX idx_settings_is_public ON settings(is_public);

COMMENT ON TABLE settings IS 'جدول الإعدادات العامة للنظام';
COMMENT ON COLUMN settings.is_public IS 'هل الإعداد متاح للعرض العام؟';

-- Table: cache_logs (سجلات الكاش)
CREATE TABLE cache_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  action VARCHAR(50),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cache_logs_event_type ON cache_logs(event_type);
CREATE INDEX idx_cache_logs_resource_type ON cache_logs(resource_type);
CREATE INDEX idx_cache_logs_created_at ON cache_logs(created_at);

COMMENT ON TABLE cache_logs IS 'جدول سجلات الكاش والأحداث';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for queue table
CREATE POLICY "Patients can view their own queue status" ON queue
  FOR SELECT USING (patient_id = auth.uid()::text);

CREATE POLICY "Admins can view all queue entries" ON queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for notifications table
CREATE POLICY "Patients can view their own notifications" ON notifications
  FOR SELECT USING (patient_id = auth.uid()::text);

CREATE POLICY "Admins can view all notifications" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public read access for clinics and routes
CREATE POLICY "Public can view active clinics" ON clinics
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view active routes" ON routes
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- Triggers for updated_at columns
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- End of Schema
-- ============================================================================
