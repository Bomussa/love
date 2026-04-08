-- =====================================================
-- نظام التنظيف التلقائي اليومي مع حفظ الإحصائيات
-- =====================================================

-- 1. جدول الإحصائيات اليومية المحفوظة
CREATE TABLE IF NOT EXISTS daily_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE NOT NULL UNIQUE,
  total_patients INT DEFAULT 0,
  completed_visits INT DEFAULT 0,
  cancelled_visits INT DEFAULT 0,
  waiting_visits INT DEFAULT 0,
  avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
  clinic_stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON daily_statistics(stat_date DESC);

-- 3. دالة حفظ إحصائيات اليوم قبل التنظيف
CREATE OR REPLACE FUNCTION save_daily_statistics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS VOID AS $$
DECLARE
  stats_record RECORD;
  clinic_data JSONB;
BEGIN
  -- حساب الإحصائيات من unified_queue
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status IN ('cancelled', 'skipped')) as cancelled,
    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
    COALESCE(AVG(EXTRACT(EPOCH FROM (called_at - entered_at))/60) FILTER (WHERE called_at IS NOT NULL), 0) as avg_wait
  INTO stats_record
  FROM unified_queue
  WHERE queue_date = target_date;

  -- حساب إحصائيات كل عيادة
  SELECT jsonb_object_agg(
    clinic_id,
    jsonb_build_object(
      'total', clinic_total,
      'completed', clinic_completed,
      'waiting', clinic_waiting
    )
  )
  INTO clinic_data
  FROM (
    SELECT 
      clinic_id,
      COUNT(*) as clinic_total,
      COUNT(*) FILTER (WHERE status = 'completed') as clinic_completed,
      COUNT(*) FILTER (WHERE status = 'waiting') as clinic_waiting
    FROM unified_queue
    WHERE queue_date = target_date
    GROUP BY clinic_id
  ) clinic_stats;

  -- إدراج أو تحديث الإحصائيات
  INSERT INTO daily_statistics (
    stat_date, total_patients, completed_visits, cancelled_visits, 
    waiting_visits, avg_wait_time_minutes, clinic_stats
  )
  VALUES (
    target_date,
    COALESCE(stats_record.total, 0),
    COALESCE(stats_record.completed, 0),
    COALESCE(stats_record.cancelled, 0),
    COALESCE(stats_record.waiting, 0),
    COALESCE(stats_record.avg_wait, 0),
    COALESCE(clinic_data, '{}'::jsonb)
  )
  ON CONFLICT (stat_date) DO UPDATE SET
    total_patients = EXCLUDED.total_patients,
    completed_visits = EXCLUDED.completed_visits,
    cancelled_visits = EXCLUDED.cancelled_visits,
    waiting_visits = EXCLUDED.waiting_visits,
    avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
    clinic_stats = EXCLUDED.clinic_stats;
END;
$$ LANGUAGE plpgsql;

-- 4. دالة التنظيف اليومي
CREATE OR REPLACE FUNCTION daily_queue_cleanup()
RETURNS VOID AS $$
BEGIN
  -- حفظ إحصائيات الأمس قبل الحذف
  PERFORM save_daily_statistics(CURRENT_DATE - INTERVAL '1 day');
  
  -- حذف سجلات الطابور القديمة (أكثر من يوم)
  DELETE FROM unified_queue 
  WHERE queue_date < CURRENT_DATE;
  
  -- إعادة تعيين display_number لليوم الجديد
  -- (يبدأ من 1 لكل عيادة)
END;
$$ LANGUAGE plpgsql;

-- 5. دالة الحصول على الإحصائيات حسب الفترة
CREATE OR REPLACE FUNCTION get_statistics_by_period(period_type TEXT)
RETURNS TABLE (
  period_start DATE,
  period_end DATE,
  total_patients BIGINT,
  completed_visits BIGINT,
  cancelled_visits BIGINT,
  avg_wait_time DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE period_type
      WHEN 'daily' THEN stat_date
      WHEN 'weekly' THEN date_trunc('week', stat_date)::DATE
      WHEN 'monthly' THEN date_trunc('month', stat_date)::DATE
      WHEN 'semi_annual' THEN 
        CASE WHEN EXTRACT(MONTH FROM stat_date) <= 6 
          THEN date_trunc('year', stat_date)::DATE
          ELSE (date_trunc('year', stat_date) + INTERVAL '6 months')::DATE
        END
      WHEN 'yearly' THEN date_trunc('year', stat_date)::DATE
      ELSE stat_date
    END as period_start,
    CASE period_type
      WHEN 'daily' THEN stat_date
      WHEN 'weekly' THEN (date_trunc('week', stat_date) + INTERVAL '6 days')::DATE
      WHEN 'monthly' THEN (date_trunc('month', stat_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
      WHEN 'semi_annual' THEN 
        CASE WHEN EXTRACT(MONTH FROM stat_date) <= 6 
          THEN (date_trunc('year', stat_date) + INTERVAL '6 months' - INTERVAL '1 day')::DATE
          ELSE (date_trunc('year', stat_date) + INTERVAL '1 year' - INTERVAL '1 day')::DATE
        END
      WHEN 'yearly' THEN (date_trunc('year', stat_date) + INTERVAL '1 year' - INTERVAL '1 day')::DATE
      ELSE stat_date
    END as period_end,
    SUM(ds.total_patients)::BIGINT,
    SUM(ds.completed_visits)::BIGINT,
    SUM(ds.cancelled_visits)::BIGINT,
    AVG(ds.avg_wait_time_minutes)
  FROM daily_statistics ds
  GROUP BY 
    CASE period_type
      WHEN 'daily' THEN stat_date
      WHEN 'weekly' THEN date_trunc('week', stat_date)::DATE
      WHEN 'monthly' THEN date_trunc('month', stat_date)::DATE
      WHEN 'semi_annual' THEN 
        CASE WHEN EXTRACT(MONTH FROM stat_date) <= 6 
          THEN date_trunc('year', stat_date)::DATE
          ELSE (date_trunc('year', stat_date) + INTERVAL '6 months')::DATE
        END
      WHEN 'yearly' THEN date_trunc('year', stat_date)::DATE
      ELSE stat_date
    END
  ORDER BY period_start DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. إنشاء Cron Job للتنظيف التلقائي (يعمل كل يوم الساعة 00:05)
-- ملاحظة: يتطلب تفعيل pg_cron extension في Supabase
-- SELECT cron.schedule('daily-queue-cleanup', '5 0 * * *', 'SELECT daily_queue_cleanup()');
