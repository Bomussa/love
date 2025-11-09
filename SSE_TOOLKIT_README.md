# Iyad Realtime & SSE Toolkit (Read‑Only)

## ما الذي يفعله
- بروكسي محلي ذكي `smart-proxy.js` (لا يغيّر مشروعك) — منفذ 8080، إعادة كتابة `/api` → `/api/v1`، محاولة إعادة واحدة، سجلات NDJSON، أرشفة يومية gzip.
- صفحة فحص حي `test-sse.html` للتأكد من بثّ SSE من المسار `/api/v1/queue/sse`.
- سكربت اشتراك Supabase `tests/test-subscribe.mjs` للاستماع لتغييرات جدول `public.queue` بدون إدخال بيانات.

## التشغيل السريع
```bash
# 1) تشغيل البروكسي
node smart-proxy.js

# 2) توجيه المتصفح/التطبيق إلى http://localhost:8080 (عبر امتداد proxy أو تعديل hosts مؤقتًا)

# 3) فحص الصحة عبر البروكسي
curl -i "http://localhost:8080/api/v1/health"

# 4) فحص SSE (يجب أن ترى تدفق الأحداث)
curl -N -i "http://localhost:8080/api/v1/queue/sse"

# 5) اختبار اشتراك Supabase (لا كتابة)
export SUPABASE_URL="https://<PROJECT>.supabase.co"
export SUPABASE_ANON_KEY="<ANON_KEY>"
node tests/test-subscribe.mjs
```

## السجلات والأرشفة
- السجلات: `logs/YYYY-MM-DD_requests.ndjson`
- الأرشيف اليومي المضغوط: `archives/YYYY-MM-DD.ndjson.gz`

## أمان
- لا يمرِّر المفتاح `service_role` إطلاقًا.
- يُولِّد `x-request-id`، ويجزّئ قيم Authorization في السجل (SHA‑256).

## مراجع
- Supabase Realtime — Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel Edge Runtime (SSE streaming window): https://vercel.com/docs/functions/runtimes/edge
- MDN — Using Server‑Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
```

