/**
 * Archive unused files listed by scripts/maintenance/find-unused.js into archive/unused/.
 * SAFE: Dry-run by default. Set ARCHIVE_CONFIRM=true to actually move files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT = path.join(ROOT, 'scripts', 'maintenance', 'unused-report.json');
const DEST = path.join(ROOT, 'archive', 'unused');
const CONFIRM = String(process.env.ARCHIVE_CONFIRM || 'false').toLowerCase() === 'true';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function moveSafe(src, destRoot) {
  const rel = src.replace(ROOT + path.sep, '');
  const dest = path.join(destRoot, rel);
  ensureDir(path.dirname(dest));
  fs.renameSync(src, dest);
  return { src, dest };
}

function run() {
  if (!fs.existsSync(REPORT)) { console.error('unused-report.json not found. Run find-unused.js first.'); process.exit(1); }
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const candidates = report.unused || [];
  const plan = candidates
    .filter(r => !r.startsWith('archive/') && !r.startsWith('node_modules/') && !r.startsWith('.git/'))
    .map(r => path.join(ROOT, r))
    .filter(abs => fs.existsSync(abs));

  console.log(`Plan contains ${plan.length} files.`);
  if (!CONFIRM) {
    console.log('Dry-run (no moves). Set ARCHIVE_CONFIRM=true to execute.');
    plan.slice(0, 25).forEach(p => console.log(`Would move: ${p} -> ${path.join(DEST, p.replace(ROOT + path.sep, ''))}`));
    process.exit(0);
  }

  ensureDir(DEST);
  let moved = 0;
  for (const p of plan) {
    try {
      const res = moveSafe(p, DEST);
      console.log(`Moved: ${res.src} -> ${res.dest}`);
      moved++;
    } catch (e) {
      console.error(`Failed to move ${p}: ${e.message}`);
    }
  }
  console.log(`Done. Moved ${moved} files.`);
}

run();
