import type { EnvVars } from './utils'

// Token bucket بسيط: 60 طلب/دقيقة لكل IP
// إن توفّر KV، نستخدمه لتقليل تقلب الذاكرة بين PoPs
const memory = new Map<string, { ts: number; count: number }>()

export async function allowIp(env: EnvVars, ip: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(now / windowSec)
  const key = `rl:${ip}:${bucket}`

  if (env.RATE_LIMIT_KV) {
    const val = await env.RATE_LIMIT_KV.get(key)
    const count = val ? parseInt(val, 10) : 0
    if (count >= limit) return false
    await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: windowSec })
    return true
  }

  const m = memory.get(key)
  if (!m || m.ts !== bucket) {
    memory.clear() // نظافة بسيطة لكل نافذة
    memory.set(key, { ts: bucket, count: 1 })
    return true
  }
  if (m.count >= limit) return false
  m.count++
  return true
}
