import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const routesDir = path.join(ROOT, 'src', 'api', 'routes')
const managersDir = path.join(ROOT, 'src', 'middle', 'managers')

const routes = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts')).map(f => f.replace(/\.ts$/, ''))
const managers = fs.readdirSync(managersDir).filter(f => f.endsWith('.ts')).map(f => f.replace(/\.ts$/, ''))

const unlinked = routes.filter(r => !managers.some(m => m === r))

const outDir = path.join(ROOT, 'data', 'audit')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'integration.json'), JSON.stringify({ unlinked }, null, 2))

if (unlinked.length > 0) {
  console.warn('[WARN] Unlinked routes found:', unlinked)
} else {
  console.log('[OK] All routes linked to managers.')
}
