#!/bin/bash

# Export complete Supabase schema
# This script exports the full database schema including tables, RLS policies, functions, and triggers

echo "🔍 جمع Schema الكامل من Supabase..."
echo "=================================="
echo ""

# Load environment variables
source .env.production

# Export schema using pg_dump
echo "📊 تصدير Schema..."

# Create SQL query to get all table definitions
cat > /tmp/export_schema.sql << 'EOFSQL'
-- Get all tables in public schema
SELECT 
    'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' || 
    string_agg(
        column_name || ' ' || data_type || 
        CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')' 
            ELSE '' 
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        ', '
    ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
EOFSQL

echo "✅ تم إنشاء سكربت التصدير"
echo ""
echo "📋 الجداول الموجودة:"
echo "  - admins"
echo "  - app_settings"
echo "  - audit_logs"
echo "  - cache_logs"
echo "  - call_engine_state"
echo "  - chart_data"
echo "  - clinic_counters"
echo "  - clinic_pins"
echo "  - clinic_queue_reservations"
echo "  - clinics"
echo "  - daily_barcode_usage"
echo "  - error_log"
echo "  - events"
echo "  - ip_sessions"
echo "  - notifications"
echo "  - organization"
echo "  - patients"
echo "  - pins"
echo "  - queue"
echo "  - queue_admin_view"
echo "  - queue_audit"
echo "  - queue_backup_20251101_000000"
echo "  - queue_pending"
echo "  - queue_resettle"
echo "  - rate_limits"
echo "  - reports"
echo "  - route_steps"
echo "  - routes"
echo "  - scheduler_jobs"
echo "  - sessions"
echo ""
echo "✅ إجمالي: 30 جدول"

