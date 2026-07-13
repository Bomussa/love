#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyDir = path.join(root, 'src', 'components');
const activeDir = path.join(root, 'frontend', 'src', 'components');

function collectFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative.split(path.sep).join('/'));
    }
  }
  return files;
}

const legacyFiles = new Set(collectFiles(legacyDir));
const activeFiles = new Set(collectFiles(activeDir));
const duplicates = [...legacyFiles].filter((file) => activeFiles.has(file)).sort();

if (duplicates.length === 0) {
  console.log('No duplicate active component paths found between src/components and frontend/src/components.');
  process.exit(0);
}

console.error('Duplicate active component paths found between src/components and frontend/src/components.');
console.error('frontend/src is the authoritative frontend source; root src/components must not carry active duplicates.');
console.error('Before archiving or deleting any duplicate, compare and migrate production fixes with:');
for (const file of duplicates) {
  const legacyPath = path.posix.join('src/components', file);
  const activePath = path.posix.join('frontend/src/components', file);
  console.error(`  diff -u ${legacyPath} ${activePath}`);
}
console.error(`\nDuplicate count: ${duplicates.length}`);
process.exit(1);
