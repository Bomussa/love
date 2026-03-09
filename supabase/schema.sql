-- AUTO-GENERATED SNAPSHOT FROM supabase/migrations
-- Source of truth: migrations only


-- >>> BEGIN MIGRATION: 002_add_pins_and_reports.sql
-- ============================================
-- Migration: Add PIN System and Reporting Views
-- Created: 2025-11-10
-- Description: Adds pins table for clinic entry verification and reporting views
-- ============================================

-- ============================================
-- 1. PINS TABLE
-- Stores temporary PIN codes for clinic entry verification
-- ============================================
CREATE TABLE IF NOT EXISTS pins (
    id BIGSERIAL PRIMARY KEY,
    clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for PIN queries
CREATE INDEX IF NOT EXISTS idx_pins_clinic ON pins(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pins_valid ON pins(valid_until) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pins_pin_lookup ON pins(clinic_id, pin, valid_until) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Public read, authenticated write
CREATE POLICY "PINs are viewable by everyone" ON pins
    FOR SELECT USING (true);

CREATE POLICY "PINs can be inserted" ON pins
    FOR INSERT WITH CHECK (true);

CREATE POLICY "PINs can be updated" ON pins
    FOR UPDATE USING (true);

-- ============================================
-- 2. REPORTING VIEWS
-- Views for analytics and reports
-- ============================================

-- Daily activity view
CREATE OR REPLACE VIEW vw_daily_activity AS
SELECT 
    clinic_id,
    DATE(entered_at) as day,
    COUNT(*) as visits,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped_visits,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) FILTER (WHERE status = 'completed') as avg_wait_seconds
FROM queues
GROUP BY clinic_id, DATE(entered_at);

-- Today's real-time stats
CREATE OR REPLACE VIEW vw_today_now AS
SELECT
    (SELECT COUNT(*) FROM queues WHERE status IN ('waiting','serving') AND DATE(entered_at) = CURRENT_DATE) as in_queue_now,
    (SELECT COUNT(*) FROM queues WHERE DATE(entered_at) = CURRENT_DATE) as visits_today,
    (SELECT COUNT(*) FROM queues WHERE status = 'completed' AND DATE(entered_at) = CURRENT_DATE) as completed_today,
    (SELECT COUNT(DISTINCT patient_id) FROM queues WHERE DATE(entered_at) = CURRENT_DATE) as unique_patients_today;

-- Weekly summary view
CREATE OR REPLACE VIEW vw_weekly_summary AS
SELECT 
    DATE_TRUNC('week', entered_at) as week_start,
    clinic_id,
    COUNT(*) as total_visits,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) FILTER (WHERE status = 'completed') as avg_wait_seconds,
    COUNT(DISTINCT patient_id) as unique_patients
FROM queues
WHERE entered_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '8 weeks')
GROUP BY DATE_TRUNC('week', entered_at), clinic_id;

-- Monthly summary view
CREATE OR REPLACE VIEW vw_monthly_summary AS
SELECT 
    DATE_TRUNC('month', entered_at) as month_start,
    clinic_id,
    COUNT(*) as total_visits,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
    AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) FILTER (WHERE status = 'completed') as avg_wait_seconds,
    COUNT(DISTINCT patient_id) as unique_patients
FROM queues
WHERE entered_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY DATE_TRUNC('month', entered_at), clinic_id;

-- Clinic performance view (current status)
CREATE OR REPLACE VIEW vw_clinic_performance AS
SELECT 
    c.id as clinic_id,
    c.name_ar,
    c.name_en,
    COUNT(q.id) FILTER (WHERE q.status = 'waiting') as waiting_count,
    COUNT(q.id) FILTER (WHERE q.status = 'serving') as serving_count,
    (SELECT display_number FROM queues WHERE clinic_id = c.id AND status = 'serving' ORDER BY called_at DESC LIMIT 1) as current_serving,
    (SELECT display_number FROM queues WHERE clinic_id = c.id ORDER BY display_number DESC LIMIT 1) as last_number
FROM clinics c
LEFT JOIN queues q ON c.id = q.clinic_id AND DATE(q.entered_at) = CURRENT_DATE
WHERE c.is_active = true
GROUP BY c.id, c.name_ar, c.name_en
ORDER BY c.display_order;

-- Enable realtime for pins
ALTER PUBLICATION supabase_realtime ADD TABLE pins;

-- Comments
COMMENT ON TABLE pins IS 'Temporary PIN codes for clinic entry verification (5-minute validity)';
COMMENT ON VIEW vw_daily_activity IS 'Daily statistics per clinic';
COMMENT ON VIEW vw_today_now IS 'Real-time statistics for today';
COMMENT ON VIEW vw_weekly_summary IS 'Weekly statistics per clinic (last 8 weeks)';
COMMENT ON VIEW vw_monthly_summary IS 'Monthly statistics per clinic (last 12 months)';
COMMENT ON VIEW vw_clinic_performance IS 'Current queue status and performance per clinic';

-- <<< END MIGRATION: 002_add_pins_and_reports.sql


-- >>> BEGIN MIGRATION: 002_create_admin_users.sql
-- ============================================
-- Admin Users Table
-- Created: 2025-11-06
-- Description: Admin users authentication table
-- ============================================

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STAFF')),
    name TEXT NOT NULL,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin users can view own data" ON admin_users
    FOR SELECT USING (true);

CREATE POLICY "Admin users can be inserted" ON admin_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin users can be updated" ON admin_users
    FOR UPDATE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Insert default admin users
INSERT INTO admin_users (username, password, role, name, email) VALUES
('bomussa', '14490', 'SUPER_ADMIN', 'Bomussa Administrator', 'bomussa@hotmail.com'),
('admin', 'admin123', 'ADMIN', 'Administrator', 'admin@mmc-mms.com'),
('staff', 'staff123', 'STAFF', 'Staff Member', 'staff@mmc-mms.com')
ON CONFLICT (username) DO NOTHING;

-- Add comment
COMMENT ON TABLE admin_users IS 'Admin users for system authentication and authorization';

-- ============================================
-- ADMIN USERS TABLE COMPLETE
-- ============================================

-- <<< END MIGRATION: 002_create_admin_users.sql


-- >>> BEGIN MIGRATION: 2025-11-07_queue_core.sql
-- Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ============= TABLES =============

-- العيادات
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  capacity int not null default 20,            -- السعة القصوى
  is_open boolean not null default true,       -- الحالة التشغيلية
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- أرقام الدور اليومية لكل عيادة (إسناد ذرّي)
create table if not exists public.clinic_counters (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  date_key date not null,                      -- Asia/Qatar::date
  next_num int not null default 1,
  primary key (clinic_id, date_key)
);

-- طابور المراجعين
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  user_id uuid not null,                       -- auth.users.id
  number int not null,                         -- رقم الدور الممنوح
  status text not null check (status in ('waiting','in_service','done','cancelled')),
  created_at timestamptz not null default now(),
  entered_at timestamptz,
  left_at timestamptz
);

-- إشعارات بسيطة (اختياري للـpolling)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

-- ============= INDEXES =============
create index if not exists idx_queues_clinic_status on public.queues (clinic_id, status);
create index if not exists idx_queues_user_status   on public.queues (user_id, status);
create index if not exists idx_notif_user_sent      on public.notifications (user_id, sent_at desc);

-- ============= RLS =============
alter table public.queues enable row level security;
alter table public.notifications enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_counters enable row level security;

-- سياسات العيادات: قراءة للجميع (تعرض الحالة فقط)، تعديل عبر وظائف فقط
create policy clinics_select_all on public.clinics
  for select using (true);

-- counters: لا وصول مباشر (وظائف فقط)
create policy counters_no_select on public.clinic_counters
  for select using (false);
create policy counters_no_write on public.clinic_counters
  for all using (false) with check (false);

-- queues: المستخدم يرى سجلاته فقط، الإدارة عبر وظائف
create policy queues_select_self on public.queues
  for select using (auth.uid() = user_id);

create policy queues_insert_via_func on public.queues
  for insert with check (false);

create policy queues_update_via_func on public.queues
  for update using (false) with check (false);

-- notifications: المستخدم يرى/يحدّث إشعاراته فقط
create policy notif_select_self on public.notifications
  for select using (auth.uid() = user_id);

create policy notif_update_self on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy notif_insert_via_func on public.notifications
  for insert with check (false);

-- ============= VIEWS (ملخّصات حالية) =============
-- يوم قطر (UTC+3)
create or replace view public.clinic_status as
select
  c.id,
  c.code,
  c.name,
  c.capacity,
  c.is_open,
  coalesce(sum((q.status = 'waiting')::int),0) as waiting_count,
  coalesce(sum((q.status = 'in_service')::int),0) as in_service_count,
  (coalesce(sum((q.status = 'waiting')::int),0) >= c.capacity or not c.is_open) as is_full
from public.clinics c
left join public.queues q
  on q.clinic_id = c.id and q.created_at::date = (timezone('Asia/Qatar', now()))::date
group by c.id, c.code, c.name, c.capacity, c.is_open;

-- ============= FUNCTIONS (RPC) =============

-- تاريخ اليوم في قطر
create or replace function public.today_qatar() returns date
language sql stable as $$
  select (timezone('Asia/Qatar', now()))::date;
$$;

-- يمنح رقم دور جديد ذرّياً ويُدرِج في queues
create or replace function public.queue_create(p_clinic_id uuid)
returns table (queue_id uuid, clinic_id uuid, user_id uuid, number int, status text, created_at timestamptz)
language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_date date := public.today_qatar();
  v_num int;
  v_is_open boolean;
  v_capacity int;
  v_waiting int;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  select is_open, capacity into v_is_open, v_capacity from public.clinics where id = p_clinic_id;
  if not found then
    raise exception 'clinic_not_found';
  end if;
  if not v_is_open then
    raise exception 'clinic_closed';
  end if;

  -- عدد المنتظرين الحالي
  select coalesce(count(*),0) into v_waiting
  from public.queues where clinic_id = p_clinic_id
    and created_at::date = v_date and status = 'waiting';

  if v_waiting >= v_capacity then
    raise exception 'clinic_full';
  end if;

  -- upsert العداد + استرجاع الرقم الذرّي
  insert into public.clinic_counters (clinic_id, date_key, next_num)
  values (p_clinic_id, v_date, 2)
  on conflict (clinic_id, date_key) do update
    set next_num = public.clinic_counters.next_num + 1
  returning case
    when xmax = 0 then 1 -- السطر الجديد يبدأ بـ 1
    else public.clinic_counters.next_num - 1
  end into v_num;

  insert into public.queues (clinic_id, user_id, number, status)
  values (p_clinic_id, v_user, v_num, 'waiting')
  returning id, clinic_id, user_id, number, status, created_at
  into queue_id, clinic_id, user_id, number, status, created_at;
end;
$$;

-- دخول العيادة
create or replace function public.queue_enter(p_queue_id uuid)
returns table (queue_id uuid, entered_at timestamptz, status text)
language plpgsql security definer as $$
begin
  update public.queues
    set entered_at = now(), status = 'in_service'
  where id = p_queue_id and status = 'waiting'
  returning id, entered_at, status into queue_id, entered_at, status;

  if queue_id is null then
    raise exception 'invalid_state';
  end if;
end;
$$;

-- إنهاء/خروج من العيادة
create or replace function public.queue_leave(p_queue_id uuid, p_status text default 'done')
returns table (queue_id uuid, left_at timestamptz, status text)
language plpgsql security definer as $$
begin
  if p_status not in ('done','cancelled') then
    raise exception 'bad_status';
  end if;

  update public.queues
    set left_at = now(), status = p_status
  where id = p_queue_id and status in ('waiting','in_service')
  returning id, left_at, status into queue_id, left_at, status;

  if queue_id is null then
    raise exception 'invalid_state';
  end if;
end;
$$;

-- قائمة العيادات مع الحالة اللحظية
create or replace function public.clinics_list()
returns setof public.clinic_status
language sql stable as $$
  select * from public.clinic_status order by name;
$$;

-- إشعار بسيط (اختياري)
create or replace function public.notify_user(p_user uuid, p_type text, p_payload jsonb)
returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- صلاحيات تنفيذ للـauthenticated فقط
revoke all on function public.queue_create(uuid)  from public;
revoke all on function public.queue_enter(uuid)   from public;
revoke all on function public.queue_leave(uuid, text) from public;
revoke all on function public.clinics_list()      from public;
revoke all on function public.notify_user(uuid, text, jsonb) from public;

grant execute on function public.queue_create(uuid)             to authenticated;
grant execute on function public.queue_enter(uuid)              to authenticated;
grant execute on function public.queue_leave(uuid, text)        to authenticated;
grant execute on function public.clinics_list()                 to anon, authenticated;
grant execute on function public.notify_user(uuid, text, jsonb) to authenticated;

-- ============= REALTIME (نسخ تغييرات) =============
alter publication supabase_realtime add table public.queues;

-- <<< END MIGRATION: 2025-11-07_queue_core.sql


-- >>> BEGIN MIGRATION: 20251102_login_audit.sql
-- Migration: Login Audit Trail
-- Created: 2025-11-02
-- Purpose: Track login attempts for security and analytics

-- Create login_audit table
CREATE TABLE IF NOT EXISTS public.login_audit (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON public.login_audit(email);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON public.login_audit(created_at DESC);

-- Create index on success for filtering failed attempts
CREATE INDEX IF NOT EXISTS idx_login_audit_success ON public.login_audit(success);

-- Enable Row Level Security
ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert audit records
CREATE POLICY "Service role can insert login audit"
  ON public.login_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Only service role and authenticated admins can read audit records
CREATE POLICY "Service role can read login audit"
  ON public.login_audit
  FOR SELECT
  TO service_role
  USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.login_audit TO service_role;

-- Add comment to table
COMMENT ON TABLE public.login_audit IS 'Audit trail for login attempts - tracks both successful and failed authentication events';

-- Add comments to columns
COMMENT ON COLUMN public.login_audit.email IS 'Email address used in login attempt';
COMMENT ON COLUMN public.login_audit.success IS 'Whether the login attempt was successful';
COMMENT ON COLUMN public.login_audit.ip_address IS 'IP address of the client making the request';
COMMENT ON COLUMN public.login_audit.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN public.login_audit.error_message IS 'Error message if login failed';
COMMENT ON COLUMN public.login_audit.created_at IS 'Timestamp when the login attempt occurred';

-- <<< END MIGRATION: 20251102_login_audit.sql


-- >>> BEGIN MIGRATION: 20251105_initial_schema.sql
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

-- <<< END MIGRATION: 20251105_initial_schema.sql


-- >>> BEGIN MIGRATION: 202603090001_admin_update_patient_id_atomic.sql
-- Atomic admin-only patient ID update across unified_queue, device_logins, and patients.
create or replace function public.admin_update_patient_id_atomic(
  p_queue_id uuid,
  p_old_id text,
  p_new_id text,
  p_login_date date default current_date
)
returns table (
  old_id text,
  new_id text,
  updated_rows jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_role text;
  v_is_admin boolean := false;
  v_queue_updates integer := 0;
  v_device_updates integer := 0;
  v_patients_updates integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Admin check: role claim OR roles table.
  v_claim_role := coalesce(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  v_is_admin := lower(coalesce(v_claim_role, '')) in ('admin', 'service_role', 'super_admin');

  if not v_is_admin and to_regclass('public.roles') is not null then
    execute $$
      select exists (
        select 1
        from public.roles r
        where r.user_id = auth.uid()
          and lower(r.role) in ('admin', 'super_admin')
      )
    $$ into v_is_admin;
  end if;

  if not v_is_admin then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p_new_id is null or btrim(p_new_id) = '' then
    raise exception 'New patient ID cannot be empty' using errcode = '22023';
  end if;

  -- 1) Update targeted queue row.
  update public.unified_queue
  set patient_id = btrim(p_new_id)
  where id = p_queue_id
  returning 1 into v_queue_updates;

  v_queue_updates := coalesce(v_queue_updates, 0);

  -- 2) Update today's device login rows for same old ID.
  update public.device_logins
  set patient_id = btrim(p_new_id)
  where patient_id = p_old_id
    and login_date = p_login_date;

  get diagnostics v_device_updates = row_count;

  -- 3) Update master patient rows.
  update public.patients
  set patient_id = btrim(p_new_id)
  where patient_id = p_old_id;

  get diagnostics v_patients_updates = row_count;

  if v_queue_updates = 0 then
    raise exception 'Queue row not found or not updated' using errcode = 'P0002';
  end if;

  old_id := p_old_id;
  new_id := btrim(p_new_id);
  updated_rows := jsonb_build_object(
    'unified_queue', v_queue_updates,
    'device_logins', v_device_updates,
    'patients', v_patients_updates,
    'total', v_queue_updates + v_device_updates + v_patients_updates
  );

  return next;

exception
  when unique_violation then
    raise exception 'Update failed due to uniqueness conflict while changing patient ID from % to %', p_old_id, p_new_id
      using errcode = '23505';
  when foreign_key_violation or check_violation or not_null_violation then
    raise exception 'Update failed due to constraint violation while changing patient ID from % to %', p_old_id, p_new_id
      using errcode = sqlstate;
  when others then
    -- Re-raise. In Postgres, this aborts the statement transaction (automatic rollback).
    raise;
end;
$$;

grant execute on function public.admin_update_patient_id_atomic(uuid, text, text, date) to authenticated;

-- <<< END MIGRATION: 202603090001_admin_update_patient_id_atomic.sql


-- >>> BEGIN MIGRATION: 202603090020_security_hardening_and_schema_alignment.sql
-- ============================================================
-- Security hardening + schema alignment
-- - Removes permissive USING (true) / WITH CHECK (true) policies
-- - Adds identity/role-aware RLS for sensitive tables
-- - Ensures compatibility entities used in code exist
-- ============================================================

-- ----------
-- Helpers
-- ----------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() ->> 'role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_actor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    auth.role() = 'service_role'
    OR public.current_app_role() IN ('admin', 'super_admin', 'operator')
    OR EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('admin', 'operator')
    )
  );
$$;

-- ----------
-- Ensure compatibility entities used by code
-- ----------
CREATE TABLE IF NOT EXISTS public.unified_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  exam_type TEXT,
  queue_number INTEGER,
  display_number INTEGER,
  priority_type TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_queue_clinic_status
  ON public.unified_queue(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_unified_queue_patient
  ON public.unified_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_unified_queue_entered
  ON public.unified_queue(entered_at DESC);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value)
VALUES ('system_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.vw_daily_activity AS
SELECT
  q.clinic_id,
  DATE(q.entered_at) AS day,
  COUNT(*) AS visits,
  COUNT(*) FILTER (WHERE q.status = 'completed') AS completed_visits,
  COUNT(*) FILTER (WHERE q.status = 'skipped') AS skipped_visits,
  AVG(EXTRACT(EPOCH FROM (q.completed_at - q.entered_at))) FILTER (WHERE q.status = 'completed') AS avg_wait_seconds
FROM public.queues q
GROUP BY q.clinic_id, DATE(q.entered_at);

CREATE OR REPLACE VIEW public.vw_today_now AS
SELECT
  (SELECT COUNT(*) FROM public.queues WHERE status IN ('waiting','serving') AND DATE(entered_at) = CURRENT_DATE) AS in_queue_now,
  (SELECT COUNT(*) FROM public.queues WHERE DATE(entered_at) = CURRENT_DATE) AS visits_today,
  (SELECT COUNT(*) FROM public.queues WHERE status = 'completed' AND DATE(entered_at) = CURRENT_DATE) AS completed_today,
  (SELECT COUNT(DISTINCT patient_id) FROM public.queues WHERE DATE(entered_at) = CURRENT_DATE) AS unique_patients_today;

-- ----------
-- Harden RLS for sensitive tables
-- ----------
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view their own data" ON public.patients;
DROP POLICY IF EXISTS "Patients can insert their own data" ON public.patients;
DROP POLICY IF EXISTS "Users can view queues" ON public.queues;
DROP POLICY IF EXISTS "Users can insert into queues" ON public.queues;
DROP POLICY IF EXISTS "Users can update their queue entries" ON public.queues;
DROP POLICY IF EXISTS "Allow public read access on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated insert on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated update on queues" ON public.queues;
DROP POLICY IF EXISTS "Allow authenticated delete on queues" ON public.queues;
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "PINs are viewable by everyone" ON public.pins;
DROP POLICY IF EXISTS "PINs can be inserted" ON public.pins;
DROP POLICY IF EXISTS "PINs can be updated" ON public.pins;
DROP POLICY IF EXISTS "System settings are viewable by everyone" ON public.system_settings;

CREATE POLICY "patients_select_self_or_admin" ON public.patients
FOR SELECT
USING (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "patients_insert_self_or_admin" ON public.patients
FOR INSERT
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "patients_update_self_or_admin" ON public.patients
FOR UPDATE
USING (public.is_admin_actor() OR auth.uid()::text = patient_id)
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "queues_select_related_or_admin" ON public.queues
FOR SELECT
USING (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "queues_insert_related_or_admin" ON public.queues
FOR INSERT
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "queues_update_admin_only" ON public.queues
FOR UPDATE
USING (public.is_admin_actor())
WITH CHECK (public.is_admin_actor());

CREATE POLICY "queues_delete_admin_only" ON public.queues
FOR DELETE
USING (public.is_admin_actor());

CREATE POLICY "notifications_select_related_or_admin" ON public.notifications
FOR SELECT
USING (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "notifications_insert_admin_only" ON public.notifications
FOR INSERT
WITH CHECK (public.is_admin_actor());

CREATE POLICY "notifications_update_related_or_admin" ON public.notifications
FOR UPDATE
USING (public.is_admin_actor() OR auth.uid()::text = patient_id)
WITH CHECK (public.is_admin_actor() OR auth.uid()::text = patient_id);

CREATE POLICY "notifications_delete_admin_only" ON public.notifications
FOR DELETE
USING (public.is_admin_actor());

CREATE POLICY "pins_select_admin_only" ON public.pins
FOR SELECT
USING (public.is_admin_actor());

CREATE POLICY "pins_insert_admin_only" ON public.pins
FOR INSERT
WITH CHECK (public.is_admin_actor());

CREATE POLICY "pins_update_admin_only" ON public.pins
FOR UPDATE
USING (public.is_admin_actor())
WITH CHECK (public.is_admin_actor());

CREATE POLICY "system_settings_select_admin_only" ON public.system_settings
FOR SELECT
USING (public.is_admin_actor());

CREATE POLICY "system_settings_insert_admin_only" ON public.system_settings
FOR INSERT
WITH CHECK (public.is_admin_actor());

CREATE POLICY "system_settings_update_admin_only" ON public.system_settings
FOR UPDATE
USING (public.is_admin_actor())
WITH CHECK (public.is_admin_actor());

CREATE POLICY "system_settings_delete_admin_only" ON public.system_settings
FOR DELETE
USING (public.is_admin_actor());

-- <<< END MIGRATION: 202603090020_security_hardening_and_schema_alignment.sql


-- >>> BEGIN MIGRATION: 20260309_create_api_failover_events.sql
create table if not exists public.api_failover_events (
  id bigserial primary key,
  endpoint text not null,
  failure_reason text not null,
  attempt_duration_ms integer not null default 0 check (attempt_duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_api_failover_events_created_at
  on public.api_failover_events (created_at desc);

create index if not exists idx_api_failover_events_endpoint
  on public.api_failover_events (endpoint);

-- <<< END MIGRATION: 20260309_create_api_failover_events.sql


-- >>> BEGIN MIGRATION: 20260309_fix_display_number_priority_fields.sql
-- Ensure display_number is numeric and add priority metadata fields.
-- Also sanitize legacy rows where display_number was stored as text.

ALTER TABLE IF EXISTS public.queues
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_label TEXT;

ALTER TABLE IF EXISTS public.unified_queue
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_label TEXT;

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type
  INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'unified_queue'
    AND column_name = 'display_number';

  IF col_type IN ('character varying', 'text') THEN
    EXECUTE $migration$
      WITH normalized AS (
        SELECT
          id,
          clinic_id,
          entered_at,
          CASE
            WHEN trim(display_number) ~ '^[0-9]+$' THEN trim(display_number)::integer
            ELSE NULL
          END AS numeric_display,
          row_number() OVER (
            PARTITION BY clinic_id
            ORDER BY entered_at, id
          ) AS clinic_seq
        FROM public.unified_queue
      ),
      fallback AS (
        SELECT
          id,
          COALESCE(
            numeric_display,
            COALESCE(max(numeric_display) OVER (PARTITION BY clinic_id), 0) + clinic_seq
          ) AS cleaned_display
        FROM normalized
      )
      UPDATE public.unified_queue q
      SET display_number = fallback.cleaned_display::text
      FROM fallback
      WHERE q.id = fallback.id;
    $migration$;

    ALTER TABLE public.unified_queue
      ALTER COLUMN display_number TYPE INTEGER
      USING NULLIF(regexp_replace(display_number::text, '[^0-9]', '', 'g'), '')::INTEGER;
  END IF;
END $$;

-- <<< END MIGRATION: 20260309_fix_display_number_priority_fields.sql


-- >>> BEGIN MIGRATION: create_exam_types.sql
-- Create exam_types table
-- This table stores different types of medical examinations

CREATE TABLE IF NOT EXISTS public.exam_types (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  pathway JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.exam_types
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update
CREATE POLICY "Allow authenticated insert" ON public.exam_types
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.exam_types
  FOR UPDATE USING (true);

-- Insert default exam types
INSERT INTO public.exam_types (id, name_ar, name_en, description, pathway, display_order) VALUES
  ('recruitment', 'فحص التجنيد', 'Recruitment Exam', 'فحص طبي شامل للتجنيد', '["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent", "surgery", "dental", "psychiatry", "dermatology", "orthopedics"]'::jsonb, 1),
  ('transfer', 'فحص النقل', 'Transfer Exam', 'فحص طبي للنقل بين الوحدات', '["lab", "radiology", "vitals", "internal"]'::jsonb, 2),
  ('promotion', 'فحص الترفيع', 'Promotion Exam', 'فحص طبي للترفيع', '["lab", "vitals", "internal"]'::jsonb, 3),
  ('conversion', 'فحص التحويل', 'Conversion Exam', 'فحص طبي للتحويل', '["lab", "radiology", "vitals", "internal"]'::jsonb, 4),
  ('courses', 'فحص الدورات', 'Courses Exam', 'فحص طبي للدورات الداخلية والخارجية', '["lab", "vitals", "internal"]'::jsonb, 5),
  ('cooks', 'فحص الطباخين', 'Cooks Exam', 'فحص طبي خاص بالطباخين', '["lab", "radiology", "vitals", "internal", "dermatology"]'::jsonb, 6),
  ('aviation', 'فحص الطيران السنوي', 'Annual Aviation Exam', 'فحص طبي سنوي للطيران', '["lab", "radiology", "vitals", "ecg", "audiology", "eyes", "internal", "ent"]'::jsonb, 7),
  ('contract_renewal', 'تجديد التعاقد', 'Contract Renewal', 'فحص طبي لتجديد التعاقد', '["lab", "vitals", "internal"]'::jsonb, 8)
ON CONFLICT (id) DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_exam_types_active ON public.exam_types(is_active);
CREATE INDEX IF NOT EXISTS idx_exam_types_order ON public.exam_types(display_order);

-- <<< END MIGRATION: create_exam_types.sql


-- >>> BEGIN MIGRATION: create_missing_tables.sql
-- إنشاء جدول exam_types
CREATE TABLE IF NOT EXISTS public.exam_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    pathway JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء جدول queues
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    exam_type_id UUID REFERENCES public.exam_types(id),
    clinic_id UUID,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'cancelled')),
    position INTEGER,
    priority INTEGER DEFAULT 0,
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_wait_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء جدول pathways
CREATE TABLE IF NOT EXISTS public.pathways (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id TEXT NOT NULL,
    exam_type_id UUID REFERENCES public.exam_types(id),
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_queues_patient_id ON public.queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_queues_status ON public.queues(status);
CREATE INDEX IF NOT EXISTS idx_queues_clinic_id ON public.queues(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pathways_patient_id ON public.pathways(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathways_status ON public.pathways(status);

-- إنشاء triggers للتحديث التلقائي
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_exam_types_updated_at BEFORE UPDATE ON public.exam_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pathways_updated_at BEFORE UPDATE ON public.pathways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- تفعيل RLS
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathways ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للقراءة العامة
CREATE POLICY "Allow public read access on exam_types" ON public.exam_types
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on queues" ON public.queues
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on pathways" ON public.pathways
    FOR SELECT USING (true);

-- سياسات RLS للكتابة (مصادقة مطلوبة)
CREATE POLICY "Allow authenticated insert on queues" ON public.queues
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on queues" ON public.queues
    FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated insert on pathways" ON public.pathways
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on pathways" ON public.pathways
    FOR UPDATE USING (true);

-- إدراج أنواع الفحوصات الطبية الثمانية
INSERT INTO public.exam_types (name_ar, name_en, code, pathway, duration_minutes) VALUES
('فحص التجنيد', 'Recruitment Exam', 'recruitment', 
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "dental", "name_ar": "فحص الأسنان", "name_en": "Dental Exam"},
   {"step": 5, "clinic": "ent", "name_ar": "الأنف والأذن والحنجرة", "name_en": "ENT"},
   {"step": 6, "clinic": "cardiology", "name_ar": "القلب", "name_en": "Cardiology"},
   {"step": 7, "clinic": "chest", "name_ar": "الصدر", "name_en": "Chest"},
   {"step": 8, "clinic": "surgery", "name_ar": "الجراحة", "name_en": "Surgery"},
   {"step": 9, "clinic": "orthopedic", "name_ar": "العظام", "name_en": "Orthopedic"},
   {"step": 10, "clinic": "neurology", "name_ar": "الأعصاب", "name_en": "Neurology"},
   {"step": 11, "clinic": "psychiatry", "name_ar": "الطب النفسي", "name_en": "Psychiatry"},
   {"step": 12, "clinic": "lab", "name_ar": "المختبر", "name_en": "Laboratory"},
   {"step": 13, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb, 
 180),

('فحص النقل', 'Transfer Exam', 'transfer',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 60),

('فحص الترفيع', 'Promotion Exam', 'promotion',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 45),

('فحص التحويل', 'Conversion Exam', 'conversion',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 60),

('فحص الدورات', 'Courses Exam', 'courses',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 45),

('فحص الطباخين', 'Cooks Exam', 'cooks',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "dental", "name_ar": "فحص الأسنان", "name_en": "Dental Exam"},
   {"step": 4, "clinic": "lab", "name_ar": "المختبر", "name_en": "Laboratory"},
   {"step": 5, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 75),

('فحص الطيران السنوي', 'Annual Aviation Exam', 'aviation',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "vision", "name_ar": "فحص النظر", "name_en": "Vision Test"},
   {"step": 4, "clinic": "ent", "name_ar": "الأنف والأذن والحنجرة", "name_en": "ENT"},
   {"step": 5, "clinic": "cardiology", "name_ar": "القلب", "name_en": "Cardiology"},
   {"step": 6, "clinic": "neurology", "name_ar": "الأعصاب", "name_en": "Neurology"},
   {"step": 7, "clinic": "lab", "name_ar": "المختبر", "name_en": "Laboratory"},
   {"step": 8, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 120),

('تجديد التعاقد', 'Contract Renewal', 'renewal',
 '[{"step": 1, "clinic": "reception", "name_ar": "الاستقبال", "name_en": "Reception"},
   {"step": 2, "clinic": "general", "name_ar": "الفحص العام", "name_en": "General Exam"},
   {"step": 3, "clinic": "final", "name_ar": "الفحص النهائي", "name_en": "Final Review"}]'::jsonb,
 45)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.exam_types IS 'أنواع الفحوصات الطبية المتاحة';
COMMENT ON TABLE public.queues IS 'طوابير الانتظار للمرضى';
COMMENT ON TABLE public.pathways IS 'مسارات الفحص للمرضى';

-- <<< END MIGRATION: create_missing_tables.sql


-- >>> BEGIN MIGRATION: critical_additions.sql
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

-- <<< END MIGRATION: critical_additions.sql


-- >>> BEGIN MIGRATION: enhance_exam_types_security.sql
-- Enhancement Script for exam_types table
-- This script adds security policies, triggers, and indexes for better performance and security

-- ============================================
-- 1. Update RLS Policies for Better Security
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read" ON public.exam_types;
DROP POLICY IF EXISTS "Allow public insert" ON public.exam_types;
DROP POLICY IF EXISTS "Allow public update" ON public.exam_types;

-- Allow authenticated users to read exam types
CREATE POLICY "Allow authenticated read" ON public.exam_types
  FOR SELECT 
  TO authenticated
  USING (true);

-- Allow public (anonymous) users to read exam types (for login page)
CREATE POLICY "Allow anon read" ON public.exam_types
  FOR SELECT 
  TO anon
  USING (true);

-- Allow service_role to insert/update/delete (for admin operations)
CREATE POLICY "Allow service_role all" ON public.exam_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. Create or Replace update_updated_at Function
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Add Trigger to Auto-Update updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_exam_types_updated_at ON public.exam_types;

CREATE TRIGGER update_exam_types_updated_at
  BEFORE UPDATE ON public.exam_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. Create Indexes for Performance
-- ============================================

-- Index for filtering by is_active
CREATE INDEX IF NOT EXISTS idx_exam_types_is_active 
  ON public.exam_types(is_active);

-- Index for ordering by display_order
CREATE INDEX IF NOT EXISTS idx_exam_types_display_order 
  ON public.exam_types(display_order);

-- Composite index for common queries (active + order)
CREATE INDEX IF NOT EXISTS idx_exam_types_active_order 
  ON public.exam_types(is_active, display_order);

-- ============================================
-- 5. Add Comments for Documentation
-- ============================================

COMMENT ON TABLE public.exam_types IS 'Stores different types of medical examinations with their pathways';
COMMENT ON COLUMN public.exam_types.id IS 'Unique identifier for the exam type';
COMMENT ON COLUMN public.exam_types.name_ar IS 'Arabic name of the exam type';
COMMENT ON COLUMN public.exam_types.name_en IS 'English name of the exam type';
COMMENT ON COLUMN public.exam_types.description IS 'Detailed description of the exam type';
COMMENT ON COLUMN public.exam_types.pathway IS 'JSON array of clinic IDs representing the examination pathway';
COMMENT ON COLUMN public.exam_types.is_active IS 'Whether this exam type is currently active and available';
COMMENT ON COLUMN public.exam_types.display_order IS 'Order in which exam types should be displayed';
COMMENT ON COLUMN public.exam_types.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN public.exam_types.updated_at IS 'Timestamp when the record was last updated (auto-updated by trigger)';

-- ============================================
-- 6. Verification Query
-- ============================================

-- Display all exam types to verify
SELECT 
  id,
  name_ar,
  name_en,
  display_order,
  is_active,
  jsonb_array_length(pathway) as pathway_steps,
  created_at
FROM public.exam_types
ORDER BY display_order;

-- <<< END MIGRATION: enhance_exam_types_security.sql


-- >>> BEGIN MIGRATION: phase1b_create_missing_tables.sql
-- Phase 1B: Create missing tables (pathways, queues)
-- Date: 2025-11-15
-- Purpose: Stabilization - add missing tables required by app

-- ============================================
-- 1. CREATE PATHWAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pathways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    pathway JSONB NOT NULL,
    current_step INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for pathways
CREATE INDEX IF NOT EXISTS idx_pathways_patient ON pathways(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathways_completed ON pathways(completed);

-- Enable RLS on pathways
ALTER TABLE pathways ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pathways
CREATE POLICY "Allow public read access on pathways" ON pathways
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert on pathways" ON pathways
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on pathways" ON pathways
    FOR UPDATE USING (true);

-- ============================================
-- 2. CREATE QUEUES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    display_number INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'skipped')),
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    called_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_pin TEXT,
    UNIQUE(clinic_id, patient_id, entered_at)
);

-- Create indexes for queues
CREATE INDEX IF NOT EXISTS idx_queues_clinic_status ON queues(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_patient ON queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_queues_entered_at ON queues(entered_at DESC);

-- Enable RLS on queues
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for queues
CREATE POLICY "Allow public read access on queues" ON queues
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert on queues" ON queues
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on queues" ON queues
    FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete on queues" ON queues
    FOR DELETE USING (true);

-- <<< END MIGRATION: phase1b_create_missing_tables.sql
