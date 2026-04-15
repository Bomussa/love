import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const auditFile = path.join(ROOT, 'data', 'audit', 'structure.json')
if (!fs.existsSync(auditFile)) {
  console.error('❌ Missing data/audit/structure.json. Run structureCheck first.')
  process.exit(1)
}

const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'))
// Only remove explicitly-marked unused files; do not prune by duplicate basename to avoid accidental removals
const removeList = [
  ...audit.unused.map(p => path.join(ROOT, p))
]

for (const f of removeList) {
  try {
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      fs.unlinkSync(f)
      console.log('🗑️ Removed:', path.relative(ROOT, f))
    } else {
      console.warn('⚠️ Skip (not a file):', path.relative(ROOT, f))
    }
  } catch (e) {
    console.warn('⚠️ Skip (error):', path.relative(ROOT, f))
  }
}
console.log('✅ Cleanup complete, project is now lean.')
