import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

const sources = [
  'routeMap.json',
  'clinics.json',
];

async function sync() {
  const srcDir = path.join(frontendRoot, 'config');
  const destDir = path.join(frontendRoot, 'public', 'config');
  await mkdir(destDir, { recursive: true });

  for (const filename of sources) {
    const src = path.join(srcDir, filename);
    const dest = path.join(destDir, filename);
    const payload = await readFile(src, 'utf8');
    const normalized = `${JSON.stringify(JSON.parse(payload), null, 2)}\n`;
    await writeFile(dest, normalized, 'utf8');
    console.log(`synced ${filename}`);
  }
}

sync().catch((err) => {
  console.error('Failed to sync runtime config:', err);
  process.exitCode = 1;
});
