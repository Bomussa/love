# دليل النشر - تطبيق اللجنة الطبية

## 📋 المتطلبات الأساسية

### 1. حساب Supabase
- URL: `https://rujwuruuosffcxazymit.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10`

### 2. حساب Vercel
- الموقع الحالي: https://www.mmc-mms.com

---

## 🚀 خطوات النشر على Vercel

### الخطوة 1: إعداد قاعدة البيانات في Supabase

قم بتنفيذ SQL Schema التالي في Supabase SQL Editor:

```sql
-- إنشاء جدول المرضى
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  military_id VARCHAR(20) UNIQUE NOT NULL,
  gender VARCHAR(10) NOT NULL,
  exam_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء جدول العيادات
CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority INTEGER DEFAULT 2,
  capacity INTEGER DEFAULT 10,
  current_load INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء جدول الطوابير
CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  queue_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',
  entered_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء جدول المسارات
CREATE TABLE IF NOT EXISTS pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  exam_type VARCHAR(50) NOT NULL,
  clinic_sequence JSONB NOT NULL,
  current_step INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء جدول الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id),
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء جدول التقارير
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  exam_type VARCHAR(50) NOT NULL,
  results JSONB NOT NULL,
  final_decision VARCHAR(50),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_patients_military_id ON patients(military_id);
CREATE INDEX IF NOT EXISTS idx_queues_patient_id ON queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_queues_clinic_id ON queues(clinic_id);
CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status);
CREATE INDEX IF NOT EXISTS idx_pathways_patient_id ON pathways(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);

-- إدراج بيانات العيادات الأساسية
INSERT INTO clinics (name, name_ar, type, priority) VALUES
('Laboratory', 'المختبر', 'diagnostic', 1),
('Radiology', 'الأشعة', 'diagnostic', 1),
('Vital Measurements', 'القياسات الحيوية', 'diagnostic', 2),
('Ophthalmology', 'العيون', 'specialist', 2),
('Internal Medicine', 'الباطنية', 'specialist', 2),
('General Surgery', 'الجراحة العامة', 'specialist', 2),
('ENT', 'أنف وأذن وحنجرة', 'specialist', 2),
('Psychiatry', 'الطب النفسي', 'specialist', 2),
('Dentistry', 'الأسنان', 'specialist', 2),
('Dermatology', 'الجلدية', 'specialist', 3),
('ECG', 'تخطيط القلب', 'diagnostic', 3),
('Audiometry', 'السمعيات', 'diagnostic', 3),
('Orthopedics', 'العظام', 'specialist', 3)
ON CONFLICT DO NOTHING;
```

### الخطوة 2: إعداد Environment Variables في Vercel

في لوحة تحكم Vercel، أضف المتغيرات التالية:

```env
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10
```

### الخطوة 3: ربط المستودع بـ Vercel

1. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard)
2. اضغط على "Import Project"
3. اختر GitHub Repository: `Bomussa/love`
4. اختر مجلد `frontend` كـ Root Directory
5. أضف Environment Variables المذكورة أعلاه
6. اضغط على "Deploy"

### الخطوة 4: ربط Domain المخصص

1. في إعدادات المشروع، اذهب إلى "Domains"
2. أضف `www.mmc-mms.com`
3. اتبع التعليمات لتحديث DNS Records

---

## ✅ التحقق من التكامل

بعد النشر، تحقق من:

1. ✅ الاتصال بـ Supabase يعمل
2. ✅ تسجيل المرضى يحفظ في قاعدة البيانات
3. ✅ المسارات الديناميكية تعمل بناءً على حمل العيادات
4. ✅ نظام الدور يعمل بشكل صحيح
5. ✅ الإشعارات تظهر في الوقت الفعلي
6. ✅ التقارير والإحصائيات تعمل

---

## 🔧 استكشاف الأخطاء

### مشكلة: لا يتصل التطبيق بـ Supabase

**الحل:**
- تحقق من Environment Variables في Vercel
- تأكد من أن Supabase URL و Anon Key صحيحان
- تحقق من إعدادات CORS في Supabase

### مشكلة: البيانات لا تحفظ

**الحل:**
- تحقق من أن Schema تم تطبيقه بشكل صحيح
- تحقق من صلاحيات RLS (Row Level Security) في Supabase
- افتح Console في المتصفح وتحقق من الأخطاء

---

## 📞 الدعم

للمساعدة، راجع:
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- ملف `SUPABASE_SETUP_GUIDE.md` في المستودع
