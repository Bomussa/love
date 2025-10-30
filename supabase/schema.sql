-- Medical Committee System - Complete Database Schema
-- Version: 3.0.0
-- Date: 2025-10-30

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PATIENTS TABLE ====================
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  patient_id TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'logged_in',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_login_time ON patients(login_time);

-- ==================== CLINICS TABLE ====================
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  floor TEXT,
  capacity INTEGER DEFAULT 5,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default clinics
INSERT INTO clinics (id, name, name_en, floor, capacity, active) VALUES
  ('lab', 'المختبر', 'Laboratory', 'الطابق الأول', 5, TRUE),
  ('xray', 'الأشعة', 'X-Ray', 'الطابق الأول', 3, TRUE),
  ('dental', 'الأسنان', 'Dental', 'الطابق الثاني', 2, TRUE),
  ('eye', 'العيون', 'Eye', 'الطابق الثاني', 2, TRUE),
  ('general', 'الفحص العام', 'General Exam', 'الطابق الأرضي', 4, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ==================== QUEUE TABLE ====================
CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL REFERENCES clinics(id),
  exam_type TEXT DEFAULT 'general',
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'done', 'cancelled', 'exited')),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_patient_id ON queue(patient_id);
CREATE INDEX idx_queue_clinic_id ON queue(clinic_id);
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_position ON queue(position);
CREATE INDEX idx_queue_entered_at ON queue(entered_at);

-- ==================== PINS TABLE ====================
CREATE TABLE IF NOT EXISTS pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin TEXT NOT NULL,
  clinic_id TEXT NOT NULL REFERENCES clinics(id),
  date_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_pins_pin ON pins(pin);
CREATE INDEX idx_pins_clinic_id ON pins(clinic_id);
CREATE INDEX idx_pins_date_key ON pins(date_key);
CREATE INDEX idx_pins_status ON pins(status);
CREATE UNIQUE INDEX idx_pins_unique ON pins(pin, clinic_id, date_key);

-- ==================== ADMINS TABLE ====================
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- In production, use hashed passwords
  role TEXT NOT NULL DEFAULT 'clinic_admin' CHECK (role IN ('super_admin', 'clinic_admin', 'viewer')),
  clinic_id TEXT REFERENCES clinics(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_clinic_id ON admins(clinic_id);

-- Insert default admin
INSERT INTO admins (username, password, role, clinic_id) VALUES
  ('admin', 'admin123', 'super_admin', NULL)
ON CONFLICT (username) DO NOTHING;

-- ==================== SESSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE NOT NULL,
  admin_id UUID NOT NULL REFERENCES admins(id),
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  clinic_id TEXT REFERENCES clinics(id),
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ==================== ROUTES TABLE ====================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  clinics JSONB NOT NULL, -- Array of clinic IDs
  chosen_path TEXT,
  current_step INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_routes_patient_id ON routes(patient_id);
CREATE INDEX idx_routes_status ON routes(status);

-- ==================== EVENTS TABLE ====================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  patient_id TEXT,
  clinic_id TEXT REFERENCES clinics(id),
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_patient_id ON events(patient_id);
CREATE INDEX idx_events_clinic_id ON events(clinic_id);
CREATE INDEX idx_events_created_at ON events(created_at);

-- ==================== SETTINGS TABLE ====================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON settings(key);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('call_interval', '30', 'Default call interval in seconds'),
  ('pin_expiry', '300', 'PIN expiry time in seconds'),
  ('system_name', '"نظام قيادة الخدمات الطبية"', 'System name'),
  ('system_version', '"3.0.0"', 'System version')
ON CONFLICT (key) DO NOTHING;

-- ==================== NOTIFICATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT,
  clinic_id TEXT REFERENCES clinics(id),
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_patient_id ON notifications(patient_id);
CREATE INDEX idx_notifications_clinic_id ON notifications(clinic_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ==================== AUDIT_LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ==================== REPORTS TABLE ====================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'annual')),
  date_key TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_report_type ON reports(report_type);
CREATE INDEX idx_reports_date_key ON reports(date_key);
CREATE INDEX idx_reports_created_at ON reports(created_at);

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_updated_at BEFORE UPDATE ON queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (for now, adjust based on requirements)
CREATE POLICY "Allow anonymous access" ON patients FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON clinics FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON queue FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON pins FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON admins FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON routes FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON events FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON settings FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON notifications FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON reports FOR ALL USING (true);

-- ==================== COMMENTS ====================

COMMENT ON TABLE patients IS 'Stores patient login sessions';
COMMENT ON TABLE clinics IS 'Stores clinic information and configuration';
COMMENT ON TABLE queue IS 'Stores patient queue entries for each clinic';
COMMENT ON TABLE pins IS 'Stores generated PINs for clinic access';
COMMENT ON TABLE admins IS 'Stores admin user accounts';
COMMENT ON TABLE sessions IS 'Stores admin login sessions';
COMMENT ON TABLE routes IS 'Stores patient examination routes';
COMMENT ON TABLE events IS 'Stores system events for real-time updates';
COMMENT ON TABLE settings IS 'Stores system configuration settings';
COMMENT ON TABLE notifications IS 'Stores patient and clinic notifications';
COMMENT ON TABLE audit_logs IS 'Stores audit trail of all system actions';
COMMENT ON TABLE reports IS 'Stores generated reports (daily, weekly, monthly, annual)';
