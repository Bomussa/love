#!/bin/bash
echo "🧪 اختبار بنية المشروع..."
echo ""
FILES=("README.md" "package.json" "vercel.json" ".env.local" ".env.production" "docs/ARCHITECTURE.md" "docs/API.md" "docs/DATABASE.md" "docs/DEPLOYMENT.md" "docs/MAINTENANCE.md" "config/vercel-environment-variables.md" "config/vercel-build-settings.md" "config/supabase-tables-list.md")
MISSING=0
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file - MISSING"
    MISSING=$((MISSING+1))
  fi
done
echo ""
echo "📊 النتيجة: $((${#FILES[@]} - MISSING))/${#FILES[@]} ملف موجود"
if [ $MISSING -eq 0 ]; then
  echo "✅ جميع الملفات الأساسية موجودة!"
else
  echo "⚠️ $MISSING ملف مفقود"
fi
