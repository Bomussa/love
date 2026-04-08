#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function normalizeIdentifier(raw) {
  return raw.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();
}

function normalizeSignature(body) {
  return body
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .trim()
    .toLowerCase();
}

function parseCreateTables(content) {
  const regex = /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."']+)\s*\(([^;]*?)\)\s*;/gims;
  const creates = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const table = normalizeIdentifier(match[1]);
    const signature = normalizeSignature(match[2]);
    creates.push({ table, signature });
  }

  return creates;
}

function getChangedMigrations(base, head) {
  const output = run(`git diff --name-status ${base} ${head}`);
  if (!output) return { added: new Set() };

  const added = new Set();

  for (const line of output.split('\n')) {
    const parts = line.split('\t');
    const status = parts[0];

    if (status.startsWith('R')) {
      const newPath = parts[2];
      if (newPath && newPath.startsWith(`${MIGRATIONS_DIR}/`) && newPath.endsWith('.sql')) {
        added.add(newPath);
      }
      continue;
    }

    const filePath = parts[1];
    if (!filePath || !filePath.startsWith(`${MIGRATIONS_DIR}/`) || !filePath.endsWith('.sql')) {
      continue;
    }

    if (status === 'A') {
      added.add(filePath);
    }
  }

  return { added };
}

function main() {
  const base = process.argv[2];
  const head = process.argv[3] || 'HEAD';

  if (!base) {
    console.error('Usage: node scripts/check-migration-table-conflicts.js <base_sha> [head_sha]');
    process.exit(2);
  }

  const { added } = getChangedMigrations(base, head);

  if (added.size === 0) {
    console.log('No added migration files under supabase/migrations; check skipped.');
    return;
  }

  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => path.join(MIGRATIONS_DIR, file));

  const baselineSignatures = new Map();
  const errors = [];

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const creates = parseCreateTables(content);
    const isAdded = added.has(filePath);

    for (const create of creates) {
      const previous = baselineSignatures.get(create.table);

      if (!isAdded) {
        if (!previous) {
          baselineSignatures.set(create.table, { signature: create.signature, filePath });
        }
        continue;
      }

      if (previous && previous.signature !== create.signature) {
        errors.push([
          `Conflict in ${filePath}: table "${create.table}" is re-created with a different definition.`,
          `Existing baseline file: ${previous.filePath}`,
        ].join('\n'));
        continue;
      }

      if (!previous) {
        baselineSignatures.set(create.table, { signature: create.signature, filePath });
      }
    }
  }

  if (errors.length > 0) {
    console.error('Migration table conflict check failed:\n');
    console.error(errors.join('\n\n'));
    process.exit(1);
  }

  console.log('Migration table conflict check passed.');
}

main();
