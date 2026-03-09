import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(startDir) {
  let current = startDir;
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(current, 'frontend/config/api-contract.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Unable to locate repository root containing frontend/config/api-contract.json');
}

const repoRoot = findRepoRoot(process.cwd());
const contractPath = path.join(repoRoot, 'frontend/config/api-contract.json');
const filesToScan = [
  'frontend/src/components/QARepairPanel.jsx',
  'frontend/src/components/AdminDashboardV2.jsx',
  'frontend/src/core/event-bus.js',
  'frontend/src/lib/api-unified.js',
];

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const allowed = new Set(contract.endpoints);
const blocked = new Set(contract.legacyBlocked || []);

const endpointPattern = /(['"`])((?:\/api\/v1|\/functions\/v1)\/[A-Za-z0-9_/-]+)\1/g;
const violations = [];

for (const relFile of filesToScan) {
  const absFile = path.join(repoRoot, relFile);
  const content = fs.readFileSync(absFile, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    for (const match of line.matchAll(endpointPattern)) {
      const endpoint = match[2];
      if (blocked.has(endpoint)) {
        violations.push(`${relFile}:${i + 1} uses blocked legacy endpoint '${endpoint}'`);
      } else if (!allowed.has(endpoint)) {
        violations.push(`${relFile}:${i + 1} uses endpoint not in contract '${endpoint}'`);
      }
    }
  });
}

if (violations.length) {
  console.error('API contract validation failed:\n' + violations.map((v) => `- ${v}`).join('\n'));
  process.exit(1);
}

console.log('API contract validation passed.');
