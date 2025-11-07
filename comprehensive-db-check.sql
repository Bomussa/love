-- Comprehensive Database Check for MMC-MMS Queue System
-- This script verifies all critical components for 5 features

-- ============================================
-- 1. QUEUE SYSTEM CHECK
-- ============================================

-- Check queue table structure
SELECT 'Queue Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'queue'
ORDER BY ordinal_position;

-- Check queue indexes
SELECT 'Queue Indexes' as check_name;
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'queue';

-- Check queue data
SELECT 'Queue Data Summary' as check_name;
SELECT 
  clinic_id,
  status,
  COUNT(*) as count,
  MIN(entered_at) as first_entry,
  MAX(entered_at) as last_entry
FROM public.queue
GROUP BY clinic_id, status;

-- ============================================
-- 2. PIN CODE SYSTEM CHECK
-- ============================================

-- Check clinic_pins table
SELECT 'Clinic Pins Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clinic_pins'
ORDER BY ordinal_position;

-- Check active pins
SELECT 'Active Pins' as check_name;
SELECT clinic_id, pin_code, created_at, expires_at
FROM public.clinic_pins
WHERE expires_at > NOW()
ORDER BY clinic_id;

-- ============================================
-- 3. NOTIFICATIONS SYSTEM CHECK
-- ============================================

-- Check notifications table
SELECT 'Notifications Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Check recent notifications
SELECT 'Recent Notifications' as check_name;
SELECT clinic_id, patient_id, message, is_read, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 4. DYNAMIC PATHWAYS CHECK
-- ============================================

-- Check routes table
SELECT 'Routes Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'routes'
ORDER BY ordinal_position;

-- Check route_steps table
SELECT 'Route Steps Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'route_steps'
ORDER BY ordinal_position;

-- Check active routes
SELECT 'Active Routes' as check_name;
SELECT r.id, r.patient_id, r.gender, COUNT(rs.id) as steps_count
FROM public.routes r
LEFT JOIN public.route_steps rs ON r.id = rs.route_id
GROUP BY r.id, r.patient_id, r.gender
LIMIT 10;

-- ============================================
-- 5. REPORTS & STATISTICS CHECK
-- ============================================

-- Check reports table
SELECT 'Reports Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reports'
ORDER BY ordinal_position;

-- Check stats_daily table
SELECT 'Stats Daily Table Structure' as check_name;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stats_daily'
ORDER BY ordinal_position;

-- Check recent stats
SELECT 'Recent Daily Stats' as check_name;
SELECT day_key, clinic_id, total_patients, avg_wait_s
FROM public.stats_daily
ORDER BY day_key DESC
LIMIT 10;

-- ============================================
-- EDGE FUNCTIONS CHECK
-- ============================================

-- List all database functions
SELECT 'Database Functions' as check_name;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================
-- RLS POLICIES CHECK
-- ============================================

-- Check RLS status on critical tables
SELECT 'RLS Status' as check_name;
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('queue', 'clinic_pins', 'notifications', 'routes', 'reports')
ORDER BY tablename;

-- ============================================
-- PERFORMANCE CHECK
-- ============================================

-- Check table sizes
SELECT 'Table Sizes' as check_name;
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

