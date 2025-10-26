# Developer Quick Reference

## Project Structure

```
love/
├── api/                           # Vercel Edge Functions (NEW)
│   ├── _lib/                      # Shared libraries
│   │   ├── kv.ts                  # Storage adapter
│   │   ├── json.ts                # Response helpers
│   │   ├── router.ts              # Route matching
│   │   └── sse.ts                 # SSE streaming
│   └── v1/
│       └── [...path].ts           # Catch-all API handler
├── src/                           # Frontend (React + Vite)
│   ├── components/
│   ├── lib/
│   │   └── api.js                 # API client (already compatible)
│   └── main.jsx
├── infra/                         # Original infrastructure (preserved)
│   ├── mms-api/                   # Cloudflare Workers API
│   └── worker-api/                # Worker proxy
├── docs/                          # Documentation
│   ├── VERCEL_BACKEND_MIGRATION.md
│   └── VERCEL_DEPLOYMENT_GUIDE.md
├── scripts/
│   └── test/
│       └── vercel-health-check.js
├── package.json
├── vercel.json                    # Vercel config
└── .env.example                   # Environment template
```

## Common Commands

### Development
```bash
npm run dev:vite         # Frontend only (port 5173)
npm run vercel:dev       # Frontend + Edge Functions (requires Vercel CLI)
npm run start            # Express server (original)
```

### Build & Deploy
```bash
npm run build            # Build frontend (dist/)
vercel                   # Deploy to Vercel preview
vercel --prod            # Deploy to production
```

### Testing
```bash
npm run health:check     # Health check API endpoints
npm run test:api         # Original API tests
```

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/status` | Health check |
| GET | `/api/v1/admin/status` | Admin dashboard data |
| POST | `/api/v1/patient/login` | Patient login |
| POST | `/api/v1/queue/enter` | Enter queue |
| GET | `/api/v1/queue/status?clinic=X` | Queue status |
| POST | `/api/v1/queue/done` | Complete queue |
| POST | `/api/v1/queue/call` | Call next patient |
| GET | `/api/v1/pin/status` | Get all PINs |
| POST | `/api/v1/pin/generate` | Generate PIN |
| POST | `/api/v1/path/choose` | Choose medical path |
| GET | `/api/v1/reports/daily` | Daily report |
| GET | `/api/v1/reports/weekly` | Weekly report |
| GET | `/api/v1/reports/monthly` | Monthly report |
| GET | `/api/v1/reports/annual` | Annual report |
| GET | `/api/v1/events/stream` | SSE event stream |

## Environment Variables

### Development (.env.local)
```bash
FRONTEND_ORIGIN=http://localhost:5173
# Optional: KV credentials for local testing
```

### Production (Vercel Dashboard)
```bash
FRONTEND_ORIGIN=https://your-domain.vercel.app
# KV is auto-configured by Vercel
```

## Curl Examples

### Health Check
```bash
curl https://your-app.vercel.app/api/v1/status
```

### Patient Login
```bash
curl -X POST https://your-app.vercel.app/api/v1/patient/login \
  -H "Content-Type: application/json" \
  -d '{"patientId":"123456789","gender":"male"}'
```

### Get PINs
```bash
curl https://your-app.vercel.app/api/v1/pin/status
```

### Enter Queue
```bash
curl -X POST https://your-app.vercel.app/api/v1/queue/enter \
  -H "Content-Type: application/json" \
  -d '{"clinic":"lab","user":"123456789"}'
```

### Queue Status
```bash
curl "https://your-app.vercel.app/api/v1/queue/status?clinic=lab"
```

## Storage (KV)

### Key Patterns
```
patient:{sessionId}           → Patient session data
queue:list:{clinic}           → Queue array
queue:user:{clinic}:{user}    → User queue entry
queue:status:{clinic}         → Current serving info
pin:{clinic}                  → Daily PIN
route:{patientId}             → Patient route
event:{clinic}:{user}:{ts}    → Event log
lock:{resource}               → Distributed lock
```

### Accessing Storage in Code
```typescript
import { createStorageAdapter } from '../_lib/kv';

const storage = createStorageAdapter();
await storage.setJSON('key', { data: 'value' }, { expirationTtl: 3600 });
const data = await storage.getJSON('key');
await storage.delete('key');
```

## TypeScript

Edge Functions use TypeScript with automatic transpilation by Vercel.
No build step needed - just write .ts files in api/

## CORS

Configured in `api/_lib/json.ts`:
```typescript
Access-Control-Allow-Origin: process.env.FRONTEND_ORIGIN || '*'
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Debugging

### View Logs (Vercel Dashboard)
1. Go to project → Deployments
2. Click deployment → Logs tab
3. Filter by function or search terms

### View Logs (CLI)
```bash
vercel logs <deployment-url>
```

### Local Debugging
1. Add `console.log()` in Edge Functions
2. Run `vercel dev`
3. Check terminal output

## Adding New Endpoints

Edit `api/v1/[...path].ts`:

```typescript
// Add handler function
async function handleNewEndpoint(req: Request): Promise<Response> {
  const body = await req.json();
  // Your logic here
  return success({ message: 'Hello' });
}

// Add route in main handler
if (path === '/api/v1/new/endpoint' && method === 'POST') {
  return await handleNewEndpoint(req);
}
```

## Verifying Changes

```bash
# 1. Build locally
npm run build

# 2. Check TypeScript
npx tsc --noEmit api/**/*.ts

# 3. Test locally (if Vercel CLI configured)
vercel dev

# 4. Deploy to preview
vercel

# 5. Test preview deployment
DEPLOY_URL=https://preview-url.vercel.app npm run health:check

# 6. Promote to production
vercel --prod
```

## Rollback

```bash
# Via CLI
vercel rollback <deployment-url>

# Via Dashboard
Project → Deployments → Previous deployment → Promote
```

## Performance Tips

1. **Edge Functions are fast**: <100ms cold start
2. **KV is distributed**: Low latency globally
3. **Static assets cached**: CDN serves dist/
4. **Minimize dependencies**: Import only what you need
5. **Use TTL wisely**: Set expiration on temporary data

## Security Best Practices

1. ✅ Never commit secrets (.env in .gitignore)
2. ✅ Use environment variables for credentials
3. ✅ Validate all input in handlers
4. ✅ Set appropriate CORS origin (not *)
5. ✅ Use HTTPS only (Vercel default)
6. ✅ Rate limit if needed (implement in KV)

## Useful Links

- **Vercel Docs**: https://vercel.com/docs
- **Edge Functions**: https://vercel.com/docs/functions/edge-functions
- **Vercel KV**: https://vercel.com/docs/storage/vercel-kv
- **Upstash Redis**: https://upstash.com/docs/redis

## Getting Help

1. Check `docs/VERCEL_BACKEND_MIGRATION.md`
2. Check `docs/VERCEL_DEPLOYMENT_GUIDE.md`
3. Review code in `api/v1/[...path].ts`
4. Check Vercel logs
5. Test with health check script

---

**Happy coding!** 🚀
