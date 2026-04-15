import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Simple dependency graph walker to find reachable files from known entry points
// Caveats: dynamic imports with non-literal strings and Vite path aliases may be missed.

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const SRC = path.join(ROOT, 'src')
const ENTRY_CANDIDATES = [
  path.join(SRC, 'main.jsx'), // frontend
  path.join(SRC, 'index.ts'), // backend
]

const exts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css']

function existsAny(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  for (const e of exts) {
    if (fs.existsSync(p + e)) return p + e
  }
  // directory index
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    for (const e of exts) {
      const idx = path.join(p, 'index' + e)
      if (fs.existsSync(idx)) return idx
    }
  }
  return null
}

function stripExt(p) {
  const ext = path.extname(p)
  return ext ? p.slice(0, -ext.length) : p
}

function tryResolveBase(base) {
  // try exact
  const exact = existsAny(base)
  if (exact) return exact
  // try without extension (index resolution will be tried inside existsAny)
  const noExt = existsAny(stripExt(base))
  if (noExt) return noExt
  // try swapping .js -> .ts and .jsx -> .tsx for TS source imports
  const ext = path.extname(base)
  if (ext === '.js') {
    const cand = base.slice(0, -3) + '.ts'
    const hit = existsAny(cand)
    if (hit) return hit
  }
  if (ext === '.jsx') {
    const cand = base.slice(0, -4) + '.tsx'
    const hit = existsAny(cand)
    if (hit) return hit
  }
  return null
}

function normalizeImport(fromFile, spec) {
  // Only resolve relative paths or absolute starting with src/
  if (spec.startsWith('.')) {
    const base = path.resolve(path.dirname(fromFile), spec)
    return tryResolveBase(base)
  }
  if (spec.startsWith('/src/')) {
    const base = path.join(ROOT, spec.slice(1))
    return tryResolveBase(base)
  }
  if (spec.startsWith('src/')) {
    const base = path.join(ROOT, spec)
    return tryResolveBase(base)
  }
  return null // external package or unresolved alias
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8') } catch { return '' }
}

const importRegexps = [
  /import\s+[^'"`]*?from\s*["'`](.*?)["'`]/g, // import x from '...'
  /import\s*["'`](.*?)["'`]/g,                  // import '...'
  /require\(\s*["'`](.*?)["'`]\s*\)/g,       // require('...')
  /export\s+\*\s+from\s*["'`](.*?)["'`]/g,    // export * from '...'
  /export\s+\{[^}]*\}\s+from\s*["'`](.*?)["'`]/g, // export {x} from '...'
  /import\(\s*["'`](.*?)["'`]\s*\)/g,        // dynamic import('...')
]

function extractImports(code) {
  const specs = new Set()
  for (const rx of importRegexps) {
    let m
    while ((m = rx.exec(code)) !== null) {
      const s = m[1]
      if (s) specs.add(s)
    }
  }
  return Array.from(specs)
}

function walkGraph(entries) {
  const visited = new Set()
  const stack = [...entries.filter(Boolean)]
  while (stack.length) {
    const f = stack.pop()
    if (!f || visited.has(f)) continue
    visited.add(f)
    const code = read(f)
    const imports = extractImports(code)
    for (const spec of imports) {
      const resolved = normalizeImport(f, spec)
      if (resolved && !visited.has(resolved)) stack.push(resolved)
    }
  }
  return visited
}

function listAllSrcFiles() {
  const all = []
  const skipDirs = new Set(['node_modules', 'dist', 'dist_clean', '.git', '.husky', '.vscode'])
  function walk(dir) {
    for (const ent of fs.readdirSync(dir)) {
      if (skipDirs.has(ent)) continue
      const full = path.join(dir, ent)
      const st = fs.statSync(full)
      if (st.isDirectory()) walk(full)
      else if (exts.includes(path.extname(full)) || full.endsWith('.jsx') || full.endsWith('.tsx')) all.push(full)
    }
  }
  walk(SRC)
  return all
}

// Resolve actual entries present
const entries = ENTRY_CANDIDATES.map(p => (fs.existsSync(p) ? p : null)).filter(Boolean)
if (entries.length === 0) {
  console.error('[AUDIT] No entry points found (expected src/main.jsx or src/index.ts)')
  process.exit(2)
}

const reachable = walkGraph(entries)
const allFiles = listAllSrcFiles()

const unreachable = allFiles.filter(f => !reachable.has(f))

const result = {
  root: path.relative(path.dirname(ROOT), ROOT),
  entries: entries.map(e => path.relative(ROOT, e)),
  reachableCount: reachable.size,
  allCount: allFiles.length,
  unreachable: unreachable.map(f => path.relative(ROOT, f)).sort(),
  timestamp: new Date().toISOString(),
  notes: [
    'قد تحتوي القائمة على ملفات تُحمّل ديناميكيًا أثناء التشغيل أو عبر إعدادات alias ولم تُلتقط هنا.',
    'تحقق يدويًا قبل الحذف. يُفضَّل الأرشفة أولًا.',
  ],
}

const outDir = path.join(ROOT, 'data', 'audit')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'unusedFiles.json'), JSON.stringify(result, null, 2))
console.log('[AUDIT] Unused files check complete ✅')
