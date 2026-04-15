import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const report = []

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function walk(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const full = path.join(dir, file)
    try {
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full)
      else report.push(full)
    } catch {}
  }
}

// 1) collect files under project root (exclude node_modules and dist)
const skipDirs = new Set(['node_modules', 'dist', 'dist_clean', '.git', '.husky', '.vscode'])
function walkRoot(dir) {
  const entries = fs.readdirSync(dir)
  for (const ent of entries) {
    if (skipDirs.has(ent)) continue
    const full = path.join(dir, ent)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full)
    else report.push(full)
  }
}

walkRoot(ROOT)

// 2) duplicates by basename
const duplicates = {}
for (const f of report) {
  const base = path.basename(f)
  if (!duplicates[base]) duplicates[base] = []
  duplicates[base].push(path.relative(ROOT, f))
}

// 3) likely unused: conservative — only match explicit junk patterns to avoid accidental deletions
const junkPattern = /(\btest\b|tests?|examples?|example|old|backup|temp|tmp|deprecated|legacy-copy)/i
const unused = report
  .map(f => path.relative(ROOT, f))
  .filter(f => junkPattern.test(f))

// 4) write report
const out = {
  totalFiles: report.length,
  duplicates: Object.entries(duplicates).filter(([_, v]) => v.length > 1),
  unused,
  timestamp: new Date().toISOString(),
}

ensureDir(path.join(ROOT, 'data', 'audit'))
fs.writeFileSync(path.join(ROOT, 'data', 'audit', 'structure.json'), JSON.stringify(out, null, 2))
console.log('[AUDIT] Structure check complete ✅')
