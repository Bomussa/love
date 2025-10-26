# Vercel Edge Functions API

This directory contains the Vercel Edge Functions implementation of the MMC-MMS backend API.

## Structure

```
api/
├── _lib/                    # Shared libraries
│   ├── kv.ts               # Storage adapter (Vercel KV + Memory fallback)
│   ├── json.ts             # JSON response helpers with CORS
│   ├── router.ts           # Route matching utilities
│   └── sse.ts              # Server-Sent Events helpers
└── v1/
    └── [...path].ts        # Catch-all Edge Function for /api/v1/*
```

## Edge Runtime

All functions use the Edge Runtime, which provides:
- Fast cold starts (<100ms)
- Global distribution
- Standard Web APIs (Request, Response, ReadableStream)
- TypeScript support
- Environment variables

## Deployment

### Automatic (Recommended)
Push to the main branch and Vercel will automatically deploy.

### Manual
```bash
vercel deploy --prod
```

## Local Development

**Note**: Running Edge Functions locally requires Vercel CLI and authentication.

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Start dev server
vercel dev
```

For local development without Vercel CLI, use the existing Node.js server:
```bash
npm run start
```

## Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required for KV Storage
- `KV_REST_API_URL` - Vercel KV REST API URL
- `KV_REST_API_TOKEN` - Vercel KV REST API token

### Optional
- `FRONTEND_ORIGIN` - Frontend URL for CORS (default: `*`)

## API Endpoints

All endpoints are handled by `v1/[...path].ts`:

- `GET /api/v1/status` - Health check
- `GET /api/v1/admin/status` - Admin dashboard data
- `POST /api/v1/patient/login` - Patient authentication
- `POST /api/v1/queue/enter` - Enter queue
- `GET /api/v1/queue/status` - Queue status
- `POST /api/v1/queue/done` - Complete queue
- `POST /api/v1/queue/call` - Call next patient
- `GET /api/v1/pin/status` - Get all PINs
- `POST /api/v1/pin/generate` - Generate PIN
- `POST /api/v1/path/choose` - Choose medical path
- `GET /api/v1/reports/*` - Various reports
- `GET /api/v1/events/stream` - SSE event stream

See `docs/VERCEL_BACKEND_MIGRATION.md` for detailed documentation.

## TypeScript

Edge Functions use TypeScript with automatic transpilation by Vercel.
No build step required - Vercel handles it during deployment.

## Testing

```bash
# Health check (requires running server)
npm run test:vercel

# With custom URL
DEPLOY_URL=https://your-app.vercel.app npm run test:vercel
```

## Storage

Uses storage adapter pattern:
- **Production**: Vercel KV (Upstash Redis)
- **Development**: In-memory fallback (no configuration needed)

The adapter automatically selects based on environment variables.

## Migration Notes

This is a 1:1 port of the Cloudflare Workers API with:
- Same endpoints
- Same request/response formats
- Same business logic
- Compatible KV key structures

The original Workers code is preserved in `infra/mms-api/`.
