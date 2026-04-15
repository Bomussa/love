import type { KVNamespace } from '@cloudflare/workers-types'

export interface EnvVars {
  BACKEND_ORIGIN: string
  SECONDARY_ORIGIN?: string
  SITE_ORIGIN: string
  PRIMARY_ORIGIN?: string
  FALLBACK_ORIGIN?: string
  ADMIN_BASIC_USER?: string
  ADMIN_BASIC_PASS?: string
  JWT_SECRET?: string
  RATE_LIMIT_KV?: KVNamespace
}

export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-request-id',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  }
}

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function makeRequestId(req: Request): string {
  const incoming = req.headers.get('x-request-id')
  if (incoming) return incoming
  // simple random
  return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; delays?: number[] }) {
  const retries = opts?.retries ?? 2
  const delays = opts?.delays ?? [200, 500]
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      if (i === retries) break
      const ms = delays[i] ?? 300
      await new Promise(r => setTimeout(r, ms))
    }
  }
  throw lastErr
}

export function isGetCacheable(path: string): boolean {
  // only cache public GETs
  if (!path.startsWith('/api/')) return false
  if (path.startsWith('/api/public/')) return true
  if (/^\/api\/route\//.test(path)) return true
  return false
}

export function basicOk(req: Request, user?: string, pass?: string): boolean {
  if (!user || !pass) return false
  const hdr = req.headers.get('authorization')
  if (!hdr || !hdr.toLowerCase().startsWith('basic ')) return false
  try {
    const b64 = hdr.slice(6).trim()
    const [u,p] = atob(b64).split(':')
    return u === user && p === pass
  } catch {
    return false
  }
}
