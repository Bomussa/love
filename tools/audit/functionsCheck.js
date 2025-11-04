import fs from 'fs'
import path from 'path'
import { globSync } from 'glob'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const files = globSync(path.join(ROOT, 'src', '**', '*.ts').replace(/\\/g, '/'))
const fnUsage = new Map()
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8')
  const rel = path.relative(ROOT, f)
  // declared: function foo() {}
  const decl = [...code.matchAll(/function\s+([A-Za-z0-9_]+)/g)]
  decl.forEach(([_, name]) => {
    if (!fnUsage.has(name)) fnUsage.set(name, { declared: [], used: [] })
    fnUsage.get(name).declared.push(rel)
  })
  // usage: foo(
  const usage = [...code.matchAll(/([A-Za-z0-9_]+)\(/g)]
  usage.forEach(([_, name]) => {
    if (fnUsage.has(name)) fnUsage.get(name).used.push(rel)
  })
}

const unusedFns = Array.from(fnUsage.entries())
  .filter(([, v]) => v.used.length === 0)
  .map(([n]) => n)

const outDir = path.join(ROOT, 'data', 'audit')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'functions.json'), JSON.stringify({ unusedFns }, null, 2))
console.log('[AUDIT] Functions usage check complete ✅')
