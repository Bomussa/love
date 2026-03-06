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
