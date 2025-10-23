import { execSync, spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function get(url, init) {
  const r = await fetch(url, init)
  return { status: r.status, ok: r.ok, json: async () => { try { return await r.json() } catch { return null } }, text: () => r.text() }
}

async function postJson(url, body) {
  return get(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function waitHealth(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { const r = await get(url); if (r.ok) return true } catch {}
    await sleep(500)
  }
  return false
}

async function main() {
  console.log('🔨 Building...')
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })

  const PORT = 3100
  console.log('🚀 Starting server on', PORT)
  const child = spawn(process.platform.startsWith('win') ? 'node.exe' : 'node', ['dist/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HEALTH_STRICT: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let ok = await waitHealth(`http://localhost:${PORT}/healthz`, 15000)
  if (!ok) {
    try { child.kill('SIGTERM') } catch {}
    throw new Error('Health check failed')
  }
  console.log('✅ /healthz OK')

  const probes = []
  probes.push(['GET /api/stats/summary', await get(`http://localhost:${PORT}/api/stats/summary`), v => v.ok])
  probes.push(['GET /api/queue/live', await get(`http://localhost:${PORT}/api/queue/live`), v => v.ok])
  probes.push(['GET /api/reports/performance', await get(`http://localhost:${PORT}/api/reports/performance`), v => v.ok])
  probes.push(['GET /admin/login (html)', await get(`http://localhost:${PORT}/admin/login`), v => v.status === 200])

  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P1+0JQAAAABJRU5ErkJggg=='
  probes.push(['POST /api/visual/snapshot', await postJson(`http://localhost:${PORT}/api/visual/snapshot`, {
    imgData: `data:image/png;base64,${tinyPng}`,
    timestamp: new Date().toISOString(),
    userId: 'pre-release',
    url: '/',
    viewport: { w: 800, h: 600 }
  }), v => v.ok])

  let failures = 0
  for (const [name, res, pass] of probes) {
    if (!pass(res)) { console.error('❌', name, '->', res.status); failures++ } else { console.log('✅', name) }
  }

  try { child.kill('SIGTERM') } catch {}
  await sleep(500)

  if (failures > 0) {
    throw new Error(`Pre-release check failed with ${failures} error(s)`)
  }
  console.log('🎉 Pre-release checks passed')
}

main().catch(err => { console.error('❌', err?.message || err); process.exit(1) })
