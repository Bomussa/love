/**
 * Simple unused files detector (best-effort) for JS/JSX.
 * - Scans src/ tree and builds a set of referenced files by static import/require and relative href/src.
 * - Outputs a report to stdout and writes JSON to scripts/maintenance/unused-report.json
 * - SAFE: No file moves. Use results to manually curate archive/unused/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp']);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

function rel(p) { return p.replace(ROOT + path.sep, '').replace(/\\/g, '/'); }

function collectReferences(file, text) {
  const refs = new Set();
  const importRe = /import\s+[^'"\n]*['\"]([^'\"]+)['\"]/g;
  const requireRe = /require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  const assetRe = /['\"](\.\.?\/[^'\"\)]+\.(?:png|jpg|jpeg|svg|gif|webp))['\"]/g;
  const sseRe = /new\s+EventSource\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  const reList = [importRe, requireRe, assetRe, sseRe];
  for (const re of reList) {
    re.lastIndex = 0;
    let m; while ((m = re.exec(text))) refs.add(m[1]);
  }
  return [...refs];
}

function resolveRef(baseFile, ref) {
  if (ref.startsWith('http')) return null;
  if (ref.startsWith('/')) return path.join(ROOT, ref);
  const base = path.dirname(baseFile);
  const withExts = ['', '.js', '.jsx', '.json'];
  for (const ext of withExts) {
    const p = path.resolve(base, ref + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const allFiles = new Set(walk(SRC).concat(walk(PUBLIC)));
const referenced = new Set();

for (const f of allFiles) {
  if (!/\.(js|jsx|json|html|css|md)$/i.test(f)) continue;
  try {
    const text = fs.readFileSync(f, 'utf8');
    const refs = collectReferences(f, text);
    for (const r of refs) {
      const p = resolveRef(f, r);
      if (p && fs.existsSync(p)) referenced.add(p);
    }
  } catch {}
}

const unused = [...allFiles].filter(p => !referenced.has(p) && !rel(p).startsWith('archive/'));
const report = { total: allFiles.size, referenced: referenced.size, unused: unused.map(rel) };
console.log(JSON.stringify(report, null, 2));
fs.mkdirSync(path.join(ROOT, 'scripts', 'maintenance'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'scripts', 'maintenance', 'unused-report.json'), JSON.stringify(report, null, 2));
