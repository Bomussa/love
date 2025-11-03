# Architecture Overview

Mermaid diagram below shows flow: Frontend ⇄ API (`/api/v1/*`) ⇄ Auto/catch‑all handlers ⇄ `UPSTREAM_API_BASE` (Supabase Functions v1).

```mermaid
flowchart LR
  subgraph Web
    Browser[Browser / Frontend]
  end

  subgraph Core["Love Repo - Serverless API"]
    Browser -->|"fetch /api/v1/*"| API[/api/v1/*]
    API -->|existing handlers| Handlers[Existing API Handlers]
    API -->|fallback| CatchAll[api/v1/[...rest].js]
    API -->|optional| AutoHandlers[api/v1/auto/*]
    CatchAll -->|proxy| Upstream[(UPSTREAM_API_BASE - Supabase Functions v1)]
    AutoHandlers -->|proxy| Upstream
  end

  subgraph Infra
    Upstream -->|function| Supabase[Supabase Functions]
    Vercel[Vercel Edge/Serverless] --- API
  end

  note right of CatchAll
    middleware: api/_lib/middleware.js\n
    proxy helper: api/_lib/proxy.js
  end
```

Notes:
- `scripts/audit-routes.js` produces `reports/route-graph.json`.
- `scripts/generate-auto-handlers.js` reads the graph and generates `api/v1/auto/*` files that proxy to `UPSTREAM_API_BASE`. Existing handlers are never overwritten.
- The catch‑all `api/v1/[...rest].js` gives you immediate end‑to‑end functionality while keeping specific handlers in control (Vercel resolves exact matches before dynamic).
