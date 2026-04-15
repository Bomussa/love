# خطة الأمان والميزات
## Security & Features Plan for Supabase Migration

**التاريخ**: 2025-10-24  
**المشروع**: love (Medical Queue Management System)  
**الهدف**: تأمين قاعدة البيانات وتفعيل الميزات المتقدمة

---

## 1. Row Level Security (RLS)

### 1.1 المبدأ الأساسي

تطبيق **Row Level Security** على جميع الجداول لضمان أن كل مستخدم يرى فقط البيانات المسموح له بالوصول إليها.

### 1.2 سياسات RLS المقترحة

#### جدول `users`

```sql
-- السماح للمستخدمين بمشاهدة بياناتهم الخاصة
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- السماح للمسؤولين بمشاهدة جميع المستخدمين
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح للمسؤولين بتعديل المستخدمين
CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### جدول `queue`

```sql
-- السماح للمرضى بمشاهدة حالتهم في الطابور
CREATE POLICY "Patients can view their own queue status" ON queue
  FOR SELECT USING (patient_id = auth.uid()::text);

-- السماح للمسؤولين بإدارة الطابور بالكامل
CREATE POLICY "Admins can manage queue" ON queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح بالقراءة العامة للطوابير النشطة (للشاشات العامة)
CREATE POLICY "Public can view active queues" ON queue
  FOR SELECT USING (status IN ('waiting', 'called'));
```

#### جدول `notifications`

```sql
-- السماح للمرضى بمشاهدة إشعاراتهم
CREATE POLICY "Patients can view their notifications" ON notifications
  FOR SELECT USING (patient_id = auth.uid()::text);

-- السماح للمرضى بتحديث حالة القراءة
CREATE POLICY "Patients can mark as read" ON notifications
  FOR UPDATE USING (patient_id = auth.uid()::text)
  WITH CHECK (patient_id = auth.uid()::text);

-- السماح للمسؤولين بإدارة جميع الإشعارات
CREATE POLICY "Admins can manage all notifications" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### جدول `clinics`

```sql
-- السماح بالقراءة العامة للعيادات النشطة
CREATE POLICY "Public can view active clinics" ON clinics
  FOR SELECT USING (is_active = true);

-- السماح للمسؤولين فقط بالتعديل
CREATE POLICY "Admins can manage clinics" ON clinics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### جدول `routes`

```sql
-- السماح بالقراءة العامة للمسارات النشطة
CREATE POLICY "Public can view active routes" ON routes
  FOR SELECT USING (is_active = true);

-- السماح للمسؤولين فقط بالتعديل
CREATE POLICY "Admins can manage routes" ON routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### جدول `reports`

```sql
-- السماح للمسؤولين فقط بمشاهدة التقارير
CREATE POLICY "Admins can view reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### جدول `settings`

```sql
-- السماح بالقراءة العامة للإعدادات العامة فقط
CREATE POLICY "Public can view public settings" ON settings
  FOR SELECT USING (is_public = true);

-- السماح للمسؤولين بمشاهدة جميع الإعدادات
CREATE POLICY "Admins can view all settings" ON settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح للمسؤولين بتعديل الإعدادات
CREATE POLICY "Admins can update settings" ON settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 2. Supabase Realtime

### 2.1 الهدف

استخدام **Supabase Realtime** لتحديثات الطوابير الفورية بدلاً من polling.

### 2.2 التطبيق

#### تفعيل Realtime على جدول `queue`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE queue;
```

#### في الكود (Frontend)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// الاشتراك في تحديثات الطابور
const subscription = supabase
  .channel('queue-changes')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'queue',
      filter: `clinic_id=eq.${clinicId}`
    },
    (payload) => {
      console.log('Queue updated:', payload);
      // تحديث الواجهة فوراً
      updateQueueUI(payload.new);
    }
  )
  .subscribe();

// إلغاء الاشتراك عند الخروج
// subscription.unsubscribe();
```

### 2.3 الفوائد

- **تحديثات فورية** بدون الحاجة لـ polling كل 5 ثوان
- **تقليل الحمل** على السيرفر (من 12 طلب/دقيقة إلى 0)
- **تجربة مستخدم أفضل** (تحديثات لحظية)

---

## 3. آلية الإشعارات

### 3.1 Database Triggers

إنشاء **Trigger** لتوليد إشعار تلقائي عند تغيير حالة المريض في الطابور.

```sql
CREATE OR REPLACE FUNCTION notify_patient_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- عند استدعاء المريض
  IF NEW.status = 'called' AND OLD.status != 'called' THEN
    INSERT INTO notifications (patient_id, clinic_id, type, title, message)
    VALUES (
      NEW.patient_id,
      NEW.clinic_id,
      'call',
      'حان دورك',
      'يرجى التوجه إلى ' || (SELECT name_ar FROM clinics WHERE id = NEW.clinic_id)
    );
  END IF;

  -- عند اكتمال الفحص
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO notifications (patient_id, clinic_id, type, title, message)
    VALUES (
      NEW.patient_id,
      NEW.clinic_id,
      'info',
      'اكتمل الفحص',
      'تم إكمال الفحص في ' || (SELECT name_ar FROM clinics WHERE id = NEW.clinic_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_status_change_notification
  AFTER UPDATE ON queue
  FOR EACH ROW
  EXECUTE FUNCTION notify_patient_on_status_change();
```

### 3.2 Realtime Notifications

```javascript
// الاشتراك في الإشعارات الجديدة
const notificationsSub = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `patient_id=eq.${patientId}`
    },
    (payload) => {
      // عرض الإشعار فوراً
      showNotification(payload.new);
      playNotificationSound();
    }
  )
  .subscribe();
```

---

## 4. حفظ مؤقت (Caching) منطقي

### 4.1 الاستراتيجية

استخدام **PostgreSQL Materialized Views** للبيانات التي لا تتغير كثيراً.

```sql
-- Materialized View للإحصائيات اليومية
CREATE MATERIALIZED VIEW daily_stats AS
SELECT
  clinic_id,
  DATE(entered_at) as date,
  COUNT(*) as total_patients,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  AVG(EXTRACT(EPOCH FROM (completed_at - entered_at))) as avg_wait_time
FROM queue
WHERE entered_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY clinic_id, DATE(entered_at);

CREATE UNIQUE INDEX ON daily_stats (clinic_id, date);

-- تحديث تلقائي كل ساعة
CREATE OR REPLACE FUNCTION refresh_daily_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 فهرسة الحقول الحرجة

جميع الفهارس موجودة في `schema-plan.sql`:

- `idx_queue_patient_id` - للبحث السريع عن مريض
- `idx_queue_clinic_id` - لعرض طابور عيادة معينة
- `idx_queue_status` - لفلترة حسب الحالة
- `idx_queue_entered_at` - للترتيب الزمني
- `idx_queue_position` - للترتيب حسب الموقع

---

## 5. Point-in-Time Recovery (PITR) والنسخ الاحتياطي

### 5.1 تفعيل PITR في Supabase

في **Supabase Dashboard**:
1. Project Settings → Database
2. Enable Point-in-Time Recovery
3. اختيار مدة الاحتفاظ (7 أيام مجاناً، 30 يوم في الخطة المدفوعة)

### 5.2 النسخ الاحتياطي اليومي

```sql
-- سكريبت للنسخ الاحتياطي (يُنفذ خارج Supabase)
pg_dump -h db.rujwuruuosffcxazymit.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_$(date +%Y%m%d).dump
```

### 5.3 استعادة البيانات

```sql
-- استعادة من نسخة احتياطية
pg_restore -h db.rujwuruuosffcxazymit.supabase.co \
  -U postgres \
  -d postgres \
  -c \
  backup_20251024.dump
```

---

## 6. مراقبة الأداء

### 6.1 تفعيل pg_stat_statements

```sql
-- تفعيل extension للمراقبة
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- عرض أبطأ الاستعلامات
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 6.2 Connection Pooling

استخدام **Supabase Connection Pooler** لتحسين الأداء:

```javascript
// استخدام pooler URL بدلاً من direct URL
const SUPABASE_POOLER_URL = 'postgresql://postgres.rujwuruuosffcxazymit:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
```

---

## 7. الأمان الإضافي

### 7.1 تشفير البيانات الحساسة

```sql
-- تشفير كلمات المرور باستخدام pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- دالة لتشفير كلمة المرور
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql;

-- دالة للتحقق من كلمة المرور
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql;
```

### 7.2 Rate Limiting

في **Supabase Dashboard**:
- Project Settings → API
- تفعيل Rate Limiting
- تحديد: 100 طلب/دقيقة للمستخدم الواحد

### 7.3 IP Whitelisting (اختياري)

للحماية الإضافية، يمكن تحديد IP addresses المسموح لها بالوصول.

---

## 8. خطة التنفيذ

| الخطوة | الوصف | الأولوية |
|--------|-------|---------|
| 1 | تفعيل RLS على جميع الجداول | **حرجة** |
| 2 | إنشاء سياسات RLS الأساسية | **عالية** |
| 3 | تفعيل Realtime على queue | **عالية** |
| 4 | إنشاء Triggers للإشعارات | **متوسطة** |
| 5 | تفعيل PITR | **متوسطة** |
| 6 | إعداد Connection Pooling | **منخفضة** |
| 7 | إنشاء Materialized Views | **منخفضة** |

---

## 9. التوصيات النهائية

1. **اختبار RLS بدقة** قبل النشر للإنتاج
2. **مراقبة الأداء** بعد التفعيل باستخدام pg_stat_statements
3. **النسخ الاحتياطي اليومي** تلقائياً
4. **مراجعة السياسات** بشكل دوري
5. **تحديث Supabase** إلى أحدث إصدار

---

**تم إعداده بواسطة**: Manus AI  
**التاريخ**: 2025-10-24  
**الحالة**: جاهز للتنفيذ بعد الموافقة

