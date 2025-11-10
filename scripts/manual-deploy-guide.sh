#!/bin/bash
# دليل النشر اليدوي - تنفيذ من جهازك المحلي أو بيئة لها صلاحيات

echo "================================================"
echo "دليل النشر اليدوي لـFunctions على Supabase"
echo "================================================"
echo ""
echo "⚠️  هذا السكربت للتوثيق فقط - نفّذ الأوامر يدويًا"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 1: التسجيل والربط
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 1: التسجيل"
echo "supabase login"
echo ""
echo "   سيفتح متصفح للمصادقة - سجل دخول بحساب Supabase"
echo ""

echo "📌 الخطوة 2: الربط بالمشروع"
echo "supabase link --project-ref rujwuruuosffcxazymit"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 2: تطبيق Migration (SQL)
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 3: تطبيق Migration للـPINs والـViews"
echo ""
echo "الطريقة الأسهل: نسخ محتوى الملف التالي وتشغيله في SQL Editor:"
echo "   supabase/migrations/002_add_pins_and_reports.sql"
echo ""
echo "أو عبر CLI:"
echo "supabase db push"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 3: نشر Functions واحدة تلو الأخرى
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 4: نشر Functions (8 وظائف)"
echo ""

FUNCTIONS=(
    "queue-enter"
    "queue-status"
    "queue-call"
    "pin-generate"
    "pin-verify"
    "pin-status"
    "reports-daily"
    "stats-dashboard"
)

for FUNC in "${FUNCTIONS[@]}"; do
    echo "supabase functions deploy $FUNC --no-verify-jwt"
done

echo ""
echo "ملاحظة: --no-verify-jwt للاختبار فقط، أزله في الإنتاج"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 4: ضبط Secrets
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 5: ضبط Secrets في لوحة Supabase"
echo ""
echo "اذهب إلى: Settings → Edge Functions → Secrets"
echo ""
echo "أضف:"
echo "  SUPABASE_URL = https://rujwuruuosffcxazymit.supabase.co"
echo "  SUPABASE_SERVICE_ROLE_KEY = <your-service-role-key>"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 5: تفعيل Realtime
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 6: تفعيل Realtime"
echo ""
echo "في لوحة Supabase: Database → Replication"
echo "فعّل الجداول التالية في Publication: supabase_realtime"
echo "  - queues"
echo "  - notifications"
echo "  - pins"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 6: التحقق
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 7: التحقق"
echo ""
echo "اعرض Functions المنشورة:"
echo "supabase functions list"
echo ""
echo "اختبر مباشرة:"
echo "curl https://rujwuruuosffcxazymit.functions.supabase.co/queue-status?clinic_id=lab"
echo ""

# ═══════════════════════════════════════════════════════════════
# الخطوة 7: اختبار من الدومين النهائي
# ═══════════════════════════════════════════════════════════════
echo "📌 الخطوة 8: اختبار عبر الدومين النهائي (بعد rewrite)"
echo ""
echo "curl https://mmc-mms.com/api/queue-status?clinic_id=lab"
echo ""
echo "إذا نجح → ✅ التكامل كامل!"
echo ""

echo "================================================"
echo "✨ انتهى الدليل"
echo "================================================"
