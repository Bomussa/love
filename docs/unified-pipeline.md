# Unified Release Pipeline (love + love-api)

هذا المستند يوضح آلية pipeline الموحد بين المستودعين **love** و **love-api** عبر مرحلتين:

1. **Staging first**: نشر backend ثم frontend.
2. **Production promotion**: ترقية تلقائية فقط عند نجاح الاختبارات.

## Workflow

الملف: `.github/workflows/unified-release.yml`

### Sequence

1. Trigger deployment في `love-api` عبر `repository_dispatch` (`deploy-staging`).
2. Deploy staging للواجهة عبر Vercel.
3. تشغيل integration checks من frontend flows إلى backend endpoints مع `x-correlation-id` لكل طلب.
4. توليد artifact موحد للتغطية:
   - Endpoint coverage
   - Table coverage (من `supabase/schema.sql`)
   - UI flow coverage
5. قبل production: إنشاء rollback checkpoints:
   - DB snapshot (`pg_dump`)
   - Deployment tag على Git
6. Promotion إلى production فقط إذا:
   - `successRate > 98`
   - لا يوجد فشل `P0` أو `P1`

## Required GitHub Secrets

- `CROSS_REPO_GH_TOKEN` (لـ dispatch على love-api)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `STAGING_FRONTEND_URL`
- `STAGING_FRONTEND_WWW_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`

## Reports and Artifacts

- `artifacts/integration-report.json`
- `artifacts/unified-coverage-report.json`
- `artifacts/unified-coverage-report.md`
- Production snapshot artifact: `production-db-snapshot`

## Local execution

```bash
node scripts/ci/run-unified-integration.mjs
node scripts/ci/build-unified-coverage.mjs
```
