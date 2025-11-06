#!/bin/bash

echo "🔄 Checkpoint 3.2: نسخ الملفات المفقودة بأمان"
echo "======================================================================"

BACKUP_DIR="manus-testing/cloudflare-backup/functions/api/v1"
TARGET_DIR="api/v1"
ARCHIVE_DIR="api/_archived_before_copy"

# إنشاء مجلد الأرشيف
mkdir -p "$ARCHIVE_DIR"

# قراءة قائمة الملفات المفقودة من التقرير
MISSING_FILES=(
  "admin/clinic-stats.js"
  "admin/edit-patient.js"
  "admin/export-report.js"
  "admin/live-feed.js"
  "admin/regenerate-pins.js"
  "admin/set-call-interval.js"
  "admin/system-settings.js"
  "admin/system-settings/reset.js"
  "cron/auto-call-next.js"
  "cron/daily-report.js"
  "cron/daily-reset.js"
  "cron/notify-poller.js"
  "cron/timeout-handler.js"
  "health/status.js"
  "notify/status.js"
  "patient/my-position.js"
  "patient/record.js"
  "patient/status.js"
  "patient/verify-pin.js"
  "pin/assign.js"
  "pin/reset.js"
  "queue/enter-updated.js"
  "queue/position.js"
)

echo ""
echo "📋 سيتم نسخ ${#MISSING_FILES[@]} ملف"
echo ""

copied=0
skipped=0
errors=0

for file in "${MISSING_FILES[@]}"; do
  source_file="$BACKUP_DIR/$file"
  target_file="$TARGET_DIR/$file"
  
  # التحقق من وجود الملف المصدر
  if [ ! -f "$source_file" ]; then
    echo "❌ ملف مصدر غير موجود: $file"
    ((errors++))
    continue
  fi
  
  # التحقق من عدم وجود الملف الهدف
  if [ -f "$target_file" ]; then
    echo "⚠️  تخطي (موجود بالفعل): $file"
    ((skipped++))
    continue
  fi
  
  # إنشاء المجلد الهدف
  target_dir=$(dirname "$target_file")
  mkdir -p "$target_dir"
  
  # نسخ الملف
  cp "$source_file" "$target_file"
  
  if [ $? -eq 0 ]; then
    echo "✅ تم نسخ: $file"
    ((copied++))
  else
    echo "❌ فشل نسخ: $file"
    ((errors++))
  fi
done

echo ""
echo "======================================================================"
echo "📊 ملخص العملية:"
echo "   ✅ تم النسخ: $copied"
echo "   ⚠️  تم التخطي: $skipped"
echo "   ❌ أخطاء: $errors"
echo "======================================================================"

# حفظ سجل العملية
cat > "$ARCHIVE_DIR/copy-log.txt" << LOGEOF
تاريخ: $(date)
الملفات المنسوخة: $copied
الملفات المتخطاة: $skipped
الأخطاء: $errors

قائمة الملفات المنسوخة:
$(for file in "${MISSING_FILES[@]}"; do
  if [ -f "$TARGET_DIR/$file" ]; then
    echo "  - $file"
  fi
done)
LOGEOF

echo ""
echo "✅ سجل العملية محفوظ في: $ARCHIVE_DIR/copy-log.txt"

exit 0
