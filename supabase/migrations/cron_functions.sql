-- timezone
SET TIME ZONE 'Asia/Qatar';

-- توليد PIN يومي لجميع العيادات الفعالة
CREATE OR REPLACE FUNCTION generate_daily_pins(_for_date date DEFAULT (current_date))
RETURNS void LANGUAGE plpgsql VOLATILE AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM clinics WHERE is_active LOOP
    PERFORM ensure_daily_pin_for_clinic(r.id, _for_date);
  END LOOP;
END$$;

-- إعدادات الكيو (إن لم تكن موجودة)
CREATE TABLE IF NOT EXISTS settings (key text primary key, value jsonb);
INSERT INTO settings(key, value) VALUES
('queue', jsonb_build_object(
  'call_interval_minutes', 2,
  'near_turn_threshold', 3,
  'auto_skip_after_minutes', 3,
  'recall_cooldown_seconds', 30
))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION get_queue_config()
RETURNS TABLE(
  call_interval_minutes int,
  near_turn_threshold int,
  auto_skip_after_minutes int,
  recall_cooldown_seconds int
) LANGUAGE plpgsql STABLE AS $$
DECLARE p jsonb;
BEGIN
  SELECT value INTO p FROM settings WHERE key='queue';
  call_interval_minutes   := COALESCE((p->>'call_interval_minutes')::int, 2);
  near_turn_threshold     := COALESCE((p->>'near_turn_threshold')::int, 3);
  auto_skip_after_minutes := COALESCE((p->>'auto_skip_after_minutes')::int, 3);
  recall_cooldown_seconds := COALESCE((p->>'recall_cooldown_seconds')::int, 30);
  RETURN NEXT;
END$$;

-- Tick شامل: يعلّم NO_SHOW للتذاكر المتأخرة وينادي التالي في كل عيادة فعالة
CREATE OR REPLACE FUNCTION queue_call_engine_tick()
RETURNS void LANGUAGE plpgsql VOLATILE AS $$
DECLARE c record; auto_skip int;
BEGIN
  SELECT auto_skip_after_minutes INTO auto_skip FROM get_queue_config();

  -- NO_SHOW لمن لم يحضر بعد YOUR_TURN ضمن المهلة
  UPDATE queue_tickets
     SET status='NO_SHOW'
   WHERE status='CALLED'
     AND q_date = current_date
     AND called_at < now() - make_interval(mins => auto_skip);

  -- النداء للعيادات الفعّالة (تجاهُل الخطأ إذا لا يوجد منتظرون)
  FOR c IN SELECT id FROM clinics WHERE is_active LOOP
    BEGIN
      PERFORM call_next(c.id);
    EXCEPTION WHEN OTHERS THEN
      -- لا يوجد WAITING؛ تجاهُل
      NULL;
    END;
  END LOOP;
END$$;
