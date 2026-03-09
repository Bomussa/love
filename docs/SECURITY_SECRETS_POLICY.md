# Security Policy: Secrets Handling

## قاعدة إلزامية
- **ممنوع تخزين أي أسرار داخل الكود** (tokens, API keys, JWT secrets, service-role keys).
- الأسرار تُقرأ فقط من متغيرات البيئة في Vercel/Supabase أو بيئة التشغيل المحلية.

## المتغيرات المطلوبة (Env-only)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` (داخل Supabase فقط)

## إجراءات الاستجابة عند التسريب
1. **Rotate فوري** للمفاتيح المكشوفة:
   - Supabase anon key
   - Supabase service role key
   - Supabase JWT secret
2. تحديث القيم الجديدة في:
   - Supabase project settings
   - Vercel Environment Variables (Production/Preview/Development)
3. إعادة نشر الخدمات بعد التحديث.
4. تنظيف التاريخ إذا تم نشر السر في Git:
   - استخدم `git filter-repo` أو `BFG` لإزالة الأنماط الحساسة من كل التاريخ.
   - ثم force-push للفروع المتأثرة بالتنسيق مع الفريق.
5. إبطال أي جلسات/توكنات مرتبطة إن لزم.
6. فتح Incident Report يتضمن:
   - وقت التسريب
   - الملفات المتأثرة
   - المفاتيح التي تم تدويرها
   - تاريخ إغلاق الحادث

## أوامر مقترحة لتنظيف التاريخ
```bash
# مثال باستخدام git filter-repo
pip install git-filter-repo

git filter-repo --path-glob '*' \
  --replace-text <(cat <<'PATTERNS'
regex:eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}==>REDACTED_JWT
regex:github_pat_[A-Za-z0-9_]{20,}==>REDACTED_GITHUB_PAT
regex:sbp_[A-Za-z0-9]{20,}==>REDACTED_SUPABASE_PAT
PATTERNS
)

# بعد المراجعة الداخلية
# git push --force-with-lease origin main
```

## فحوصات مانعة للتسريب
- pre-commit + pre-push hooks على المسارات: `frontend/`, `scripts/`, `docs/`.
- الفحص يستخدم `gitleaks` إن كان متاحًا، وإلا fallback regex scanner.
