import { corsHeaders, json, makeRequestId, withRetry, isGetCacheable, type EnvVars } from './utils'
import { allowIp } from './ratelimit'

type Env = EnvVars

const TIMEOUT_MS = 5000
const HEALTH_TIMEOUT_MS = 1000
const GET_CACHE_TTL = 45 // seconds

// اختيار مسار الباكند ديناميكيًا مع ترتيب تفضيل وذاكرة قصيرة الأجل
const backendCache: { value?: string; ts?: number } = {}
const BACKEND_CACHE_MS = 60_000 // دقيقة واحدة

async function quickHead(url: string, ms = 2000): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', signal: abortSignal(ms) })
    if (!res.ok) return false
    // حاول التأكد من JSON { ok: true } أو { status: 'up' }
    try {
      const t: any = await res.clone().json()
      const ok = t?.ok === true || t?.status === 'up' || t?.backend === 'up'
      return ok || true
    } catch {
      return true
    }
  } catch {
    return false
  }
}

function candidateOrigins(env: Env): string[] {
  const out: string[] = []
  if (env.BACKEND_ORIGIN) out.push(env.BACKEND_ORIGIN)
  if (env.PRIMARY_ORIGIN) out.push(env.PRIMARY_ORIGIN)
  if (env.SECONDARY_ORIGIN) out.push(env.SECONDARY_ORIGIN)
  if (env.FALLBACK_ORIGIN) out.push(env.FALLBACK_ORIGIN)
  // تجنّب استخدام workers.dev لمنع إعادة التوجيه إلى نفس الـ Worker
  const uniq = Array.from(new Set(out.filter(Boolean)))
  return uniq.filter(o => {
    try { return !new URL(o).hostname.endsWith('.workers.dev') } catch { return true }
  })
}

async function resolveBackend(env: Env): Promise<string | undefined> {
  const now = Date.now()
  if (backendCache.value && backendCache.ts && (now - backendCache.ts) < BACKEND_CACHE_MS) {
    return backendCache.value
  }
  const list = candidateOrigins(env)
  for (const o of list) {
    const ok = await quickHead(new URL('/api/health', o).toString(), 2500)
    if (ok) {
      backendCache.value = o
      backendCache.ts = now
      return o
    }
  }
  // إبقاء آخر قيمة إن وُجدت حتى لو فشل الفحص
  return backendCache.value
}

function abortSignal(ms: number): AbortSignal {
  const ctrl = new AbortController()
  // @ts-ignore - setTimeout exists in Workers
  const t = setTimeout(() => ctrl.abort('timeout'), ms)
  // Leak protection (no finally hook here)
  // @ts-ignore
  ctrl.signal.addEventListener('abort', () => clearTimeout(t))
  return ctrl.signal
}

async function checkBackend(env: Env): Promise<'up'|'down'> {
  const url = new URL('/api/health', env.BACKEND_ORIGIN)
  try {
    const res = await fetch(url.toString(), { method: 'GET', signal: abortSignal(HEALTH_TIMEOUT_MS) })
    return res.ok ? 'up' : 'down'
  } catch {
    return 'down'
  }
}

async function proxyToOrigin(req: Request, env: Env, origin: string): Promise<Response> {
  const urlIn = new URL(req.url)
  const target = new URL(urlIn.pathname + urlIn.search, origin)
  const headers = new Headers(req.headers)
  // Ensure Host header is not forwarded incorrectly
  headers.delete('host')
  const init: RequestInit = {
    method: req.method,
    headers,
    body: ['GET','HEAD'].includes(req.method) ? undefined : await req.clone().arrayBuffer(),
    signal: abortSignal(TIMEOUT_MS),
    // Workers specific cf props can be set if needed
  }
  return await fetch(target.toString(), init)
}

async function handleRequest(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const start = Date.now()
  const url = new URL(req.url)
  const reqId = makeRequestId(req)
  const cors = corsHeaders(env.SITE_ORIGIN)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors })
  }

  // Health endpoint at worker
  if (url.pathname === '/health') {
    const active = await resolveBackend(env)
    const backend = active ? await checkBackend({ ...env, BACKEND_ORIGIN: active }) : 'down'
    const body = { ok: true, worker: 'up', backend, ts: new Date().toISOString() }
    const res = json(body, { status: 200, headers: cors })
    res.headers.set('x-request-id', reqId)
    return res
  }

  // Rate limit per IP (best-effort)
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await allowIp(env, ip, 60, 60) // 60 req / 60s
  if (!allowed) {
    const res = json({ ok: false, error: 'Too Many Requests' }, { status: 429, headers: cors })
    res.headers.set('x-request-id', reqId)
    return res
  }

  // Admin protection
  if (url.pathname.startsWith('/api/admin/')) {
    const basicOk = (() => {
      const hdr = req.headers.get('authorization') || ''
      if (!hdr.toLowerCase().startsWith('basic ')) return false
      try {
        const decoded = atob(hdr.slice(6).trim())
        const [u, p] = decoded.split(':')
        return !!env.ADMIN_BASIC_USER && !!env.ADMIN_BASIC_PASS && u === env.ADMIN_BASIC_USER && p === env.ADMIN_BASIC_PASS
      } catch { return false }
    })()
    let jwtOk = false
    if (!basicOk && env.JWT_SECRET) {
      // minimal HS256 verifier
      const auth = req.headers.get('authorization') || ''
      if (auth.toLowerCase().startsWith('bearer ')) {
        const token = auth.slice(7).trim()
        try {
          const [h, p, s] = token.split('.')
          const data = `${h}.${p}`
          const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
          const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
          const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data))
          jwtOk = !!ok
        } catch { jwtOk = false }
      }
    }
    if (!(basicOk || jwtOk)) {
      const res = json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: cors })
      res.headers.set('x-request-id', reqId)
      return res
    }
  }

  // Proxy only /api/*
  if (!url.pathname.startsWith('/api/')) {
    const res = json({ ok: false, error: 'Not Found' }, { status: 404, headers: cors })
    res.headers.set('x-request-id', reqId)
    return res
  }

  const isGet = req.method === 'GET'
  const cacheable = isGet && isGetCacheable(url.pathname)
  let cacheHit = false

  if (cacheable) {
  const cacheKey = new Request(req.url, { headers: { 'x-request-id': reqId }, method: 'GET' })
  const match = await (caches as any).default.match(cacheKey)
    if (match) {
      cacheHit = true
      const out = new Response(match.body, match)
      for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
      out.headers.set('x-request-id', reqId)
      out.headers.set('x-cache', 'HIT')
      console.log('proxy', req.method, url.pathname, 200, Date.now() - start, 'ms', 'cache=HIT')
      return out
    }
  }

  const doFetch = async (origin: string) => await proxyToOrigin(req, env, origin)
  let originRes: Response
  try {
    const primary = await resolveBackend(env)
    if (!primary) throw new Error('No backend origin available')
    if (isGet) {
      originRes = await withRetry(() => doFetch(primary), { retries: 2, delays: [200, 500] })
      if ((!originRes.ok || originRes.status >= 502) && env.SECONDARY_ORIGIN) {
        originRes = await withRetry(() => doFetch(env.SECONDARY_ORIGIN!), { retries: 1, delays: [300] })
      }
    } else {
      originRes = await doFetch(primary)
    }
  } catch (e) {
    const res = json({ ok: false, error: 'Upstream unavailable' }, { status: 503, headers: cors })
    res.headers.set('x-request-id', reqId)
    return res
  }

  // Add CORS and request id
  const res = new Response(originRes.body, originRes)
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
  res.headers.set('x-request-id', reqId)

  if (cacheable && originRes.ok) {
    try {
      res.headers.set('Cache-Control', `public, max-age=${GET_CACHE_TTL}`)
  const cacheKey = new Request(req.url, { headers: { 'x-request-id': reqId }, method: 'GET' })
  ctx.waitUntil((caches as any).default.put(cacheKey, res.clone()))
      res.headers.set('x-cache', 'MISS')
    } catch {}
  }

  console.log('proxy', req.method, url.pathname, res.status, Date.now() - start, 'ms', `cache=${cacheHit ? 'HIT':'MISS'}`)
  return res
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await handleRequest(req, env, ctx)
    } catch (e) {
      const headers = corsHeaders(env.SITE_ORIGIN)
      return json({ ok: false, error: 'Worker error' }, { status: 500, headers })
    }
  },
  // دعم الـ Cron للـ Health warmup
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const active = await resolveBackend(env)
    const url = active ? new URL('/api/health', active).toString() : ''
    if (url) {
      try { await fetch(url, { method: 'GET', signal: abortSignal(1500) }) } catch {}
    }
  }
}
