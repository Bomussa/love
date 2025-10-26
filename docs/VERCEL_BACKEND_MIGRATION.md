# Vercel Backend Migration Guide

## Overview

This document explains how the MMC-MMS API backend was migrated from Cloudflare Workers to Vercel Edge Functions while maintaining 100% API compatibility.

## Architecture

### Before (Cloudflare Workers)
- **Platform**: Cloudflare Workers
- **Storage**: Cloudflare KV (6 namespaces)
- **API Base**: `/api/v1/*`
- **Runtime**: V8 JavaScript Engine
- **Deployment**: `wrangler deploy`

### After (Vercel Edge Functions)
- **Platform**: Vercel Edge Functions
- **Storage**: Vercel KV (Upstash Redis) with in-memory fallback
- **API Base**: `/api/v1/*` (same)
- **Runtime**: Edge Runtime (V8)
- **Deployment**: `vercel deploy` or auto-deploy via Git

## Key Features

### 1. Storage Abstraction Layer
The migration introduces a storage adapter pattern that supports:
- **Vercel KV** (Upstash Redis) for production
- **In-memory storage** for local development without KV configuration
- Automatic fallback when KV is not available

Location: `api/_lib/kv.ts`

### 2. Zero-Breaking Changes
- All endpoints maintain the same URL structure
- Request/response formats are identical
- Frontend code requires no changes

### 3. Non-Destructive Implementation
- Original Cloudflare Workers code preserved in `infra/mms-api/`
- New Vercel Functions code in `api/`
- No existing files modified or deleted

## API Endpoints

All endpoints are implemented in `api/v1/[...path].ts` as a catch-all Edge Function:

### Health & Status
```bash
GET /api/v1/status
GET /api/v1/admin/status
```

### Patient Management
```bash
POST /api/v1/patient/login
Body: { patientId: string, gender: "male" | "female" }
```

### Queue Management
```bash
POST /api/v1/queue/enter
Body: { clinic: string, user: string, isAutoEntry?: boolean }

GET /api/v1/queue/status?clinic=lab

POST /api/v1/queue/done
Body: { clinic: string, user: string, pin?: string }

POST /api/v1/queue/call
Body: { clinic: string }
```

### PIN Management
```bash
GET /api/v1/pin/status
# Returns: { success: true, pins: { clinic: { pin, active, generatedAt } } }

POST /api/v1/pin/generate
Body: { clinic: string }
```

### Path Selection
```bash
POST /api/v1/path/choose
Body: { gender: "male" | "female" }
# Returns: { success: true, path: string[] }
```

### Reports
```bash
GET /api/v1/reports/daily?date=YYYY-MM-DD
GET /api/v1/reports/weekly?week=YYYY-MM-DD
GET /api/v1/reports/monthly?year=YYYY&month=MM
GET /api/v1/reports/annual?year=YYYY
```

### Server-Sent Events (SSE)
```bash
GET /api/v1/events/stream?user=xxx&clinic=yyy
# Returns text/event-stream with heartbeats every 15s
```

## Vercel KV Configuration

### Option 1: Using Vercel KV (Recommended)

1. **Create a KV Database** in Vercel Dashboard:
   - Go to Storage → Create Database → KV
   - Choose a name (e.g., `mmc-mms-kv`)
   - Select region closest to your users

2. **Link to Project**:
   - Vercel automatically sets environment variables:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
     - `KV_REST_API_READ_ONLY_TOKEN`

3. **Install Package**:
   ```bash
   npm install @vercel/kv
   ```

### Option 2: Using External Upstash Redis

1. **Create Upstash Redis Database**:
   - Go to https://upstash.com
   - Create a new Redis database
   - Copy the REST API credentials

2. **Set Environment Variables** in Vercel:
   ```
   KV_URL=https://your-db.upstash.io
   KV_REST_API_URL=https://your-db.upstash.io
   KV_REST_API_TOKEN=your-token
   ```

3. **Install Package**:
   ```bash
   npm install @vercel/kv
   ```

### Option 3: Development Without KV

For local development without setting up KV:
- The system automatically uses in-memory storage
- You'll see a warning: `⚠️ Using in-memory storage adapter`
- Data is ephemeral (lost on restart)
- Perfect for testing and development

## Local Development

### Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

3. **Configure Environment** (optional):
   Create `.env.local` with KV credentials:
   ```env
   KV_REST_API_URL=https://your-kv.upstash.io
   KV_REST_API_TOKEN=your-token
   FRONTEND_ORIGIN=http://localhost:5173
   ```

### Running Locally

Start both frontend and backend:
```bash
npm run vercel:dev
```

Or separately:
```bash
# Terminal 1: Vercel Functions
vercel dev

# Terminal 2: Vite Frontend (if needed)
npm run dev:vite
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:3000/api/v1/status

# PIN status
curl http://localhost:3000/api/v1/pin/status

# Patient login
curl -X POST http://localhost:3000/api/v1/patient/login \
  -H "Content-Type: application/json" \
  -d '{"patientId":"123456","gender":"male"}'

# Queue enter
curl -X POST http://localhost:3000/api/v1/queue/enter \
  -H "Content-Type: application/json" \
  -d '{"clinic":"lab","user":"123456"}'

# Queue status
curl "http://localhost:3000/api/v1/queue/status?clinic=lab"
```

## Deployment

### Automatic Deployment (Recommended)

1. **Connect Repository** to Vercel:
   - Go to Vercel Dashboard
   - Import Git Repository
   - Select this repository

2. **Configure Project**:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Set Environment Variables**:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `FRONTEND_ORIGIN` (production URL)

4. **Deploy**:
   - Push to main branch
   - Vercel auto-deploys

### Manual Deployment

```bash
# First time
vercel

# Production
vercel --prod
```

## Storage Keys Structure

The KV storage uses the following key patterns (compatible with Cloudflare Workers):

### Patient Data
```
patient:{sessionId} → { id, patientId, gender, loginTime, status }
```

### Queue Data
```
queue:list:{clinic} → Array<{ number, user, status, enteredAt }>
queue:user:{clinic}:{user} → { number, user, status, enteredAt }
queue:status:{clinic} → { current, served[] }
```

### PIN Data
```
pin:{clinic} → "01" to "99"
```

### Route Data
```
route:{patientId} → { patientId, examType, gender, stations[], createdAt }
```

### Events
```
event:{clinic}:{user}:{timestamp} → { type, clinic, user, position, timestamp }
```

### Locks
```
lock:{resource} → { id, expiresAt }
```

### Cache
```
(various cache keys for reports and temporary data)
```

## Migration Checklist

- [x] Create storage adapter with KV and memory implementations
- [x] Implement all API endpoints in catch-all Edge Function
- [x] Add CORS support with configurable origin
- [x] Implement SSE streaming for real-time updates
- [x] Add distributed locking mechanism
- [x] Preserve exact API contract from Workers
- [x] Add comprehensive error handling
- [x] Support multiple KV configuration options
- [x] Create migration documentation
- [x] Add health check script
- [x] Configure vercel.json
- [x] Update .env.example

## Differences from Cloudflare Workers

### Similarities
- Same API endpoints and contracts
- Same request/response formats
- Same business logic
- Edge runtime (V8 engine)
- Global distribution

### Differences

| Feature | Cloudflare Workers | Vercel Functions |
|---------|-------------------|------------------|
| Storage | KV Namespaces (6 separate) | Single KV (Upstash Redis) |
| Storage API | `env.KV_ADMIN.get()` | `kv.get()` via @vercel/kv |
| Cron Jobs | Built-in scheduled events | External cron service needed |
| TTL | Built-in with `expirationTtl` | Built-in with `ex` option |
| Deployment | `wrangler deploy` | `vercel deploy` or Git push |
| Config File | `wrangler.toml` | `vercel.json` |

## Testing

### Health Check Script

Run the health check:
```bash
npm run test:vercel
```

This tests:
- ✅ `/api/v1/status` returns healthy
- ✅ `/api/v1/pin/status` returns PIN data
- ✅ CORS headers are present
- ✅ Response times are acceptable

### Manual Testing

See the "Testing Endpoints" section above for curl commands.

### Frontend Integration

The frontend (`src/lib/api.js`) already uses relative URLs (`/api/v1/*`), so it works with both:
- Local development: `http://localhost:3000/api/v1/*`
- Production: `https://your-domain.vercel.app/api/v1/*`

No changes needed!

## Troubleshooting

### "Using in-memory storage adapter" Warning
**Cause**: KV environment variables not set
**Solution**: Configure KV credentials or ignore for local development

### "Module not found: @vercel/kv"
**Cause**: Package not installed
**Solution**: `npm install @vercel/kv`

### CORS Errors
**Cause**: `FRONTEND_ORIGIN` not configured
**Solution**: Set `FRONTEND_ORIGIN` environment variable to your frontend URL

### 404 on /api/v1/* Routes
**Cause**: Vercel not recognizing Edge Functions
**Solution**: Ensure `api/v1/[...path].ts` exists and includes `export const config = { runtime: 'edge' }`

### SSE Connection Closes Immediately
**Cause**: Proxy or CDN buffering
**Solution**: Check `X-Accel-Buffering: no` header is set

## Performance

Expected performance characteristics:

- **Cold Start**: < 100ms (Edge Functions)
- **Response Time**: < 50ms (with KV)
- **Memory**: ~50MB per function
- **Concurrent Requests**: Scales automatically
- **Global Distribution**: Yes (Edge Network)

## Security

### CORS
- Configurable origin via `FRONTEND_ORIGIN`
- Supports preflight requests
- Allows credentials if needed

### Rate Limiting
- Not implemented in current version
- Recommend using Vercel's built-in rate limiting
- Or add custom rate limiting with KV

### Authentication
- Admin endpoints should add authentication
- Consider using JWT tokens
- Store secrets in environment variables

## Next Steps

### Recommended Improvements

1. **Add Authentication**:
   - Implement JWT for admin endpoints
   - Add API key validation

2. **Add Rate Limiting**:
   - Use Vercel's edge config
   - Or implement with KV counters

3. **Monitoring**:
   - Add logging with Vercel Analytics
   - Monitor KV usage and costs
   - Set up alerts for errors

4. **Cron Jobs**:
   - Use Vercel Cron or external service
   - Implement cleanup tasks
   - Auto-refresh PINs daily

5. **Testing**:
   - Add integration tests
   - Add E2E tests with Playwright
   - Add load testing

## Support

For issues or questions:
- Check Vercel documentation: https://vercel.com/docs
- Check Upstash Redis docs: https://upstash.com/docs/redis
- Review the implementation in `api/v1/[...path].ts`

## Conclusion

The migration to Vercel Edge Functions maintains 100% API compatibility while providing:
- ✅ Simplified deployment
- ✅ Automatic scaling
- ✅ Development-friendly fallbacks
- ✅ No vendor lock-in (standard Web APIs)
- ✅ Full TypeScript support

The system works identically to the Cloudflare Workers version from the client's perspective.
