-- ============================================================================
-- Doctor Sessions View - Single Source of Truth
-- Purpose: Real-time aggregated doctor session data from queues table only
-- ============================================================================

-- Drop existing view if exists
DROP VIEW IF EXISTS doctor_sessions_view;

-- Create the view
CREATE OR REPLACE VIEW doctor_sessions_view AS
SELECT
  q.clinic_id,
  c.name_ar as clinic_name,
  c.name_en as clinic_name_en,
  
  -- Counters (real-time from queues)
  COUNT(*) FILTER (WHERE q.status = 'waiting') AS waiting_count,
  COUNT(*) FILTER (WHERE q.status IN ('called', 'in_progress', 'serving')) AS active_count,
  COUNT(*) FILTER (WHERE q.status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE q.status = 'no_show') AS missed_count,
  
  -- Action counts
  COUNT(*) FILTER (WHERE q.called_at IS NOT NULL) AS calls_made,
  COUNT(*) FILTER (WHERE q.entered_clinic_at IS NOT NULL) AS starts_made,
  COUNT(*) FILTER (WHERE q.completed_at IS NOT NULL) AS advances_made,
  
  -- Session timing
  MIN(q.called_at) AS session_start,
  MAX(q.completed_at) AS session_end,
  
  -- Live duration calculation
  EXTRACT(EPOCH FROM (COALESCE(MAX(q.completed_at), NOW()) - MIN(q.called_at))) / 60 AS session_duration_minutes,
  
  -- Session status
  CASE
    WHEN COUNT(*) FILTER (WHERE q.status IN ('called', 'in_progress', 'serving')) > 0 THEN 'active'
    WHEN COUNT(*) FILTER (WHERE q.status = 'waiting') > 0 THEN 'waiting'
    ELSE 'idle'
  END AS session_status,
  
  -- Last action timestamp
  MAX(COALESCE(q.completed_at, q.entered_clinic_at, q.called_at, q.created_at)) AS last_action,
  
  -- Date filter
  q.queue_date

FROM queues q
LEFT JOIN clinics c ON c.id = q.clinic_id
WHERE q.queue_date = CURRENT_DATE
GROUP BY q.clinic_id, c.name_ar, c.name_en, q.queue_date;

-- Grant access
GRANT SELECT ON doctor_sessions_view TO anon, authenticated;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- SELECT * FROM doctor_sessions_view ORDER BY waiting_count DESC;
