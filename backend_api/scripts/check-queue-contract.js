#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['supabase/functions', 'lib', 'api', 'tests', 'scripts'];
const ALLOWED_PATH_SEGMENTS = ['supabase/functions/queue-compat', 'scripts/check-queue-contract.js'];
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const FORBIDDEN_PATTERNS = [/\.from\(\s*['"]queue['"]\s*\)/g, /\.from\(\s*['"]unified_queue['"]\s*\)/g];

const violations = [];

function shouldSkip(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return ALLOWED_PATH_SEGMENTS.some((segment) => normalized.includes(segment));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!CODE_EXTENSIONS.has(path.extname(entry.name))) continue;

    const relPath = path.relative(ROOT, fullPath);
    if (shouldSkip(relPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      FORBIDDEN_PATTERNS.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push(`${relPath}:${index + 1}: ${line.trim()}`);
        }
        pattern.lastIndex = 0;
      });
    });
  }
}

for (const scanDir of SCAN_DIRS) {
  walk(path.join(ROOT, scanDir));
}

if (violations.length > 0) {
  console.error('Queue contract violation(s) found:');
  violations.forEach((v) => console.error(` - ${v}`));
  process.exit(1);
}

console.log('Queue contract check passed: no legacy queue table access found.');
