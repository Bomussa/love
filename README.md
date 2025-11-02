# Love – Unified Deployment & Ops

> هذا المستودع مهيّأ للنشر على **Vercel** مع تكامل GitHub Actions للأمان والجودة والمراقبة.

## 1) المتطلبات (Secrets)
ضع الأسرار في: **Settings → Secrets and variables → Actions**:
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `GH_PATH`
- (اختياري) `SMTP_SERVER`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `NOTIFY_TO_EMAIL`

### GitHub CLI
```bash
gh secret set GH_PATH --body "https://your-app.vercel.app" --repo Bomussa/love
gh secret set VERCEL_TOKEN --repo Bomussa/love
gh secret set VERCEL_ORG_ID --repo Bomussa/love
gh secret set VERCEL_PROJECT_ID --repo Bomussa/love
```

## 2) vercel.json
- لا تستخدم env داخل `rewrites`.
- اعتمد `/api/v1/` كمسار رسمي، وحوّل القديم تلقائيًا.

## 3) Workflows
- `deploy-vercel.yml` (نشر تلقائي)
- `uptime-smoke.yml` (فحص توافر)

## 4) خطوات سريعة
1) افتح PR إلى `main`.
2) بعد الدمج يتم النشر تلقائيًا.
3) تأكد من نجاح فحص `Uptime`.

## 5) حل 502/DNS_HOSTNAME_NOT_FOUND
- إزالة env من `rewrites`.
- تفعيل Release immutability.
- إعادة تشغيل Job إن لزم.
