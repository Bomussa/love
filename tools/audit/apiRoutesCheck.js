import fs from 'fs'
import path from 'path'
import { globSync } from 'glob'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

// Find all route files (TypeScript)
const routes = globSync(path.join(ROOT, 'src', 'api', 'routes', '**', '*.ts').replace(/\\/g, '/'))
const endpoints = []

for (const file of routes) {
  try {
    const text = fs.readFileSync(file, 'utf8')
    const matches = [...text.matchAll(/router\.(get|post|put|delete)\(["'`](.*?)["'`]/g)]
    matches.forEach(([_, method, p]) => {
      endpoints.push({ file: path.relative(ROOT, file), method: method.toUpperCase(), path: p })
    })
  } catch {}
}

// group and detect conflicts
const grouped = {}
for (const e of endpoints) {
  const key = `${e.method} ${e.path}`
  if (!grouped[key]) grouped[key] = []
  grouped[key].push(e.file)
}

const conflicts = Object.entries(grouped)
  .filter(([_, files]) => files.length > 1)
  .map(([k, files]) => ({ endpoint: k, files }))

const out = { endpoints, conflicts }
const outDir = path.join(ROOT, 'data', 'audit')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'apiRoutes.json'), JSON.stringify(out, null, 2))
console.log('[AUDIT] API routes check complete ✅')
