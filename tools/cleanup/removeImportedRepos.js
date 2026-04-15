import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

// Try both possible locations relative to this project
const targets = [
  path.join(ROOT, '..', 'cross-repo-audit'), // C:\...\vs-code\cross-repo-audit
  path.join(ROOT, '..', '..', 'cross-repo-audit') // C:\...\Desktop\cross-repo-audit
]

for (const t of targets) {
  try {
    if (fs.existsSync(t)) {
      fs.rmSync(t, { recursive: true, force: true })
      console.log('🧹 Removed imported repo:', t)
    } else {
      console.log('ℹ️ Not found (skip):', t)
    }
  } catch (e) {
    console.warn('⚠️ Failed to remove:', t, String(e?.message || e))
  }
}
console.log('✅ Repos cleanup done')
