<<<<<<< HEAD
## Definition of Done (backend wiring only)
- [ ] لا تغييرات على UI/CSS/الصور (src/styles/**, src/components/ui/**, public/**)
- [ ] تم ضبط VITE_API_BASE والاستهلاك عبره لكل REST/SSE
- [ ] تشغيل محلي ناجح (npm ci → npm run dev)
- [ ] Health-check محلي: ✅
- [ ] Health-check إنتاج: ✅ على DEPLOY_URL
- [ ] لا ملفات مكررة/ميتة
=======
## Summary
Add Edge SSE test page + Supabase subscribe harness + local smart proxy (read‑only). No UI/branding changes.

## Checklist
- [ ] /api/v1/health returns 200 ≤ 1000ms through proxy
- [ ] EventSource opens and receives 'ping' events (test-sse.html)
- [ ] supabase-js shows STATUS subscribed for public:queue
- [ ] No writes on production DB were performed

## Notes
- Edge SSE endpoint expected on /api/v1/queue/sse
- Logs in logs/YYYY-MM-DD_requests.ndjson (rotated daily to archives/)
>>>>>>> origin/main
