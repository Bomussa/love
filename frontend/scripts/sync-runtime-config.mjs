import { execFileSync } from 'node:child_process';
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

function resolveCommitSha() {
  const environmentSha = String(
    process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.GITHUB_SHA
      || process.env.COMMIT_SHA
      || '',
  ).trim();

  if (/^[a-f0-9]{40}$/i.test(environmentSha)) return environmentSha.toLowerCase();

  try {
    const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: path.resolve(frontendRoot, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^[a-f0-9]{40}$/i.test(gitSha)) return gitSha.toLowerCase();
  } catch {
    // CLI deployments may omit the Git repository. The release gate rejects unknown SHAs.
  }

  return 'unknown';
}

async function sync() {
  const srcDir = path.join(frontendRoot, 'config');
  const publicDir = path.join(frontendRoot, 'public');
  const destDir = path.join(publicDir, 'config');
  await mkdir(destDir, { recursive: true });

  for (const filename of sources) {
    const src = path.join(srcDir, filename);
    const dest = path.join(destDir, filename);
    const payload = await readFile(src, 'utf8');
    const normalized = `${JSON.stringify(JSON.parse(payload), null, 2)}\n`;
    await writeFile(dest, normalized, 'utf8');
    console.log(`synced ${filename}`);
  }

  const buildMeta = {
    commitSha: resolveCommitSha(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    builtAt: new Date().toISOString(),
  };

  await writeFile(
    path.join(publicDir, 'build-meta.json'),
    `${JSON.stringify(buildMeta, null, 2)}\n`,
    'utf8',
  );
  console.log(`synced build-meta.json (${buildMeta.commitSha})`);
}

sync().catch((err) => {
  console.error('Failed to sync runtime config:', err);
  process.exitCode = 1;
});
