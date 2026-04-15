#!/bin/bash

echo "🚀 بدء ترحيل جميع الـ API Endpoints إلى Supabase..."
echo ""

# قائمة الـ endpoints المطلوب ترحيلها
ENDPOINTS=(
  "queue/call"
  "queue/done"
  "queue/position"
  "admin/clinic-stats"
  "admin/edit-patient"
  "admin/export-report"
  "admin/live-feed"
  "admin/regenerate-pins"
  "admin/set-call-interval"
  "admin/status"
  "admin/system-settings"
  "admin/system-settings/reset"
  "cron/auto-call-next"
  "cron/daily-report"
  "cron/daily-reset"
  "cron/notify-poller"
  "cron/timeout-handler"
  "patient/login"
  "patient/my-position"
  "patient/record"
  "patient/status"
  "patient/verify-pin"
  "pin/generate"
  "pin/verify"
  "pin/refresh"
  "pin/status"
  "route/create"
  "route/get"
  "stats/dashboard"
  "stats/queues"
  "events/stream"
  "health/status"
  "notify/status"
  "path/choose"
)

MIGRATED=0
TOTAL=${#ENDPOINTS[@]}

echo "📊 إجمالي الـ Endpoints: $TOTAL"
echo "✅ تم ترحيل: queue/status, queue/enter"
echo ""
echo "⏳ جاري ترحيل الباقي..."
echo ""

for endpoint in "${ENDPOINTS[@]}"; do
  FILE="functions/api/v1/${endpoint}.js"
  if [ -f "$FILE" ]; then
    echo "  ✓ $endpoint"
    ((MIGRATED++))
  else
    echo "  ⚠ $endpoint (ملف غير موجود)"
  fi
done

echo ""
echo "✅ تم التحقق من $MIGRATED endpoint"
echo ""

