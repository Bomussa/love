# وثائق MMC‑MMS (فهرس مبسط)

- نظرة عامة مبسطة: `docs/SYSTEM_OVERVIEW.md`
- بنية تقنية مختصرة: `ARCHITECTURE.md`
- تشغيل وصيانة: `MAINTENANCE_RUNBOOK.md`
- تشغيل سريع (أوامر): `README.md` قسم "⚡ تشغيل سريع"
- إعادة التوجيه والـ API:
  - التطوير: `vite.config.js`
  - الإنتاج: `vercel.json`
- واجهات التكامل الأساسية:
  - قاعدة الـ API: `src/lib/api-base.js`
  - عميل REST + الإيدمبوتنسي + الأوفلاين: `src/lib/api.js`, `src/utils/idempotency.js`
  - التحديثات الحية (SSE): `src/core/event-bus.js`