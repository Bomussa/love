# RUNBOOK

## بناء محلي سريع
- Node 20 (انظر .nvmrc)
- `npm ci --ignore-scripts`
- `npm run build` (يتجاوز بأمان لو سكربت غير موجود)

## نشر Vercel يدوي (عند الحاجة)
- تأكد من الأسرار في GitHub:
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- أو استخدم Vercel CLI محليًا:
  - `npm i -g vercel`
  - `vercel pull --yes --environment=production`
  - `vercel build`
  - `vercel deploy --prebuilt`
