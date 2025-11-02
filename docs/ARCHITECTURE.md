# Architecture – Military Medical Center App (MMC-MMS)

> الهدف: تشغيل سلس 100%، بدون تغيير الهوية البصرية، مع خطط Fallback، ونشر سريع عبر Vercel + بوابة GitHub Pages للمعاينة.

## طبقات المنظومة
```mermaid
graph TD
  A[Client – Mobile Web/PWA] -->|HTTPS| B[Vercel Edge / CDN]
  B -->|Static| C[UI App]
  B -->|/api/v1/*| D[API Proxy]
  D --> E[Supabase Edge Functions]
  E --> F[(Postgres DB)]
  E --> G[Auth / RLS]
  E --> H[Storage / Buckets]
  E --> I[Queue Engine + SSE]
  I --> J[Notifications Service]
  B --> K[Assets (images/fonts)]
  subgraph Observability
    L[Logs]:::m; M[Metrics]:::m; N[Tracing]:::m
  end
  E --> L; B --> M; E --> N
  classDef m fill:#eef,stroke:#88a;
```

## مسارات رئيسية
1. **واجهة المراجع**: تحميل من Vercel CDN، كل استدعاءات الخلفية عبر `/api/v1/` إلى Supabase Edge Functions.
2. **الإشعارات/SSE**: قناة SSE من طبقة الصفوف (I) لعرض التقدم والتنبيهات.
3. **الإدارة**: نفس الواجهة بامتيازات Admin، وقواعد RLS تحكم الوصول.

## GitHub Actions & Environments
- **deploy-vercel.yml**: بناء/نشر إلى Vercel (Prod).
- **uptime-smoke.yml**: فحص 200 OK بعد النشر.
- **gh-pages**: بوابة معاينة (iframe) تُشير للرابط الإنتاجي.

## Fallbacks
- فشل النشر → بقاء آخر نسخة مستقرة (Release immutability).
- تعذر API → رسائل توضيحية + إعادة محاولة مع Backoff.
- تعذر SSE → Polling خفيف مؤقت.

## أمن
- RLS على Postgres، مفاتيح سرية في GitHub/Vercel، وCodeQL (اختياري).

