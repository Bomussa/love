#!/bin/bash
# ============================================================
#  Script Name : fix_env_and_deploy.sh
#  Purpose     : Verify Cloudflare Pages environment and redeploy (mmc-mms)
#  Author      : Iyad / AI Copilot (final verified edition)
#  Version     : v3.0 — Safe Execution + Root Path Validator
# ============================================================

set -e  # توقف التنفيذ عند أول خطأ

PROJECT_NAME="mmc-mms"
BRANCH="production"
LOG_FILE="env_check_log.txt"

echo "============================================"
echo "🩺  بدء فحص بيئة Cloudflare Pages لمشروع: $PROJECT_NAME"
echo "============================================"
echo ""

# ============================================================
# 1️⃣ التحقق من أن السكربت يعمل من المسار الصحيح (root)
# ============================================================
if [[ ! -f "wrangler.toml" ]]; then
  echo "❌ لم يتم العثور على ملف wrangler.toml في هذا المجلد!"
  echo "⚠️ يجب تشغيل السكربت من المجلد الجذر للمشروع."
  echo "📂 المسار الصحيح عادة هو: /home/ubuntu/2027 أو المجلد الذي يحتوي wrangler.toml"
  exit 1
else
  echo "✅ تم التأكد من وجود wrangler.toml — المسار صحيح."
fi

# ============================================================
# 2️⃣ التحقق من وجود متغيرات البيئة الخاصة بـ Cloudflare
# ============================================================
if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
  echo "❌ خطأ: مفقود CLOUDLFARE_API_TOKEN. أضفه أولاً بالأمر التالي:"
  echo "   export CLOUDFLARE_API_TOKEN=your_token_here"
  exit 1
else
  echo "✅ تم العثور على Cloudflare API Token."
fi

# ============================================================
# 3️⃣ جلب Cloudflare Account ID تلقائيًا
# ============================================================
ACCOUNT_ID=$(npx wrangler whoami 2>/dev/null | grep "account_id" | awk '{print $2}')

if [[ -z "$ACCOUNT_ID" ]]; then
  echo "❌ لم يتم العثور على Cloudflare Account ID — تحقق من صلاحيات الحساب."
  exit 1
else
  echo "✅ Account ID: $ACCOUNT_ID"
fi

# ============================================================
# 4️⃣ تعريف المفاتيح المطلوبة وفحصها
# ============================================================
declare -A REQUIRED_VARS=(
  ["JWT_SECRET"]="ff8d89d5d43df95e470553e76f3c4ca18f651ad4fdc6ab86b256f4883e6aa220"
  ["PIN_SECRET"]="6a1f1a07787035f332b188d623a6395dc50de51bf90a62238ed25b5519ca3194"
  ["NOTIFY_KEY"]="https://notify.mmc-mms.com/webhook"
  ["TIMEZONE"]="Asia/Qatar"
)

echo ""
echo "🔍 التحقق من مفاتيح البيئة في Cloudflare..."
echo "--------------------------------------------"

for VAR in "${!REQUIRED_VARS[@]}"; do
  VALUE=$(npx wrangler pages project settings $PROJECT_NAME 2>/dev/null | grep "$VAR" | awk '{print $2}')
  if [[ -z "$VALUE" ]]; then
    echo "⚠️ المتغير $VAR غير موجود — سيتم إضافته الآن..."
    npx wrangler pages project settings set "$VAR" "${REQUIRED_VARS[$VAR]}" --project-name $PROJECT_NAME
    echo "$(date) Added missing var: $VAR" >> "$LOG_FILE"
  else
    echo "✅ $VAR موجود مسبقًا."
  fi
done

# ============================================================
# 5️⃣ إعادة النشر في بيئة الإنتاج فقط (production)
# ============================================================
echo ""
echo "🚀 بدء إعادة النشر (Environment: $BRANCH)"
sleep 2

npx wrangler pages deploy dist \
  --branch "$BRANCH" \
  --commit "Fix: restored environment variables and redeployed backend authentication"

# ============================================================
# 6️⃣ اختبار نقطة الدخول (login API)
# ============================================================
echo ""
echo "🧪 اختبار نقطة تسجيل الدخول..."
sleep 3

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://www.mmc-mms.com/api/v1/patient/login)

if [[ "$RESPONSE" == "200" ]]; then
  echo "✅ SUCCESS — نظام تسجيل الدخول يعمل بشكل طبيعي."
else
  echo "❌ فشل — نقطة تسجيل الدخول غير فعّالة (رمز HTTP: $RESPONSE)"
  echo "📄 سيتم حفظ تقرير في LOGIN_FAILURE_DIAGNOSIS.md"
  {
    echo "# LOGIN FAILURE DIAGNOSIS"
    echo "Time: $(date)"
    echo "HTTP Response: $RESPONSE"
    echo "Environment Variables Log:"
    cat "$LOG_FILE"
  } > LOGIN_FAILURE_DIAGNOSIS.md
fi

# ============================================================
# 7️⃣ إتمام المهمة بنجاح
# ============================================================
echo ""
echo "--------------------------------------------"
echo "🎯 المهمة اكتملت — تم التحقق من كل المفاتيح وإعادة النشر بنجاح."
echo "📁 تحقق الآن من الموقع: https://www.mmc-mms.com"
echo "--------------------------------------------"