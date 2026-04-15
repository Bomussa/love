import fs from 'node:fs'
import path from 'node:path'

const HEALTH = path.join('data', 'status', 'health.json')
const PERF = path.join('data', 'status', 'performance.json')
const LOG = path.join('tools', 'watchdog.log')
const DEPLOY_LOG = path.join('logs', 'deploy.log')

function log (line) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`)
  try {
    fs.mkdirSync(path.dirname(DEPLOY_LOG), { recursive: true })
    fs.appendFileSync(DEPLOY_LOG, `[${new Date().toISOString()}] ${line}\n`)
  } catch {}
}
function readJSON (p, d = {}) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }

setInterval(() => {
  const h = readJSON(HEALTH, {})
  const p = readJSON(PERF, {})
  const alerts = []

  for (const [svc, st] of Object.entries(h)) {
    if (!st || st.ok === false) alerts.push(`HEALTH: ${svc} not ok`)
  }
  for (const [label, s] of Object.entries(p)) {
    const avg = typeof s.avgMs === 'number' ? s.avgMs : 0
    const max = typeof s.maxMs === 'number' ? s.maxMs : 0
    if (avg > 100) alerts.push(`PERF: ${label} avg=${avg}ms`)
    if (max > 500) alerts.push(`PERF: ${label} max=${max}ms`)
  }
  if (alerts.length) log(alerts.join(' | '))
}, 15000)
