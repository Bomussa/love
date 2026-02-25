# 04_VERCEL_PROD_PROOF
**Generated**: 2026-02-24

## Project
- **Project Name**: love
- **Project ID**: prj_5lFZHkKRCEEpVLkS4dGGUiEcGHWS
- **Team**: bomussa

## Domains
| Domain | Type | Status |
|--------|------|--------|
| www.mmc-mms.com | Production Custom Domain | ✅ Connected to Production |
| mmc-mms.com | Production Custom Domain | ✅ Connected to Production (fixed from redirect) |

## Last Known Deployment
- **Commit**: `94ce36d` — fix: إصلاح إحصائيات لوحة التحكم الرئيسية
- **Status**: Ready ✅
- **Build**: Vite → `frontend/dist`

## vercel.json Config
```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/admin", "destination": "/index.html" },
    { "source": "/clinic/(.*)", "destination": "/index.html" },
    { "source": "/qr", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
    ]}
  ]
}
```

## Domain Fix Applied
- **Before**: `mmc-mms.com` → 308 Permanent Redirect → `www.mmc-mms.com`
- **After**: `mmc-mms.com` → Direct Production (no redirect)
- **Fix Date**: 2026-02-24
