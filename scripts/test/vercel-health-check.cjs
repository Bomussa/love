/* Simple post-deploy healthcheck for FE + proxied API/SSE.
 * Usage:
 *   DEPLOY_URL=http://localhost:5173 node scripts/test/vercel-health-check.js
 *   STRICT=true ENDPOINTS="/api/v1/status,/api/v1/ping" DEPLOY_URL="https://app.vercel.app" node scripts/test/vercel-health-check.js
 *
 * Env:
 *   DEPLOY_URL   (required) base URL to check, e.g., http://localhost:5173
 *   ENDPOINTS    (optional) CSV endpoints to check in addition to "/" (GET)
 *   STRICT       (optional) "true" to fail on any non-2xx; default false (warn-only for extra endpoints)
 *   TIMEOUT_MS   (optional) per-request timeout, default 8000
 *   RETRIES      (optional) number of retries for each endpoint, default 2
 */

const { setTimeout: sleep } = require('timers/promises')

const BASE = process.env.DEPLOY_URL?.replace(/\/$/, '')
if (!BASE) {
  console.error('❌ DEPLOY_URL is required'); process.exit(2)
}

const STRICT = String(process.env.STRICT || 'false').toLowerCase() === 'true'
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 8000)
const RETRIES = Number(process.env.RETRIES || 2)

const extra = (process.env.ENDPOINTS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const endpoints = ['/', ...extra]

async function getWithTimeout(url) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } })
    return res
  } finally {
    clearTimeout(id)
  }
}

async function checkEndpoint(pathname) {
  const url = `${BASE}${pathname.startsWith('/') ? '' : '/'}${pathname}`
  let lastErr = null
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const res = await getWithTimeout(url)
      const ok = res.status >= 200 && res.status < 300
      console.log(`${ok ? '✅' : '⚠️'} ${pathname} -> ${res.status}`)
      return ok
    } catch (e) {
      lastErr = e
      console.log(`⏳ retry ${i + 1}/${RETRIES} for ${pathname} (${e.name || e.message})`)
      await sleep(400)
    }
  }
  console.log(`❌ ${pathname} -> failed (${lastErr?.message || 'unknown error'})`)
  return false
}

(async () => {
  console.log(`🩺 Health-check @ ${BASE} (STRICT=${STRICT}, TIMEOUT_MS=${TIMEOUT_MS}, RETRIES=${RETRIES})`)
  let allOk = true
  for (const ep of endpoints) {
    const ok = await checkEndpoint(ep)
    if (!ok && (STRICT || ep === '/')) {
      allOk = false
    }
  }
  if (!allOk) process.exit(1)
  console.log('🎉 Health-check passed')
})()

