# 🚀 دليل النشر

## النشر على Vercel

### الخطوات

\`\`\`bash
# 1. تسجيل الدخول
vercel login

# 2. ربط المشروع
vercel link

# 3. إضافة متغيرات البيئة
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 4. النشر
vercel --prod
\`\`\`

## متغيرات البيئة المطلوبة

انظر \`config/vercel-environment-variables.md\`

## التحقق من النشر

\`\`\`bash
curl https://love-bomussa.vercel.app/api/hello
\`\`\`

---
**آخر تحديث:** 08 نوفمبر 2025
