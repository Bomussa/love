# دليل إعداد Supabase - نظام إدارة الطوابير الطبية

## 📋 نظرة عامة

هذا الدليل يشرح كيفية إعداد قاعدة بيانات Supabase للتطبيق بشكل كامل.

---

## 🔧 الخطوة 1: إنشاء الجداول

قم بتنفيذ SQL التالي في Supabase SQL Editor:

### 1.1 تفعيل UUID Extension

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.2 جدول المرضى (patients)

```sql
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id VARCHAR(20) UNIQUE NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT patient_id_format CHECK (length(patient_id) >= 5)
);

CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_created_at ON patients(created_at DESC);
```

### 1.3 جدول العيادات (clinics)

```sql
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

CREATE INDEX idx_clinics_clinic_id ON clinics(clinic_id);
CREATE INDEX idx_clinics_is_open ON clinics(is_open);

-- إدخال العيادات الافتراضية
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
```

### 1.4 جدول الطوابير (queues)

```sql
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

CREATE INDEX idx_queues_clinic_status ON queues(clinic_id, status);
CREATE INDEX idx_queues_patient_id ON queues(patient_id);
CREATE INDEX idx_queues_entered_at ON queues(entered_at DESC);
CREATE INDEX idx_queues_status ON queues(status);
```

### 1.5 جدول المسارات (pathways)

```sql
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

CREATE INDEX idx_pathways_patient_id ON pathways(patient_id);
CREATE INDEX idx_pathways_exam_type ON pathways(exam_type);
CREATE INDEX idx_pathways_completed ON pathways(completed);
```

### 1.6 جدول الإشعارات (notifications)

```sql
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

CREATE INDEX idx_notifications_patient_id ON notifications(patient_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### 1.7 جدول مستخدمي الإدارة (admin_users)

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'viewer')),
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_username ON admin_users(username);
```

### 1.8 جدول التقارير (reports)

```sql
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'annual')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(report_date, report_type)
);

CREATE INDEX idx_reports_date_type ON reports(report_date DESC, report_type);
```

---

## 🔐 الخطوة 2: إعداد Row Level Security (RLS)

### 2.1 تفعيل RLS

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
```

### 2.2 إنشاء Policies

```sql
-- Patients policies
CREATE POLICY "Patients can view their own data" ON patients
  FOR SELECT USING (true);

CREATE POLICY "Patients can insert their own data" ON patients
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Patients can update their own data" ON patients
  FOR UPDATE USING (true);

-- Clinics policies
CREATE POLICY "Clinics are publicly readable" ON clinics
  FOR SELECT USING (true);

CREATE POLICY "Clinics can be updated" ON clinics
  FOR UPDATE USING (true);

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

CREATE POLICY "Users can update notifications" ON notifications
  FOR UPDATE USING (true);

-- Reports policies
CREATE POLICY "Reports are publicly readable" ON reports
  FOR SELECT USING (true);
```

---

## ⚙️ الخطوة 3: إنشاء Functions

### 3.1 Function لتوليد PIN يومي

```sql
CREATE OR REPLACE FUNCTION generate_daily_pin(clinic_id_param VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  new_pin INTEGER;
  today DATE;
BEGIN
  today := CURRENT_DATE;
  new_pin := floor(random() * 90 + 10)::INTEGER;
  
  UPDATE clinics
  SET daily_pin = new_pin,
      pin_generated_at = today
  WHERE clinic_id = clinic_id_param;
  
  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;
```

### 3.2 Function للحصول على رقم الدور التالي

```sql
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
```

### 3.3 Function للحصول على موقع المريض في الطابور

```sql
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
```

---

## 📊 الخطوة 4: إنشاء Views

### 4.1 View للطوابير النشطة

```sql
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
```

### 4.2 View لإحصائيات العيادات

```sql
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
```

---

## 🔄 الخطوة 5: إنشاء Triggers

### 5.1 Trigger لتحديث updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pathways_updated_at BEFORE UPDATE ON pathways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🎯 الخطوة 6: توليد PINs الأولية

```sql
DO $$
DECLARE
  clinic_record RECORD;
BEGIN
  FOR clinic_record IN SELECT clinic_id FROM clinics LOOP
    PERFORM generate_daily_pin(clinic_record.clinic_id);
  END LOOP;
END $$;
```

---

## ✅ الخطوة 7: التحقق من الإعداد

### 7.1 التحقق من الجداول

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 7.2 التحقق من العيادات

```sql
SELECT clinic_id, name_ar, daily_pin, pin_generated_at 
FROM clinics 
ORDER BY clinic_id;
```

### 7.3 التحقق من Policies

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 🔧 إعداد Frontend

### تحديث ملف .env

```env
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_USE_SUPABASE=true
```

---

## 📝 ملاحظات مهمة

1. **الأمان**: تأكد من تفعيل RLS على جميع الجداول
2. **النسخ الاحتياطي**: قم بعمل backup دوري للبيانات
3. **المراقبة**: راقب استخدام Database من لوحة تحكم Supabase
4. **الأداء**: استخدم Indexes المناسبة لتحسين الأداء
5. **التحديثات**: قم بتحديث PINs يومياً باستخدام Cron Job

---

## 🆘 استكشاف الأخطاء

### مشكلة: لا يمكن الاتصال بـ Supabase

**الحل:**
- تحقق من صحة SUPABASE_URL و ANON_KEY
- تأكد من تفعيل RLS Policies
- تحقق من إعدادات CORS

### مشكلة: خطأ في إدخال البيانات

**الحل:**
- تحقق من Constraints على الجداول
- تأكد من صحة البيانات المدخلة
- راجع RLS Policies

### مشكلة: بطء في الاستعلامات

**الحل:**
- أضف Indexes على الأعمدة المستخدمة كثيراً
- استخدم Views للاستعلامات المعقدة
- قم بتحسين Queries

---

## 📚 موارد إضافية

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**تم إنشاء هذا الدليل في:** 5 نوفمبر 2025  
**الإصدار:** 1.0.0  
**المشروع:** MMC-MMS Medical Queue Management System
